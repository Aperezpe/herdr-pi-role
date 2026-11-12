// One authenticated, local connection per fork. No history polling and no global message bus.
import net from 'node:net';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAX = 128 * 1024;
const TIMEOUT = 8_000;
export function wire(socket, handle, onClose) {
  let buffer = '', closed = false;
  const waiting = new Map();
  socket.setEncoding('utf8'); socket.setNoDelay();
  function write(packet) {
    const line = JSON.stringify(packet) + '\n';
    if (closed || socket.destroyed || !socket.writable) throw Error('The agent link is closed.');
    if (Buffer.byteLength(line) > MAX || socket.writableLength > MAX * 2) throw Error('The agent link is full.');
    socket.write(line);
  }
  const api = {
    close: () => socket.destroy(),
    call(method, data) {
      if (waiting.size >= 48) return Promise.reject(Error('Too many pending agent messages.'));
      return new Promise((resolve, reject) => {
        const id = randomUUID();
        const timer = setTimeout(() => { waiting.delete(id); reject(Error('No receipt from the other pane; delivery unknown. Inspect its inbox before resending.')); }, TIMEOUT);
        timer.unref(); waiting.set(id, { resolve, reject, timer });
        try { write({ id, method, data }); } catch (err) { clearTimeout(timer); waiting.delete(id); reject(err); }
      });
    },
  };
  socket.on('data', chunk => {
    try {
      buffer += chunk;
      let i;
      while ((i = buffer.indexOf('\n')) >= 0) {
        if (i > MAX) throw Error('Large frame');
        const row = JSON.parse(buffer.slice(0, i)); buffer = buffer.slice(i + 1);
        if (typeof row.id !== 'string' || row.id.length > 64) throw Error('Invalid frame');
        if (typeof row.method === 'string') {
          try { write({ id: row.id, value: handle(row.method, row.data, api) ?? null }); }
          catch (err) { write({ id: row.id, error: String(err.message || err).slice(0, 300) }); }
        } else if (waiting.has(row.id)) {
          const item = waiting.get(row.id); waiting.delete(row.id); clearTimeout(item.timer);
          if (row.error) item.reject(Error(row.error)); else item.resolve(row.value);
        }
      }
      if (buffer.length > MAX) throw Error('Large partial frame');
    } catch { socket.destroy(); }
  });
  socket.on('error', () => socket.destroy());
  socket.once('close', () => {
    closed = true;
    for (const item of waiting.values()) { clearTimeout(item.timer); item.reject(Error('Link closed before receipt; delivery unknown.')); }
    waiting.clear(); onClose?.();
  });
  return api;
}

// Ticket and launch arguments never go through shell interpolation or into the conversation.
export async function listen(onHello, handle, onClose) {
  const token = randomBytes(32).toString('hex'), sockets = new Set();
  const dir = mkdtempSync(join(tmpdir(), 'pi-role-')), path = join(dir, 'ticket.json');
  let taken = false, closed = false;
  const server = net.createServer(sock => {
    sockets.add(sock); sock.setTimeout(5_000, () => sock.destroy());
    let accepted = false;
    wire(sock, (method, msg, peer) => {
      if (!accepted) {
        if (closed || taken || method !== 'hello' || msg?.token !== token) { sock.destroy(); throw Error('Invalid agent ticket'); }
        const welcome = onHello(msg, peer); // also checks both session identities
        accepted = taken = true; sock.setTimeout(0); server.close(); rmSync(path, { force: true }); return welcome;
      }
      return handle(method, msg);
    }, () => { sockets.delete(sock); if (accepted && !closed) onClose(); });
  });
  server.maxConnections = 5;
  function close() { if (closed) return; closed = true; server.close(); for (const s of sockets) s.destroy(); rmSync(dir, { recursive: true, force: true }); }
  try {
    await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
    return { path, close, ticket(data) { writeFileSync(path, JSON.stringify({ ...data, token, port: server.address().port }), { flag: 'wx', mode: 0o600 }); } };
  } catch (err) { close(); throw err; }
}
export function connect(ticket, handle, onClose) {
  return wire(net.connect(ticket.port, '127.0.0.1'), handle, onClose);
}
