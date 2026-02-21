# Copilot Instructions for Project Zasterix-V5

> **This is a Durable Multi-Agent System (Durable MAS) project.**
> Prioritize state-machine logic over request-response.
> All agent steps must be logged to Supabase before proceeding.

## Pillar 1 — The Architectural Shift

We are moving away from Vercel Serverless Functions for agent logic. Project Zasterix-V5 uses a **Producer-Consumer architecture**:

- The **Next.js frontend** (deployed on Vercel, lives in `/dashboard`) is the *Producer*. Its only job is to write task records to Supabase. It must **never** contain long-running agent logic, background loops, or anything that could exceed Vercel's function timeout.
- The **Engine** (a persistent Node.js process, lives in `/engine`, deployed to Railway or run in Codespaces) is the *Consumer*. It polls Supabase for pending work and executes it. Because it is a long-running process, it is immune to 504 timeout errors.

**Rule:** Any code that runs for more than a few seconds belongs in `/engine`, not in `/dashboard`.

---

## Pillar 2 — The Database-First State Machine

The system's "Brain" lives entirely in **Supabase**.

- Use the `agent_tasks` table as the **single source of truth** for all agent work.
- Every agent step must be **checkpointed** in the database *before* moving to the next step. Write the current step name, status (`pending` | `active` | `completed` | `failed`), and any intermediate output back to the `agent_tasks` row immediately after each action.
- If the Engine process restarts for any reason (crash, redeploy, scale-down), it must be able to **resume** by querying Supabase for tasks whose status is `pending` or `active` and continuing from the last recorded step in the SQL registry — no in-memory state required.

**Rule:** Never store agent progress only in memory. If it is not in the database, it does not exist.

---

## Pillar 3 — The Dynamic Execution Environment

Zasterix-V5 features a **Dynamic Code Execution Environment**:

- Agents generate JavaScript code **as strings** and save those strings to the `registry` table in Supabase.
- The Engine uses the **`vm2`** library to execute this generated code inside a secure sandbox, preventing access to the host filesystem or process.
- When writing any sandbox-executed code, ensure the generated code has access to a **pre-initialized Supabase client** that is injected into the sandbox context — the generated code must not attempt to import or instantiate its own Supabase client.

**Rule:** All dynamically generated code must be written assuming a `supabase` variable is already available in scope. Example sandbox context shape:

```js
const { VM } = require('vm2');
const vm = new VM({
  sandbox: {
    supabase, // pre-initialized @supabase/supabase-js client
    console,
  },
});
vm.run(generatedCodeString);
```
