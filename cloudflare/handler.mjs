import {createHash, createHmac, timingSafeEqual, randomBytes, randomUUID} from 'node:crypto';
import {createWorkflow, tasks} from '../src/workflow.mjs';
import {hash} from '../src/binding.mjs';
import showcase from '../data/showcase.json' with {type: 'json'};
import {createSqlState, createSqlRunStore} from './sql-store.mjs';

const digest = text => createHash('sha256').update(text).digest();
const same = (a,b) => timingSafeEqual(digest(a), digest(b));
const headers = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
};
const login = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GraceWays Math · Jury access</title><link rel="stylesheet" href="/style.css"><main class="login"><h1>GraceWays Math</h1><p>Saved Nebius evidence and interactive simulation. No live AI calls.</p><form action="/login" method="post"><label for="access">Jury access code</label><input id="access" name="access" type="password" autocomplete="current-password" required maxlength="256"><button>Open jury preview</button></form><p>Synthetic inputs only. Sign out on shared computers. Sessions expire after 24 hours. Stored simulation data remains until the operator removes this isolated demo.</p></main></html>`;

async function limitedText(request, limit) {
  if (!request.body) return '';
  const reader = request.body.getReader(), chunks = []; let total = 0;
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > limit) { await reader.cancel(); throw Error('BODY_LIMIT'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  return new TextDecoder('utf-8', {fatal: true}).decode(bytes);
}

// All traffic for this small demo goes through one SQLite-backed object.
// Counters, sessions, review tickets and immutable decisions survive eviction.
export function createCloudflareHandler(storage, env, clock = Date.now) {
  const origin = new URL(env.PUBLIC_ORIGIN);
  const local = env.ALLOW_LOCAL_HTTP === 'true' && origin.protocol === 'http:' && origin.hostname === '127.0.0.1';
  if (origin.origin !== env.PUBLIC_ORIGIN || origin.username || origin.password || (!local && origin.protocol !== 'https:')) throw Error('INVALID_PUBLIC_ORIGIN');
  if (typeof env.JURY_ACCESS_CODE !== 'string' || env.JURY_ACCESS_CODE.length < 32 || typeof env.SESSION_SECRET !== 'string' || env.SESSION_SECRET.length < 32) throw Error('HOST_CONFIGURATION_REQUIRED');
  const state = createSqlState(storage), cookieName = local ? 'gwmath' : '__Host-gwmath';
  const signature = text => createHmac('sha256', env.SESSION_SECRET).update(text).digest('hex');
  const cookie = (value, age) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${local ? '' : '; Secure'}`;
  const send = (status, body, type = 'text/plain', extra = {}) => new Response(type === 'application/json' ? JSON.stringify(body) : body, {
    status, headers: {...headers, ...(!local ? {'Strict-Transport-Security': 'max-age=31536000'} : {}), 'Content-Type': type + '; charset=utf-8', ...extra}
  });
  const redirect = (to, extra = {}) => send(303, '', 'text/plain', {Location: to, ...extra});
  const asset = async (req, path) => {
    const u = new URL(req.url); u.pathname = path; u.search = '';
    const response = await env.ASSETS.fetch(new Request(u, {method: 'GET'}));
    return new Response(response.body, {status: response.status, headers: {...Object.fromEntries(response.headers), ...headers}});
  };

  // Serialize asynchronous bodies and workflow calls as well as SQL mutations.
  let tail = Promise.resolve();
  async function handle(request) {
    try {
      const url = new URL(request.url), path = url.pathname;
      if (url.origin !== origin.origin) return send(421, 'Invalid origin');
      if (!['GET','POST'].includes(request.method)) return send(405, 'Method not allowed');
      if (request.method === 'POST' && request.headers.get('Origin') !== origin.origin) return send(403, 'Origin rejected');
      if (request.method === 'GET' && path === '/healthz') return send(200, 'ok');
      if (request.method === 'GET' && path === '/style.css') return asset(request, '/style.css');
      if (request.method === 'GET' && path === '/login') return send(200, login, 'text/html');
      if (request.method === 'POST' && path === '/login') {
        const limit = state.get('login-window') ?? {at: clock(), count: 0};
        if (clock() - limit.at >= 60000) { limit.at = clock(); limit.count = 0; }
        limit.count++; state.set('login-window', limit);
        if (limit.count > 20) return send(429, 'Please wait before signing in again.');
        if (request.headers.get('Content-Type') !== 'application/x-www-form-urlencoded') return send(415, 'Unsupported form');
        const fields = new URLSearchParams(await limitedText(request, 2048));
        if ([...fields.keys()].join(',') !== 'access' || !same(fields.get('access'), env.JURY_ACCESS_CODE)) return send(401, 'Access denied. Return to /login.');
        const allocated = state.get('allocated-sessions') ?? 0;
        if (allocated >= 500) return send(503, 'Session capacity reached. Contact the owner.');
        const id = randomBytes(32).toString('hex'), expires = clock() + 86400000, payload = id + '.' + expires;
        state.atomic(() => { state.insert('session:' + id, {expires, revoked: false, posts: 0}); state.set('allocated-sessions', allocated + 1); });
        return redirect('/#jury&lang=en', {'Set-Cookie': cookie(payload + '.' + signature(payload), 86400)});
      }
      const token = (request.headers.get('Cookie') ?? '').split(';').map(x => x.trim()).find(x => x.startsWith(cookieName + '='))?.slice(cookieName.length + 1) ?? '';
      const match = /^([a-f0-9]{64})\.(\d{13})\.([a-f0-9]{64})$/.exec(token);
      const session = match ? state.get('session:' + match[1]) : null;
      if (!session || session.revoked || session.expires !== Number(match[2]) || session.expires <= clock() || !same(match[3], signature(match[1] + '.' + match[2]))) {
        return path.startsWith('/api/') ? send(401, {error: 'AUTH_REQUIRED'}, 'application/json') : redirect('/login');
      }
      const id = match[1], store = createSqlRunStore(state, id);
      const flow = createWorkflow({mode: 'LOCAL_SIMULATION', store});
      if (request.method === 'GET') {
        if (path === '/') return asset(request, '/replay.html');
        if (path === '/app.mjs') return asset(request, '/replay-app.mjs');
        if (path === '/api/tasks') return send(200, {tasks, provider: 'LOCAL_SIMULATION', liveEnabled: false, juryExampleAvailable: true}, 'application/json');
        if (path === '/api/jury-example') return send(200, showcase, 'application/json');
        if (path === '/api/runs') return send(200, {runs: flow.list()}, 'application/json');
        if (path === '/api/live-status') return send(200, flow.proof, 'application/json');
        if (/^\/api\/runs\/[a-f0-9-]{36}$/.test(path)) {
          const run = flow.get(path.slice('/api/runs/'.length)), displayToken = randomUUID();
          // One current display ticket per run bounds persistent storage.
          state.set('ticket:' + id + ':' + run.id, {displayToken, digest: hash(run)});
          return send(200, {run, displayToken}, 'application/json');
        }
        return send(404, 'Not found');
      }
      if (path === '/logout') {
        session.revoked = true; state.set('session:' + id, session);
        return redirect('/login', {'Set-Cookie': cookie('', 0)});
      }
      session.posts++; state.set('session:' + id, session);
      if (session.posts > 200) return send(429, {error: 'SESSION_LIMIT'}, 'application/json');
      if (request.headers.get('X-Local-Demo') !== '1' || request.headers.get('Content-Type') !== 'application/json') return send(403, {error: 'REQUEST_REJECTED'}, 'application/json');
      const body = JSON.parse(await limitedText(request, 12000));
      if (path === '/api/run') {
        if (store.list().length >= 100) return send(429, {error: 'SESSION_LIMIT'}, 'application/json');
        return send(200, await flow.run(body), 'application/json');
      }
      if (path === '/api/review') {
        if (!body || Object.keys(body).sort().join(',') !== 'bindingHash,comment,decision,displayToken,id') throw Error('INVALID_REVIEW');
        const ticketKey = 'ticket:' + id + ':' + body.id, ticket = state.get(ticketKey);
        if (!ticket || ticket.displayToken !== body.displayToken || ticket.digest !== hash(flow.get(body.id))) throw Error('STALE_DISPLAY');
        const {displayToken, ...review} = body;
        const result = state.atomic(() => { const r = flow.review(review); state.remove(ticketKey); return r; });
        return send(200, result, 'application/json');
      }
      // Optional TASK draft is a simulation only; persist one request per run.
      if (path === '/api/task-draft') {
        const key = 'task-draft:' + id + ':' + body.id;
        if (state.get(key)) throw Error('ALREADY_REQUESTED');
        state.insert(key, true);
        return send(200, await flow.taskDraft(body), 'application/json');
      }
      return send(404, {error: 'NOT_FOUND'}, 'application/json');
    } catch { return send(400, {error: 'Request rejected. Check inputs, current review and origin.'}, 'application/json'); }
  }
  return request => { const next = tail.then(() => handle(request)); tail = next.catch(() => {}); return next; };
}
