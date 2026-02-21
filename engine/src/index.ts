import 'dotenv/config';
import { supabase } from './db';

// How often to poll Supabase for new work (default: 5 s)
const POLL_INTERVAL_MS = Number(process.env.ENGINE_POLL_INTERVAL_MS ?? 5000);

// ─────────────────────────────────────────────────────────────────────────────
// Type definitions (mirrors the `agent_tasks` table in Supabase)
// ─────────────────────────────────────────────────────────────────────────────
type TaskStatus = 'pending' | 'active' | 'completed' | 'failed';

interface AgentTask {
  id: string;
  type: string;
  status: TaskStatus;
  current_step: string | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: atomically claim a task (compare-and-swap).
// For 'pending' tasks: only update if status is still 'pending'.
// For stale 'active' tasks: only update if updated_at is still past the stale
// threshold — meaning no other instance has resumed it since the poll.
// Returns true if this instance won the claim, false otherwise.
// ─────────────────────────────────────────────────────────────────────────────
async function claimTask(task: AgentTask): Promise<boolean> {
  const now = new Date().toISOString();

  let query = supabase
    .from('agent_tasks')
    .update({ status: 'active', current_step: 'claimed', updated_at: now })
    .eq('id', task.id);

  if (task.status === 'pending') {
    query = query.eq('status', 'pending');
  } else {
    // Stale active: re-claim only if another instance hasn't touched it since our poll
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();
    query = query.eq('status', 'active').lt('updated_at', staleThreshold);
  }

  const { data, error } = await query.select('id');
  if (error) throw new Error(`Failed to claim task ${task.id}: ${error.message}`);
  return Array.isArray(data) && data.length > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: checkpoint — write progress back to the DB before the next step
// ─────────────────────────────────────────────────────────────────────────────
async function checkpoint(
  taskId: string,
  step: string,
  partial?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('agent_tasks')
    .update({
      current_step: step,
      ...(partial ? { output: partial } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) throw new Error(`Checkpoint failed for task ${taskId}: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: mark a task completed
// ─────────────────────────────────────────────────────────────────────────────
async function completeTask(
  taskId: string,
  output: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('agent_tasks')
    .update({
      status: 'completed',
      current_step: 'done',
      output,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) throw new Error(`Failed to complete task ${taskId}: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: mark a task failed — always write the error to the DB (Article IV)
// ─────────────────────────────────────────────────────────────────────────────
async function failTask(taskId: string, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? (err.stack ?? '') : '';

  await supabase
    .from('agent_tasks')
    .update({
      status: 'failed',
      output: { error: message, stack },
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Core task processor — add your agent logic here.
// Every meaningful step MUST call checkpoint() before proceeding.
// ─────────────────────────────────────────────────────────────────────────────
async function processTask(task: AgentTask): Promise<void> {
  console.log(`[engine] Processing task ${task.id} (type=${task.type})`);

  // Atomic claim — skip if another instance already claimed this task
  const claimed = await claimTask(task);
  if (!claimed) {
    console.log(`[engine] Task ${task.id} already claimed by another instance — skipping.`);
    return;
  }

  // ── Step 1 ────────────────────────────────────────────────────────────────
  await checkpoint(task.id, 'step_1');
  // TODO: implement step 1 logic here

  // ── Step 2 ────────────────────────────────────────────────────────────────
  await checkpoint(task.id, 'step_2');
  // TODO: implement step 2 logic here

  await completeTask(task.id, { result: 'ok' });
  console.log(`[engine] Task ${task.id} completed.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main loop — polls the `agent_tasks` table forever.
// Fetches 'pending' tasks (new work) and 'active' tasks whose updated_at is
// older than STALE_THRESHOLD_MS (indicating a crashed previous instance).
// The atomic claimTask() prevents two instances from double-processing.
// ─────────────────────────────────────────────────────────────────────────────
const STALE_THRESHOLD_MS = 60_000; // 60 s without a heartbeat = presumed crashed

async function run(): Promise<void> {
  console.log(`[engine] Starting. Poll interval: ${POLL_INTERVAL_MS} ms`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();

      // Fetch pending tasks OR active tasks that haven't been updated recently
      const { data: tasks, error } = await supabase
        .from('agent_tasks')
        .select('*')
        .or(`status.eq.pending,and(status.eq.active,updated_at.lt.${staleThreshold})`)
        .order('created_at', { ascending: true })
        .limit(10);

      if (error) {
        console.error('[engine] Poll error:', error.message);
      } else if (tasks && tasks.length > 0) {
        for (const task of tasks as AgentTask[]) {
          try {
            await processTask(task);
          } catch (taskErr) {
            console.error(`[engine] Task ${task.id} failed:`, taskErr);
            await failTask(task.id, taskErr);
          }
        }
      }
    } catch (loopErr) {
      // The loop must never crash the process — log and continue
      console.error('[engine] Unexpected loop error:', loopErr);
    }

    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

run();
