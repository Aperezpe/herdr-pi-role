// Launch a project agent (.pi/roles.json) as a standalone interactive pi session:
// the agent's pinned model and thinking level, its job in the system prompt, and
// its read-only desk_state tool (standalone.ts). Extra argv is passed to pi, so
// wrappers support e.g. `agents/review.ts -p "question"`.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { projectRoles } from './project-roles.mjs';

export function runProjectRole(name, args = process.argv.slice(2), cwd = process.cwd()) {
  const def = projectRoles(cwd)[String(name).toLowerCase()];
  if (!def) { console.error(`No project agent "${name}" in ${cwd}/.pi/roles.json.`); process.exit(1); }
  const argv = ['-e', fileURLToPath(new URL('./standalone.ts', import.meta.url))];
  if (def.model) {
    const [provider, ...id] = def.model.split('/');
    argv.push('--provider', provider, '--model', id.join('/'));
  }
  if (def.thinking) argv.push('--thinking', def.thinking);
  const child = spawn('pi', [...argv, ...args], { cwd, stdio: 'inherit', env: { ...process.env, PI_PROJECT_ROLE: def.name } });
  child.on('error', e => { console.error(`Could not start pi: ${e.message}`); process.exit(1); });
  child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 0));
}
