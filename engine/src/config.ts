import 'dotenv/config';

// ─────────────────────────────────────────────────────────────────────────────
// config.ts — centralised, validated environment config for the Engine.
//
// Import this module (not process.env directly) in all engine source files so
// that missing variables are caught at startup with a clear error message.
// ─────────────────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

const config = {
  // ── Supabase ──────────────────────────────────────────────────────────────
  supabaseUrl:            requireEnv('SUPABASE_URL'),
  supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),

  // ── Gemini / Google AI ────────────────────────────────────────────────────
  geminiApiKey:           requireEnv('GEMINI_API_KEY'),

  // ── GitHub ────────────────────────────────────────────────────────────────
  githubToken:            requireEnv('GITHUB_TOKEN'),
  githubRepoOwner:        requireEnv('GITHUB_REPO_OWNER'),
  githubRepoName:         requireEnv('GITHUB_REPO_NAME'),
  githubBranch:           process.env.GITHUB_BRANCH ?? 'main',

  // ── Engine tuning ─────────────────────────────────────────────────────────
  pollIntervalMs: Number(process.env.ENGINE_POLL_INTERVAL_MS ?? 10_000),
} as const;

export default config;
