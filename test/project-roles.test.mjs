import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { projectRoles, fetchState, atPath, digest } from '../project-roles.mjs';
import { spec } from '../host.mjs';
import { roleModels } from '../models.ts';

function projectWith(roles) {
  const cwd = mkdtempSync(join(tmpdir(), 'role-config-'));
  mkdirSync(join(cwd, '.pi'));
  writeFileSync(join(cwd, '.pi', 'roles.json'), JSON.stringify({ roles }));
  return cwd;
}

test('project roles accept only safe names, jobs and local state endpoints', () => {
  const cwd = projectWith({
    Review: { hint: 'Moment review', job: 'Support the review.', model: 'a/fable', thinking: 'medium',
      state: { state: 'https://review.mega.dev.localhost/api/state', loop: 'http://127.0.0.1:4331/api/outline',
        bad: 'https://example.com/api', worse: 'file:///etc/hosts', 'no spaces': 'https://x.localhost/y' } },
    'bad name!': { job: 'nope' },
    Critic: { job: 'cannot shadow a built-in role' },
    empty: { job: '   ' },
  });
  const roles = projectRoles(cwd);
  assert.deepEqual(Object.keys(roles), ['review']);
  assert.equal(roles.review.name, 'Review');
  assert.equal(roles.review.model, 'a/fable');
  assert.deepEqual(Object.keys(roles.review.state), ['state', 'loop']);
  assert.deepEqual(projectRoles(mkdtempSync(join(tmpdir(), 'role-none-'))), {});
});

test('spec falls back to the project job and canonical name; an explicit job wins', () => {
  const project = { review: { name: 'Review', job: 'Support the review.' } };
  assert.equal(spec('review', '', false, project).job, 'Support the review.');
  assert.equal(spec('review', '', false, project).name, 'Review');
  assert.equal(spec('Review', 'Check only approvals.', false, project).job, 'Check only approvals.');
  assert.equal(spec('Other', '', false, project).job, 'Act as Other. Focus only on that job.');
});

test('a pinned project model stays selectable even when scoped models leave it out', () => {
  const main = { provider: 'a', id: 'one', name: 'One' }, pinned = { provider: 'a', id: 'fable', name: 'Fable' };
  const c = { model: main, cwd: '/x', modelRegistry: { getAvailable: () => [main, pinned] }, scopedModels: [{ model: main }] };
  const effort = () => ({ levels: ['low', 'medium'], thinking: 'medium' });
  assert.deepEqual(roleModels(c, effort).map(r => r.ref), ['a/one']);
  assert.deepEqual(roleModels(c, effort, ['a/fable']).map(r => r.ref).sort(), ['a/fable', 'a/one']);
});

test('a huge JSON view digests to a bounded sample; a path reads an exact slice', () => {
  const doc = { schema: 'x/1', position: { part: 'D1.1', beat: 'forget-your-own-tools' },
    parts: Array.from({ length: 40 }, (_, i) => ({ id: 'P' + i, slides: Array.from({ length: 50 }, (_, j) => ({ id: j, words: 'w'.repeat(900) })) })) };
  const text = JSON.stringify(doc);
  const out = digest(text, 10_000);
  assert(out.length <= 10_200 && out.includes('sampled') && out.includes('schema'));
  assert.equal(digest('{"small":true}', 10_000), '{"small":true}');
  assert.deepEqual(atPath(doc, 'position'), doc.position);
  assert.equal(atPath(doc, 'parts.2.id'), 'P2');
  assert.equal(atPath(doc, 'parts.2.missing.x'), undefined);
});

test('fetchState GETs a loopback endpoint, bounds the body, and refuses non-local URLs', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/big') { res.end('x'.repeat(5000)); return; }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: true, path: req.url }));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.deepEqual(JSON.parse(await fetchState(`${base}/api/state`)), { ok: true, path: '/api/state' });
    assert.match(await fetchState(`${base}/big`, 100), /… truncated$/);
    await assert.rejects(fetchState('https://example.com/api'), /local/);
    await assert.rejects(fetchState('file:///etc/hosts'), /local/);
  } finally { server.close(); }
});
