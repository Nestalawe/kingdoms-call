// The balance report's comment on a pull request (plan P1-03a), run by .github/workflows/balance-report.yml:
// - post: after CI finishes on a pull request (workflow_run), it posts the report CI's balance job uploaded, as one
//   comment, edited in place on later pushes. With no report (no engine path changed, or the job stopped before the
//   report), it edits an earlier report comment to say so, and posts nothing on a pull request that never had one.
// - warn: when a pull request's description is edited, and after each post, it posts a warning comment if the report
//   isn't "no change" and the description has no "What changes in play" section, and deletes it once there is one.
// Neither blocks a merge: any problem is logged as a warning and the job still succeeds.
//
// It never checks out or runs the pull request's code: the workflow runs this file from the default branch (or, for
// warn, from the base commit). The report file is data made by the pull request's code, so it is only checked for
// shape and posted, on that pull request, as the comment's text; which pull request comes from the workflow run.
// Plain Node runs it, with nothing installed: erasable TypeScript only, and only node: imports (as engine-paths.ts).
//
// Environment: GITHUB_TOKEN, GITHUB_REPOSITORY; for post HEAD_SHA, HEAD_OWNER, HEAD_BRANCH, CONCLUSION, RUN_URL,
// REPORT_FILE (missing when there's no report); for warn PR_NUMBER. DRY_RUN=1 prints instead of writing.
import fs from 'node:fs';
import path from 'node:path';

export const MARKER = '<!-- balance-report -->';
export const WARNING_MARKER = '<!-- what-changes-in-play -->';
export const CLASSES = ['no change', 'wording only', 'reshape', 'rule change'] as const;
export type ChangeClass = (typeof CLASSES)[number];
/** GitHub refuses a comment over 65,536 characters. */
export const MAX_REPORT = 60000;
const MAX_FILE = 1 << 20;
const BOT = 'github-actions[bot]';

const isClass = (v: unknown): v is ChangeClass => CLASSES.some((c) => c === v);

/** The report file's text (tools/balance/report-run.ts's ReportFile), or null if it isn't one. */
export function readReport(text: string): { class: ChangeClass; markdown: string } | null {
  try {
    const f = JSON.parse(text) as { version?: unknown; class?: unknown; markdown?: unknown };
    if (f.version !== 1 || !isClass(f.class) || typeof f.markdown !== 'string') return null;
    return { class: f.class, markdown: f.markdown };
  } catch {
    return null;
  }
}

/** The report comment's text. With no report, `conclusion` (the CI run's) says why. */
export function reportBody(
  report: { class: ChangeClass; markdown: string } | null,
  run: { sha: string; url: string; conclusion: string },
): string {
  const at = `commit ${run.sha.slice(0, 7)} ([CI run](${run.url}))`;
  if (!report) {
    const why =
      run.conclusion === 'success'
        ? 'no engine path changed since the base branch, so the balance matrix was not played'
        : "CI's balance job stopped before the report (for example, a refactor-only pull request that changes the " +
          'balance baseline, or a game that failed): see the run';
    return `${MARKER}\n## Balance report\n\nNo report for ${at}: ${why}.\n`;
  }
  let text = report.markdown.split(MARKER).join('').split(WARNING_MARKER).join('');
  if (text.length > MAX_REPORT) text = text.slice(0, MAX_REPORT) + '\n\n…(cut short: the whole report is in the run)\n';
  return `${MARKER}\n<!-- balance-class: ${report.class} -->\n${text}\n_For ${at}. Edited in place on each push._\n`;
}

/** The class of change a report comment holds, or null (no report). */
export function classOf(body: string): ChangeClass | null {
  const c = /^<!-- balance-class: (.+?) -->$/m.exec(body)?.[1];
  return isClass(c) ? c : null;
}

/** The text of the description's "What changes in play" section, '' if it's missing or empty. Comments don't count,
 *  nor does "None". */
export function whatChangesInPlay(description: string | null | undefined): string {
  const text = (description ?? '').replace(/\r\n/g, '\n');
  const heading = /^#{1,6}[ \t]*What changes in play[ \t]*#*[ \t]*$/im.exec(text);
  if (!heading) return '';
  const after = text.slice(heading.index + heading[0].length);
  const end = after.search(/^(#{1,2}[ \t]|-{3,}[ \t]*$)/m);
  const section = (end < 0 ? after : after.slice(0, end)).replace(/<!--[\s\S]*?(-->|$)/g, '').trim();
  return /^(none\.?|…|\.\.\.)$/i.test(section) ? '' : section;
}

/** The warning is needed: the report isn't "no change" and the section is missing or empty. */
export const needsWarning = (cls: ChangeClass | null, description: string | null | undefined): boolean =>
  cls != null && cls !== 'no change' && !whatChangesInPlay(description);

export const WARNING_BODY =
  `${WARNING_MARKER}\n**⚠️ What changes in play.** The balance report says this pull request changes the games, ` +
  'but its description has no "What changes in play" section. Add one to the top half: a few sentences in game ' +
  'terms on what players will notice, with anything that moved but wasn\'t expected under "Not expected" ' +
  '(`.github/pull_request_template.md`).\n\n' +
  "_This is a warning, not a check: it doesn't block the merge. It goes once the section is written._";

interface Comment {
  id: number;
  body?: string;
  user?: { login?: string };
}
interface Pull {
  number: number;
  body?: string | null;
  head: { sha: string };
}

async function api<T>(url: string, token: string | undefined, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (init.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) throw new Error(`GitHub API ${String(res.status)} for ${init.method ?? 'GET'} ${url}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

async function apiAll<T>(url: string, token: string | undefined): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; ; page++) {
    const batch = await api<T[]>(`${url}${url.includes('?') ? '&' : '?'}per_page=100&page=${String(page)}`, token);
    all.push(...batch);
    if (batch.length < 100) return all;
  }
}

async function main(mode: string, env: NodeJS.ProcessEnv): Promise<void> {
  const token = env['GITHUB_TOKEN'];
  const repo = env['GITHUB_REPOSITORY'];
  const dry = Boolean(env['DRY_RUN']);
  if (!repo) throw new Error('GITHUB_REPOSITORY must be set');
  const root = `${env['GITHUB_API_URL'] ?? 'https://api.github.com'}/repos/${repo}`;
  const write = async (what: string, url: string, method: string, body?: string) => {
    if (dry) {
      console.log(`DRY_RUN: would ${what}${body ? ':\n' + body : '.'}`);
      return;
    }
    await api(url, token, body == null ? { method } : { method, body: JSON.stringify({ body }) });
    console.log(`Done: ${what}.`);
  };
  const mine = (comments: Comment[], marker: string) =>
    comments.find((c) => c.user?.login === BOT && typeof c.body === 'string' && c.body.startsWith(marker));

  let pr: Pull | undefined;
  let comments: Comment[];
  let cls: ChangeClass | null;
  if (mode === 'post') {
    const sha = env['HEAD_SHA'] ?? '';
    const conclusion = env['CONCLUSION'] ?? '';
    if (conclusion === 'cancelled' || conclusion === 'skipped') {
      console.log(`The CI run was ${conclusion}: a later run reports.`);
      return;
    }
    // The pull request whose head is the run's commit (a fork's run lists none in workflow_run.pull_requests).
    const head = `${env['HEAD_OWNER'] ?? ''}:${env['HEAD_BRANCH'] ?? ''}`;
    const open = await apiAll<Pull>(`${root}/pulls?state=open&head=${encodeURIComponent(head)}`, token);
    pr = open.find((p) => p.head.sha === sha);
    if (!pr) {
      console.log(`No open pull request has ${sha} as its head (pushed again since?): nothing to post.`);
      return;
    }
    const file = env['REPORT_FILE'];
    let report: { class: ChangeClass; markdown: string } | null = null;
    if (file && fs.existsSync(file)) {
      report = fs.statSync(file).size <= MAX_FILE ? readReport(fs.readFileSync(file, 'utf8')) : null;
      if (!report) console.log(`::warning title=balance-report::${path.basename(file)} isn't a balance report.`);
    }
    comments = await apiAll<Comment>(`${root}/issues/${String(pr.number)}/comments`, token);
    const old = mine(comments, MARKER);
    cls = report?.class ?? null;
    if (report || old) {
      const body = reportBody(report, { sha, url: env['RUN_URL'] ?? '', conclusion });
      if (old?.body !== body) {
        if (old) await write('update the report comment', `${root}/issues/comments/${String(old.id)}`, 'PATCH', body);
        else await write('post the report comment', `${root}/issues/${String(pr.number)}/comments`, 'POST', body);
      }
    } else {
      console.log('No report, and none posted before: nothing to say.');
    }
  } else if (mode === 'warn') {
    pr = await api<Pull>(`${root}/pulls/${env['PR_NUMBER'] ?? ''}`, token);
    comments = await apiAll<Comment>(`${root}/issues/${String(pr.number)}/comments`, token);
    const old = mine(comments, MARKER);
    cls = old?.body ? classOf(old.body) : null;
  } else {
    throw new Error(`unknown mode "${mode}": post or warn`);
  }

  const warning = mine(comments, WARNING_MARKER);
  if (needsWarning(cls, pr.body)) {
    if (!warning) await write('post the warning', `${root}/issues/${String(pr.number)}/comments`, 'POST', WARNING_BODY);
  } else if (warning) {
    await write('delete the warning', `${root}/issues/comments/${String(warning.id)}`, 'DELETE');
  }
}

if (path.resolve(process.argv[1] ?? '') === import.meta.filename) {
  main(process.argv[2] ?? '', process.env).catch((e: unknown) => {
    console.log(
      `::warning title=balance-report::Couldn't post the balance report (it never blocks the merge): ${e instanceof Error ? e.message : String(e)}`,
    );
  });
}
