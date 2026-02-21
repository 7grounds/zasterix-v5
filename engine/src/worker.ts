import { GoogleGenerativeAI } from '@google/generative-ai';
import config from './config';
import { supabase } from './db';

// ─────────────────────────────────────────────────────────────────────────────
// Gemini client — initialised once at module load using config.ts credentials
// (pattern mirrors test-connection.ts)
// ─────────────────────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(config.geminiApiKey);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Project name used in the Gemini prompt — change here if reusing this engine
const PROJECT_NAME = process.env.PROJECT_NAME ?? 'Zasterix-V5';

// 60 s without a heartbeat = presumed crashed instance
const STALE_THRESHOLD_MS = 60_000;

// ─────────────────────────────────────────────────────────────────────────────
// Type definitions (mirrors the `agent_tasks` table in Supabase)
// ─────────────────────────────────────────────────────────────────────────────
type TaskStatus = 'pending' | 'active' | 'completed' | 'failed';

export interface AgentTask {
  id: string;
  type: string;
  status: TaskStatus;
  current_step: string | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  reasoning: string | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: write an entry to the logs table (append-only audit trail)
// ─────────────────────────────────────────────────────────────────────────────
async function writeLog(
  taskId: string,
  event: string,
  data: Record<string, unknown>,
  level: 'info' | 'warn' | 'error' = 'info'
): Promise<void> {
  const { error } = await supabase
    .from('logs')
    .insert({ task_id: taskId, level, event, data });

  if (error) {
    // Log writes must never abort the main flow — log to console and continue
    console.error(`[worker] Failed to write log for task ${taskId}: ${error.message}`);
  }
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
    .update({ status: 'active', current_step: 'processing', updated_at: now })
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
export async function checkpoint(
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
export async function completeTask(
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
export async function failTask(taskId: string, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? (err.stack ?? '') : '';

  const { error } = await supabase
    .from('agent_tasks')
    .update({
      status: 'failed',
      output: { error: message, stack },
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) throw new Error(`Failed to mark task ${taskId} as failed: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// callGeminiForTask — sends a task to Gemini, writes the response to logs,
// and marks the task completed. Shared by processNextTask and stale recovery.
// The caller is responsible for claiming the task before calling this.
// ─────────────────────────────────────────────────────────────────────────────
async function callGeminiForTask(task: AgentTask): Promise<void> {
  await checkpoint(task.id, 'gemini_call');

  const prompt =
    `You are an autonomous agent for project ${PROJECT_NAME}.\n` +
    `Task type: ${task.type}\n` +
    `Input: ${JSON.stringify(task.input ?? {}, null, 2)}\n\n` +
    `Please process this task and provide your response.`;

  let geminiResponse: string;
  try {
    const result = await geminiModel.generateContent(prompt);
    geminiResponse = result.response.text().trim();
  } catch (geminiErr) {
    await writeLog(task.id, 'gemini_error', {
      error: geminiErr instanceof Error ? geminiErr.message : String(geminiErr),
    }, 'error');
    throw new Error(
      `Gemini call failed for task ${task.id}: ${geminiErr instanceof Error ? geminiErr.message : String(geminiErr)}`
    );
  }

  console.log(`[worker] Gemini responded for task ${task.id} (${geminiResponse.length} chars)`);

  // Save to logs (Constitution Article II — transparency)
  await writeLog(task.id, 'gemini_response', { response: geminiResponse });
  await completeTask(task.id, { gemini_response: geminiResponse });
  console.log(`[worker] Task ${task.id} completed.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// processNextTask — finds the oldest pending task, claims it atomically,
// sends its description to Gemini, saves the response to the logs table,
// and marks the task completed.
//
// Returns immediately (no-op) when the queue is empty.
// ─────────────────────────────────────────────────────────────────────────────
export async function processNextTask(): Promise<void> {
  // 1. Fetch the next pending task (FIFO)
  const { data: rows, error: fetchErr } = await supabase
    .from('agent_tasks')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1);

  if (fetchErr) throw new Error(`Failed to fetch pending task: ${fetchErr.message}`);
  if (!rows || rows.length === 0) return; // queue is empty — nothing to do

  const task = rows[0] as AgentTask;
  console.log(`[worker] Found pending task ${task.id} (type=${task.type})`);

  // 2. Atomically claim it — sets status='active', current_step='processing'
  const claimed = await claimTask(task);
  if (!claimed) {
    console.log(`[worker] Task ${task.id} already claimed by another instance — skipping.`);
    return;
  }

  // 3–5. Gemini call → log → complete
  await callGeminiForTask(task);
}

// ─────────────────────────────────────────────────────────────────────────────
// startWorker — begins the persistent polling loop for the agent_tasks table.
//
// Calls processNextTask() on every tick (poll interval from config.ts).
// Also recovers stale 'active' tasks that were abandoned by a crashed instance.
// ─────────────────────────────────────────────────────────────────────────────
export async function startWorker(): Promise<void> {
  console.log(`[worker] Starting. Poll interval: ${config.pollIntervalMs} ms`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      // Process the next pending task
      await processNextTask();

      // Also recover stale active tasks (crashed instance recovery)
      const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();
      const { data: staleTasks, error: staleErr } = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('status', 'active')
        .lt('updated_at', staleThreshold)
        .order('updated_at', { ascending: true })
        .limit(5);

      if (staleErr) {
        console.error('[worker] Stale task query error:', staleErr.message);
      } else if (staleTasks && staleTasks.length > 0) {
        for (const staleTask of staleTasks as AgentTask[]) {
          console.log(`[worker] Recovering stale task ${staleTask.id}`);
          try {
            const reclaimed = await claimTask(staleTask);
            if (!reclaimed) continue; // another instance beat us to it
            await callGeminiForTask(staleTask);
          } catch (taskErr) {
            console.error(`[worker] Stale task ${staleTask.id} failed:`, taskErr);
            await failTask(staleTask.id, taskErr);
          }
        }
      }
    } catch (loopErr) {
      // The loop must never crash the process — log and continue
      console.error('[worker] Unexpected loop error:', loopErr);
    }

    await new Promise<void>((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

