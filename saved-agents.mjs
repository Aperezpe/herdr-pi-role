// Saved agents: agents/<name>/agent.md in the project, the folder the lab (herdr-pi-lab) writes and tests.
// Only the text under "## Job" is the agent's job, so the job the lab proved is the job /agent <name> opens.
// The same reading rules as the lab: roles/ and role.md are the folder's and file's names until 2026-11-11.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const NAME = /^[a-z][a-z0-9_-]{0,31}$/i;
const RESERVED = /^(main|all|open|status|inbox|send|stop|help)$/i;

function agentFile(cwd, name) {
  const slug = String(name).trim().toLowerCase();
  if (!NAME.test(slug)) return undefined;
  for (const dir of ['agents', 'roles']) for (const file of ['agent.md', 'role.md']) {
    const path = join(cwd || '.', dir, slug, file);
    if (existsSync(path)) return { path, shown: `${dir}/${slug}/${file}` };
  }
}
/** The saved job for this name, or undefined when the project has no agent.md for it. Throws a plain message for an unusable file. */
export function savedJob(cwd, name) {
  const file = agentFile(cwd, name);
  if (!file) return undefined;
  const text = readFileSync(file.path, 'utf8');
  const m = text.match(/^##\s+Job\s*\n([\s\S]*?)(?=^##\s|(?![\s\S]))/m);
  const body = (m ? m[1] : '').replace(/\s+/g, ' ').trim();
  if (!body) throw Error(`${file.shown} needs a "## Job" section: one paragraph telling the agent what to do.`);
  if (body.length > 2400) throw Error(`${file.shown}: the Job section is ${body.length} characters; /agent accepts up to 2,400.`);
  return body;
}
/** Names of the saved agents in this project, for the /agent menu. */
export function savedAgents(cwd) {
  const out = new Map();
  for (const dir of ['agents', 'roles']) {
    let names = [];
    try { names = readdirSync(join(cwd || '.', dir), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name); } catch { continue; }
    for (const n of names.sort()) if (NAME.test(n) && !RESERVED.test(n) && !out.has(n.toLowerCase()) && agentFile(cwd, n)) out.set(n.toLowerCase(), [n, `Saved agent · ${dir}/${n}/agent.md`]);
  }
  return [...out.values()];
}
