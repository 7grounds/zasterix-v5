# zasterix-v5

## Summary: What We Started to Build in v5

Zasterix-v5 is an **AI-powered agent engine** with a Next.js web frontend and a standalone backend engine that communicates with a Supabase database and the Gemini AI API.

---

### Architecture

The project is split into two parts:

| Part | Tech | Purpose |
|------|------|---------|
| **Web App** (`/app`) | Next.js 14, React 18, TypeScript | Frontend + API routes for the web interface |
| **Engine** (`/engine`) | Node.js, TypeScript | Standalone backend engine that runs scheduled agent tasks |

---

### What Was Built

#### 1. Next.js Web Application
- **Framework**: Next.js 14.1 with React 18 and TypeScript
- **API Route** (`/api/check`): Health-check endpoint that verifies the Supabase connection by querying the `agent_tasks` table

#### 2. Backend Engine
- **Entry point** (`engine/main.ts`): Initialises environment variables and connects to Supabase
- **Connection test** (`engine/src/test-connection.ts`): Utility that verifies the API URL is reachable via HTTP

#### 3. Supabase Integration
- Database table: `agent_tasks` (core table for the agent system)
- Credentials passed via environment variables: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

#### 4. Gemini AI Integration (Scaffolded)
- `GEMINI_API_KEY` secret is wired into the CI/CD pipeline, ready for AI agent logic

#### 5. Automated CI/CD Runner
- **GitHub Actions workflow** (`.github/workflows/worker.yml`) runs the engine on a **5-minute cron schedule** (`*/5 * * * *`) and can also be triggered manually via `workflow_dispatch`
- Steps: checkout → install Node 20 → `npm install` → `tsc` (compile TypeScript) → `node dist/main.js`

---

### Environment Variables

| Variable | Used By | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Web app | Supabase project URL (public) |
| `SUPABASE_URL` | Engine | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Web app + Engine | Supabase service-role secret key |
| `GEMINI_API_KEY` | Engine (future) | Google Gemini AI API key |
| `API_URL` | Engine test utility | Base URL of the API to probe |

---

### Current Status

- ✅ Project scaffolding (Next.js + TypeScript + Supabase)
- ✅ Database connectivity verified (`agent_tasks` table)
- ✅ Automated engine runner (GitHub Actions, every 5 minutes)
- ✅ Gemini API key wired in for future AI agent logic
- 🚧 Agent task processing logic (in development)