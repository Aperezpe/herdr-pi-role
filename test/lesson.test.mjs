// What the MEGA.dev S04E01 lesson shows of /agent, as checks that need no Herdr window.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { savedJob, savedAgents } from '../saved-agents.mjs';
import { noteNotice, NEEDS_HERDR, missingTool } from '../notices.mjs';
import { spec } from '../host.mjs';
import { pickItems } from '../presentation.mjs';
import { roleHelp, commandAction } from '../guide.ts';

const project = files => { const dir = mkdtempSync(join(tmpdir(), 'agent-saved-')); for (const [f, text] of Object.entries(files)) { mkdirSync(join(dir, f, '..'), { recursive: true }); writeFileSync(join(dir, f), text); } return dir; };

test('a saved agent opens with only the Job section of agents/<name>/agent.md, whatever case the name is typed in', () => {
  const dir = project({ 'agents/critic/agent.md': '# Critic\n\n## Job\nCheck the blast radius\nin the files before stating it.\n\n## Use it when\n- always\n', 'agents/critic/expectations.md': '# Critic expectations\n' });
  assert.equal(savedJob(dir, 'critic'), 'Check the blast radius in the files before stating it.');
  assert.equal(savedJob(dir, 'Critic'), savedJob(dir, 'critic'));
  assert.equal(savedJob(dir, 'notes'), undefined);
  assert.equal(savedJob(dir, '../critic'), undefined);
  assert.deepEqual(savedAgents(dir).map(([n]) => n), ['critic']);
  // The saved job replaces the starter job; a typed job is still used as typed.
  assert.equal(spec('critic', savedJob(dir, 'critic')).job, 'Check the blast radius in the files before stating it.');
});
test('an agent.md without a usable job is refused in plain words; a folder with only expectations is not a saved agent', () => {
  const dir = project({ 'agents/empty/agent.md': '# Empty\n\n## Job\n\n## Use it when\n', 'agents/long/agent.md': '## Job\n' + 'x'.repeat(2500), 'agents/draft/expectations.md': '# Draft\n', 'roles/old/role.md': '## Job\nThe old folder name still works.\n' });
  assert.throws(() => savedJob(dir, 'empty'), /needs a "## Job" section/);
  assert.throws(() => savedJob(dir, 'long'), /2,400/);
  assert.equal(savedJob(dir, 'draft'), undefined);
  assert.equal(savedJob(dir, 'old'), 'The old folder name still works.');
  assert(!savedAgents(dir).some(([n]) => n === 'draft'));
});
test('the Repeater check from the lesson is a valid name and job; lowercase critic gets the Critic starter job', () => {
  const r = spec('Repeater', "Repeat Main's last prompt in at most five words, as one numbered finding.");
  assert.equal(r.name, 'Repeater'); assert.match(r.job, /^Repeat Main's last prompt/);
  assert.equal(spec('critic').job, spec('Critic').job); assert.match(spec('critic').job, /blast radius/);
});
test('/agent send main #2 sends only finding 2, and Main shows it as one line from the agent', () => {
  const reply = '# 🟠 C · two issues\n\n1. ❓ Please be more specific with days.\n2. 💥 This might break existing bookings, how should we roll this out?';
  const sent = pickItems(reply, '#2', 'critic');
  assert.equal(sent, 'critic 2: 💥 This might break existing bookings, how should we roll this out?');
  const line = noteNotice('critic', sent);
  assert.match(line, /^from critic · 💥 This might break existing bookings/); assert.match(line, /next prompt/);
  assert.match(noteNotice('critic', 'word '.repeat(60)), /…  \(waits/);
});
test('--help is the guide, and the guide names saved agents and sending one finding; missing Herdr is said plainly', () => {
  assert.equal(commandAction('--help'), 'help'); assert.equal(commandAction('-h'), 'help');
  assert.match(roleHelp({ mode: 'main', inbox: 0, roles: [] }), /agents\/<name>\/agent\.md/);
  const child = roleHelp({ mode: 'role', state: 'watching Main', inbox: 0, roles: [] });
  assert.match(child, /send main #2/); assert.match(child, /↑ then Enter/);
  assert.match(NEEDS_HERDR, /Herdr desktop app/); assert.match(missingTool('hc'), /hc and herdr-app are on PATH/);
});
test('every source file parses (the extension itself needs Pi to load, so this is the check a test run can make)', async () => {
  const { readdirSync } = await import('node:fs'); const { execFileSync } = await import('node:child_process');
  const root = new URL('..', import.meta.url).pathname;
  for (const f of readdirSync(root).filter(f => /\.(ts|mjs)$/.test(f))) execFileSync(process.execPath, ['--check', join(root, f)], { stdio: 'pipe' });
});
