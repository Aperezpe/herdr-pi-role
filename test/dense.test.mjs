import test from 'node:test';
import assert from 'node:assert/strict';
import { responseGuide, items, pickItems } from '../presentation.mjs';
import { requireRoleModel, FAST } from '../models.ts';

// John, 2026-11-07: support roles are dense quick visual support, numbered so small pieces go to Main.
const reply = '# 🟠 C · two decisions skipped\n\n1. ❓ How many **nights**? Main assumed 2\n2. ❓ Which homes does it cover?\n3. ➡️ Ask before writing the rule';

test('every role is told to answer as a verdict plus numbered, emoji-led findings', () => {
  for (const name of ['Critic', 'Notes', 'Research', 'RefundGuard']) {
    const g = responseGuide(name);
    assert.match(g, /quick visual support/);
    assert.match(g, /numbered Markdown list/);
    assert.match(g, /stand alone/);
  }
  assert.match(responseGuide('Critic'), /🟢 A \/ 🟡 B \/ 🟠 C \/ 🔴 D/);
  // John, 2026-11-07: the Critic's three jobs are missing information, blast radius and task size.
  for(const k of [/❓ missing information/,/💥 blast radius/,/✂️ too big for one step/,/Completeness/])assert.match(responseGuide('Critic'),k);
});

test('numbered items are parsed and #N sends just those pieces, labeled with the role', () => {
  assert.deepEqual(items(reply).map(i => i.n), [1, 2, 3]);
  assert.equal(pickItems(reply, '#2', 'Critic'), 'Critic 2: ❓ Which homes does it cover?');
  assert.equal(pickItems(reply, '#1, 3', 'Critic').split('\n').length, 2);
  assert.equal(pickItems(reply, 'Which homes should it cover?', 'Critic'), null, 'ordinary words are sent as written');
  assert.throws(() => pickItems(reply, '#7', 'Critic'), /No item 7/);
  assert.throws(() => pickItems('Plain prose only.', '#1', 'Critic'), /no numbered items/);
});

test('roles default to a fast model; main and exact refs still work', () => {
  const row = (ref, extra = {}) => ({ ref, provider: ref.split('/')[0], id: ref.split('/')[1], name: ref, main: false, thinking: 'low', levels: ['low', 'high'], ...extra });
  const rows = [row('anthropic/claude-sonnet-5-5', { main: true }), row('anthropic/claude-haiku-5-5', { fast: true })];
  assert.equal(requireRoleModel(rows).ref, 'anthropic/claude-haiku-5-5');
  assert.equal(requireRoleModel(rows, 'main').ref, 'anthropic/claude-sonnet-5-5');
  assert.equal(requireRoleModel(rows, 'fast').ref, 'anthropic/claude-haiku-5-5');
  assert.equal(requireRoleModel([rows[0]]).ref, 'anthropic/claude-sonnet-5-5', 'without a fast model, Main’s model');
  assert.ok(FAST.some(re => re.test('provider/luna-1')), 'Luna counts as a fast default');
});
