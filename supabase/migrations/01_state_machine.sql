-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 01 — State Machine Schema
-- Zasterix-V5 Supabase "Brain"
--
-- Run via Supabase CLI:  supabase db push
-- Or manually:           Dashboard → SQL Editor → paste and run
--
-- Tables:
--   agent_tasks  — source of truth for all agent work          (Pillar 2)
--   registry     — dynamically generated code strings          (Pillar 3)
--   logs         — append-only audit/event log for all agents  (Constitution Article II)
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable pgcrypto so gen_random_uuid() is available
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- agent_tasks
-- Every row is one unit of work. The Engine claims rows atomically and writes
-- current_step + updated_at back to the DB before every state transition.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists agent_tasks (
  id            uuid        primary key default gen_random_uuid(),
  type          text        not null,
  status        text        not null default 'pending'
                            check (status in ('pending', 'active', 'completed', 'failed')),
  current_step  text,
  input         jsonb,
  output        jsonb,
  -- reasoning: every task must document why it serves Independence & Humanity
  -- (see CONSTITUTION.md Article II)
  reasoning     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Polling index: WHERE status IN ('pending','active') ORDER BY created_at
create index if not exists idx_agent_tasks_status_created
  on agent_tasks (status, created_at asc);

-- Stale-task recovery index: active rows not updated within the threshold
create index if not exists idx_agent_tasks_active_updated
  on agent_tasks (status, updated_at asc)
  where status = 'active';

-- ─────────────────────────────────────────────────────────────────────────────
-- registry
-- Agent-generated JavaScript code strings stored here and executed by the
-- Engine in a vm2 sandbox with a pre-injected Supabase client (Pillar 3).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists registry (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null unique,
  code        text        not null,
  -- reasoning is MANDATORY — no reasoning = change must not proceed
  -- (see CONSTITUTION.md Article II)
  reasoning   text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Name-based lookup used when the Engine loads a module by name
create index if not exists idx_registry_name on registry (name);

-- ─────────────────────────────────────────────────────────────────────────────
-- logs
-- Append-only audit trail. Every significant agent action, state transition,
-- and error must be written here to satisfy Constitution Article II
-- (Radical Transparency). Rows are never deleted or updated — only inserted.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists logs (
  id          uuid        primary key default gen_random_uuid(),
  -- The task this log entry belongs to (null for system-level events)
  task_id     uuid        references agent_tasks (id) on delete set null,
  level       text        not null default 'info'
                          check (level in ('info', 'warn', 'error')),
  event       text        not null,
  -- Structured payload — stack traces, inputs, outputs, reasoning, etc.
  data        jsonb,
  created_at  timestamptz not null default now()
);

-- Efficient lookup of all log entries for a given task
create index if not exists idx_logs_task_id   on logs (task_id, created_at asc);
-- Efficient lookup of recent errors across all tasks
create index if not exists idx_logs_level     on logs (level, created_at desc)
  where level in ('warn', 'error');

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- Engine uses Service Role Key (bypasses RLS entirely).
-- Dashboard uses Anon Key — can submit tasks and read status; never sees code
-- strings or internal log data.
-- ─────────────────────────────────────────────────────────────────────────────
alter table agent_tasks enable row level security;
alter table registry    enable row level security;
alter table logs        enable row level security;

-- Dashboard (anon): submit new tasks and read task status
create policy "anon can insert agent_tasks"
  on agent_tasks for insert
  to anon
  with check (true);

create policy "anon can read agent_tasks"
  on agent_tasks for select
  to anon
  using (true);

-- registry and logs are engine-only — no anon access
-- (Service Role Key bypasses RLS so the engine always has full access.)

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: auto-update updated_at on agent_tasks and registry
-- (logs is append-only — no update trigger needed)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger trg_agent_tasks_updated_at
  before update on agent_tasks
  for each row execute function set_updated_at();

create or replace trigger trg_registry_updated_at
  before update on registry
  for each row execute function set_updated_at();
