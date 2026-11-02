import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

export const OWNER = 'temporary-role.owner.v1', NOTE = 'temporary-role.note.v1', INBOX = 'temporary-role.inbox.v1';
export const presets = {
  critic: 'Find the most consequential unsupported assumption in the current work. Be specific. If there is none, say so briefly.',
  notes: 'Keep a concise record of decisions, open questions, and who said what in this pane.',
  research: 'Check claims that need evidence. Distinguish what you verified from what is still unknown.',
};
export const safeText = s => String(s ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '').trim();
export function message(s) {
  if (typeof s !== 'string' || !safeText(s) || s.length > 2400) throw Error('Use a nonempty message of at most 2,400 characters.');
  return safeText(s);
}
export function spec(raw, job, work = false) {
  const name = (raw || 'Critic').trim();
  if (!/^[a-z][a-z0-9_-]{0,31}$/i.test(name) || /^(main|all|open|status|inbox|send|stop|help)$/i.test(name)) throw Error('Use a role name such as Critic or release-notes (one word, up to 32 characters).');
  return { name, job: message(job?.trim() || presets[name.toLowerCase()] || `Act as ${name}. Focus only on that job.`), work };
}
export function observation(m) {
  if (m.role !== 'user' && !(m.role === 'assistant' && (m.stopReason === 'stop' || m.stopReason === 'length'))) return;
  const parts = Array.isArray(m.content) ? m.content : [{ type: 'text', text: m.content }];
  if (parts.some(b => b.type === 'toolCall')) return;
  const text = safeText(parts.filter(b => b.type === 'text').map(b => b.text).join('\n'));
  if (text) return { from: m.role, text: text.length > 4000 ? text.slice(0, 3990) + ' [trimmed]' : text };
}
// Close only unresolved calls at the end of this fork, never insert a result for a prior turn.
export function unfinished(branch) {
  const done = new Set();
  for (let i = branch.length - 1; i >= 0; i--) {
    const e = branch[i];
    if (['thinking_level_change','model_change','usage','custom','label','session_info'].includes(e.type)) continue;
    if (e.type !== 'message') break;
    const m = e.message;
    if (m.role === 'toolResult') { done.add(m.toolCallId); continue; }
    if (m.role === 'system') continue;
    if (m.role === 'assistant' && !['error','aborted'].includes(m.stopReason)) return m.content.filter(b => b.type === 'toolCall' && !done.has(b.id));
    break;
  }
  return [];
}
export function fork(SessionManager, ctx, role) {
  const source = ctx.sessionManager, parent = source.getSessionFile(), dir = source.getSessionDir(), leaf = source.getLeafId();
  if (!parent) throw Error('Use a saved Pi conversation, not --no-session.');
  let child;
  if (leaf && existsSync(parent)) {
    child = SessionManager.open(parent, dir, ctx.cwd);
    if (child.getSessionId() !== source.getSessionId() || !child.getEntry(leaf)) throw Error('Main changed before the fork; no pane was opened.');
    if (!child.createBranchedSession(leaf) || child.getSessionFile() === parent) throw Error('Could not create a separate session.');
    for (const call of unfinished(child.getBranch())) child.appendMessage({ role:'toolResult', toolCallId:call.id, toolName:call.name, content:[{type:'text',text:'Not executed in this role fork. Main continues independently.'}], isError:true, timestamp:Date.now() });
  } else {
    if (source.getBranch().some(e => e.type === 'message' && ['user','assistant'].includes(e.message.role))) throw Error('The active conversation is not available on disk.');
    child = SessionManager.create(ctx.cwd, dir, { parentSession: parent });
  }
  const owner = { ...role, id: child.getSessionId(), parent: source.getSessionId(), parentFile: parent };
  child.appendMessage({ role:'user', content:[{type:'text',text:`Temporary role: ${role.name}\n${role.job}`}], timestamp:Date.now() });
  child.appendSessionInfo(role.name); child.appendCustomEntry(OWNER, owner);
  return { owner, file: child.getSessionFile() };
}
export async function jsonExec(pi, bin, args, cwd) {
  const r = await pi.exec(bin, args, { cwd, timeout: 6000 });
  if (r.code !== 0 || r.killed) throw Error(`${bin} ${args[0]} failed: ${safeText(r.stderr || r.stdout || r.code).slice(0, 220)}`);
  return JSON.parse(r.stdout);
}
export async function here(pi, ctx) {
  const t = process.env.HC_TERMINAL_ID;
  if (ctx.mode !== 'tui' || !t) throw Error('/role open needs interactive Pi in a local Herdr app pane.');
  const [term, listing] = await Promise.all([jsonExec(pi, 'hc', ['get', t], ctx.cwd), jsonExec(pi, 'herdr-app', ['ls'], ctx.cwd)]);
  const s = term.labels?.['herdr.space'], tab = term.labels?.['herdr.tab'];
  const matches = listing.spaces.filter(x => !x.machine && s && x.id === s).flatMap(x => x.tabs.filter(v => v.id === tab).flatMap(v => v.terminals.filter(p => p.terminal === t && p.pane)));
  if (term.address !== t || term.state !== 'live' || term.foreground?.pid !== process.pid || matches.length !== 1) throw Error('Cannot match this Pi process to exactly one local Herdr pane. No split was made.');
  return { pane: matches[0].pane, direction: term.cols < 88 && term.rows >= 26 ? 'down' : 'right' };
}
export function roleTools(pi, work) {
  return ['read','grep','find','ls',...(work ? ['write','edit','bash'] : [])].filter(t => pi.getActiveTools().includes(t));
}
export function launchSpec(pi, ctx, file, owner, agentDir) {
  const preserve = new Set(['--no-extensions','-ne','--no-context-files','--no-mcp','--no-approve','-na','--no-skills','-ns','--no-prompt-templates','--no-themes','--offline','--no-builtin-tools']);
  const values = new Set(['--extension','-e','--exclude-tools','--system-prompt','--append-system-prompt']);
  const args = [], original = process.argv.slice(2);
  for (let i=0;i<original.length;i++) { const a=original[i]; if(a==='--')break; if(preserve.has(a))args.push(a); else if(values.has(a)&&original[i+1])args.push(a,original[++i]); }
  const allowed = owner.allowed;
  const extension = fileURLToPath(new URL('./index.ts', import.meta.url));
  args.push('-e', extension, '--no-mcp', '--tools', [...allowed, 'temporary_role'].join(','), '--session-dir', ctx.sessionManager.getSessionDir(), '--session', file);
  if (!ctx.model) throw Error('Select a model in Main before opening a role.');
  args.push('--model', `${ctx.model.provider}/${ctx.model.id}`, '--thinking', pi.getThinkingLevel());
  const preloads = []; for(let i=0;i<process.execArgv.length;i++) if(['--require','-r','--import'].includes(process.execArgv[i])&&process.execArgv[i+1]) preloads.push(process.execArgv[i],process.execArgv[++i]);
  return { allowed, launch: { cwd:ctx.cwd, env:{ PATH:process.env.PATH || '', PI_CODING_AGENT_DIR:agentDir }, argv:[...preloads,process.argv[1],...args] } };
}
export async function split(pi, cwd, parent, path, stillCurrent) {
  const windowState = () => jsonExec(pi, 'herdr-app', ['status'], cwd).catch(() => undefined);
  const before = await windowState();
  const argv = [process.execPath, fileURLToPath(new URL('./launch.mjs', import.meta.url)), path];
  if (!stillCurrent()) throw Error('Main changed before opening the pane.');
  const r = await jsonExec(pi, 'herdr-app', ['do','pane.split',JSON.stringify({ ...parent, argv })], cwd);
  if (!r?.pane || r.pane === parent.pane || !r.terminal) throw Error('Herdr did not confirm a new pane. Inspect the workspace before retrying.');
  // Herdr focuses a new split. Keep typing in Main, but never jump back from another tab or pane.
  if (before?.focused_pane === parent.pane) {
    const after = await windowState();
    if (after?.focused_pane === r.pane && after.space === before.space && after.tab === before.tab) {
      await jsonExec(pi, 'herdr-app', ['do','pane.focus',JSON.stringify({pane:parent.pane})], cwd).catch(() => {});
    }
  }
  return { pane:r.pane, terminal:r.terminal };
}
export const makeNote = (owner, text) => ({ id:randomUUID(), from:owner.id, name:owner.name, text:message(text) });
