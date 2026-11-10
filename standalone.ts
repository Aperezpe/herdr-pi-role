// A project role (.pi/roles.json) as its own pi session, without a Main link.
// Loaded by run-role.mjs with PI_PROJECT_ROLE naming the role. The session keeps
// pi's normal tools; this adds the role's job and its read-only desk_state tool.
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { projectRoles, readDeskState } from './project-roles.mjs';

export default function standaloneProjectRole(pi: ExtensionAPI) {
  let def: ReturnType<typeof projectRoles>[string] | undefined;
  const lookup = (cwd: string) => projectRoles(cwd)[(process.env.PI_PROJECT_ROLE || '').toLowerCase()];
  pi.registerTool({
    name: 'desk_state', label: 'Connected app state',
    description: 'Fetch the live state of this role’s connected local app (read-only GET). Omit view for every configured endpoint, or name one view. A very large JSON view is returned sampled; pass view plus path (dot/index, e.g. parts.0.slides) for an exact slice. An unreachable endpoint is reported, not guessed.',
    parameters: Type.Object({ view: Type.Optional(Type.String({ maxLength: 32 })), path: Type.Optional(Type.String({ maxLength: 200 })) }),
    execute: async (_id, p, _sig, _update, c) => ({ content: [{ type: 'text', text: await readDeskState(def ?? lookup(c.cwd), p) }] }),
  });
  pi.on('session_start', (_e, c) => {
    def = lookup(c.cwd);
    if (def) c.ui.notify(`${def.name} · ${def.hint}`, 'info');
    else c.ui.notify(`No project role "${process.env.PI_PROJECT_ROLE}" in .pi/roles.json here; desk_state is unavailable.`, 'warning');
  });
  pi.on('before_agent_start', e => {
    if (!def) return;
    const views = Object.keys(def.state);
    e.systemPromptOptions.sections.project_role = `You are ${def.name}, a project role running as its own session. Your job: ${def.job}` +
      (views.length ? `\nBefore answering about the connected app, call desk_state for fresh state (views: ${views.join(', ')}). The fetched state is the evidence; cite its identifiers, and say when the app is unreachable.` : '') +
      (def.vocab ? `\nWhen listing findings: ${def.vocab}` : '');
  });
}
