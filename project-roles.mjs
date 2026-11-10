// Project-defined roles (.pi/roles.json): a named role with its own job, read-only
// local app state endpoints, and an optional pinned model. Example:
//   { "roles": { "Review": {
//       "hint": "Moment review, live state",
//       "job": "Support the review. Fetch desk_state before answering.",
//       "state": { "state": "https://review.example.localhost/api/state" },
//       "model": "provider/model", "thinking": "medium",
//       "vocab": "Items: 🔎 a finding tied to a cue id." } } }
// State endpoints are GET-only and restricted to this machine: *.localhost over
// HTTPS (trusted through the user's portless CA when present) or 127.0.0.1 over HTTP.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { get as httpsGet } from 'node:https';
import { get as httpGet } from 'node:http';

const NAME = /^[a-z][a-z0-9_-]{0,31}$/i;
const LABEL = /^[a-z0-9_-]{1,32}$/i;
const LOCAL = /^(?:https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.localhost(?::\d{1,5})?|http:\/\/127\.0\.0\.1:\d{1,5})\/\S*$/i;
const RESERVED = /^(main|all|open|status|inbox|send|stop|help|historian|critic|notes|research)$/i;

export function projectRoles(cwd) {
  let raw;
  try { raw = JSON.parse(readFileSync(join(cwd || '.', '.pi', 'roles.json'), 'utf8')); } catch { return {}; }
  const out = {};
  for (const [name, r] of Object.entries(raw?.roles ?? {})) {
    if (!NAME.test(name) || RESERVED.test(name) || typeof r?.job !== 'string' || !r.job.trim() || r.job.length > 2400) continue;
    const state = {};
    for (const [label, url] of Object.entries(r.state ?? {}))
      if (LABEL.test(label) && typeof url === 'string' && LOCAL.test(url)) state[label] = url;
    out[name.toLowerCase()] = {
      name, job: r.job.trim(), state,
      model: typeof r.model === 'string' ? r.model : undefined,
      thinking: typeof r.thinking === 'string' ? r.thinking : undefined,
      hint: typeof r.hint === 'string' ? r.hint.slice(0, 80) : 'Project role',
      vocab: typeof r.vocab === 'string' ? r.vocab.slice(0, 600) : '',
    };
  }
  return out;
}

// A dot/index path into a fetched JSON document: 'parts.3.slides' or 'position'.
export function atPath(data, path) {
  let v = data;
  for (const part of String(path).split('.').filter(Boolean)) {
    if (v === null || typeof v !== 'object') return undefined;
    v = Array.isArray(v) && /^\d+$/.test(part) ? v[Number(part)] : v[part];
  }
  return v;
}

function sample(v, depth) {
  if (typeof v === 'string') return v.length > 120 ? v.slice(0, 120) + `… (${v.length} chars)` : v;
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) {
    if (depth <= 0) return `[${v.length} items]`;
    const head = v.slice(0, 3).map(x => sample(x, depth - 1));
    if (v.length > 3) head.push(`… ${v.length - 3} more items`);
    return head;
  }
  if (depth <= 0) return `{${Object.keys(v).join(' ')}}`;
  return Object.fromEntries(Object.entries(v).slice(0, 40).map(([k, x]) => [k, sample(x, depth - 1)]));
}

// Keep a big state document readable instead of cutting JSON mid-structure.
export function digest(text, limit = 120_000) {
  if (text.length <= limit) return text;
  let data;
  try { data = JSON.parse(text); } catch { return text.slice(0, limit) + '\n… truncated'; }
  const note = `This view is ${text.length} bytes, shown sampled (long strings cut, long arrays showing their first items). Pass the path argument (dot/index, e.g. parts.0.slides) for an exact slice.\n`;
  for (let depth = 6; depth >= 0; depth--) {
    const out = JSON.stringify(sample(data, depth), null, 1);
    if (out.length <= limit) return note + out;
  }
  return note + JSON.stringify(sample(data, 0)).slice(0, limit);
}

let ca;
function localCa() {
  if (ca === undefined) { try { ca = readFileSync(join(homedir(), '.portless', 'ca.pem')); } catch { ca = null; } }
  return ca || undefined;
}

// GET one state endpoint. Node does not read the macOS trust store, so named
// *.localhost HTTPS routes (portless) are verified against ~/.portless/ca.pem.
export function fetchState(url, limit = 120_000) {
  if (!LOCAL.test(url)) return Promise.reject(Error('Only local *.localhost or 127.0.0.1 state endpoints are allowed.'));
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = (u.protocol === 'https:' ? httpsGet : httpGet)(u, { ca: u.protocol === 'https:' ? localCa() : undefined, headers: { accept: 'application/json' }, timeout: 10_000 }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(Error(`HTTP ${res.statusCode}`)); }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', d => {
        body += d;
        if (body.length > limit) { req.destroy(); resolve(body.slice(0, limit) + '\n… truncated'); }
      });
      res.on('end', () => resolve(body));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(Error('timed out after 10s')));
    req.on('error', reject);
  });
}
