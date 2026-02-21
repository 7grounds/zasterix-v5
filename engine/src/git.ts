import { Octokit } from '@octokit/rest';
import 'dotenv/config';

// ─────────────────────────────────────────────────────────────────────────────
// GitHub integration — lets the Engine commit agent-generated code back to the
// repository without needing a local git installation.
//
// Required environment variables:
//   GITHUB_TOKEN       — Personal Access Token or GitHub App token with
//                        `contents: write` permission on the target repo
//   GITHUB_REPO_OWNER  — GitHub org or user name (e.g. "7grounds")
//   GITHUB_REPO_NAME   — Repository name        (e.g. "zasterix-v5")
//   GITHUB_BRANCH      — Branch to commit to    (default: "main")
// ─────────────────────────────────────────────────────────────────────────────

const GITHUB_TOKEN      = process.env.GITHUB_TOKEN;
const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER;
const GITHUB_REPO_NAME  = process.env.GITHUB_REPO_NAME;
const GITHUB_BRANCH     = process.env.GITHUB_BRANCH ?? 'main';

if (!GITHUB_TOKEN)      throw new Error('Missing environment variable: GITHUB_TOKEN');
if (!GITHUB_REPO_OWNER) throw new Error('Missing environment variable: GITHUB_REPO_OWNER');
if (!GITHUB_REPO_NAME)  throw new Error('Missing environment variable: GITHUB_REPO_NAME');

// After the guards above these are guaranteed to be strings
const OWNER  = GITHUB_REPO_OWNER;
const REPO   = GITHUB_REPO_NAME;

const octokit = new Octokit({ auth: GITHUB_TOKEN });

export interface CommitCodeOptions {
  /** Repo-relative path for the file, e.g. "engine/src/generated/myAgent.ts" */
  path: string;
  /** Full file content as a string */
  content: string;
  /** Commit message — must include the reasoning per CONSTITUTION.md Article II */
  message: string;
}

/**
 * Commit a single file to the GitHub repository.
 *
 * If the file already exists its current SHA is fetched and used for the
 * update (GitHub's Contents API requires this to overwrite a file).
 * If the file is new it will be created.
 *
 * Per CONSTITUTION.md Article II the `message` parameter must contain a
 * `reasoning` statement explaining how the change serves Independence and
 * Humanity. Callers are responsible for enforcing this.
 */
export async function commitCode(options: CommitCodeOptions): Promise<void> {
  const { path, content, message } = options;

  const owner  = OWNER;
  const repo   = REPO;
  const branch = GITHUB_BRANCH;

  // Base64-encode the content (required by the GitHub Contents API)
  const contentBase64 = Buffer.from(content, 'utf8').toString('base64');

  // Fetch the existing file's SHA so we can overwrite it (if it exists)
  let existingSha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path, ref: branch });
    // getContent returns an array for directories; narrow to a single file
    if (!Array.isArray(data) && data.type === 'file') {
      existingSha = data.sha;
    }
  } catch (err: unknown) {
    // 404 means the file doesn't exist yet — that's fine, we'll create it
    if (
      typeof err === 'object' &&
      err !== null &&
      'status' in err &&
      (err as { status: unknown }).status !== 404
    ) {
      throw err;
    }
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: contentBase64,
    branch,
    ...(existingSha ? { sha: existingSha } : {}),
  });

  console.log(`[git] Committed ${path} to ${owner}/${repo}@${branch}`);
}
