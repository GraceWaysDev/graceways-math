import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCloudflareHandler} from '../cloudflare/handler.mjs';
import {createSqlState} from '../cloudflare/sql-store.mjs';

function storage(db) {
  let depth = 0;
  return {sql: {exec(query, ...values) { const s = db.prepare(query); return s.columns().length ? s.all(...values) : (s.run(...values), []); }},
    transactionSync(fn) {
      const name = 's' + depth++; db.exec('SAVEPOINT ' + name);
      try { const r = fn(); db.exec('RELEASE ' + name); return r; }
      catch (e) { db.exec('ROLLBACK TO ' + name); db.exec('RELEASE ' + name); throw e; }
      finally { depth--; }
    }};
}
const origin = 'https://math.example';
const credentials = {PUBLIC_ORIGIN: origin, JURY_ACCESS_CODE: 'synthetic-access-code-only-0123456789', SESSION_SECRET: 'synthetic-session-secret-0123456789'};
const env = {...credentials, ASSETS: {async fetch(req) { return new Response(new URL(req.url).pathname); }}};
const request = (path, cookie, body) => new Request(origin + path, {method: body ? 'POST' : 'GET', headers: {
  ...(cookie ? {Cookie: cookie} : {}), ...(body ? {Origin: origin, 'Content-Type': 'application/json', 'X-Local-Demo': '1'} : {})
}, ...(body ? {body: JSON.stringify(body)} : {})});
async function login(handle) {
  const r = await handle(new Request(origin + '/login', {method: 'POST', headers: {Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({access: credentials.JURY_ACCESS_CODE})}));
  assert.equal(r.status, 303); assert.match(r.headers.get('Set-Cookie'), /Secure/);
  return r.headers.get('Set-Cookie').split(';')[0];
}
const attempt = {taskId: 'quadratic', steps: ['(x - 2)(x + 2) = 0'], solution: '{-2;2}', scenario: 'positive'};

test('native form login receives same-origin referrer policy; null, missing and foreign Origin remain rejected', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    const handle = createCloudflareHandler(storage(db), env);
    const page = await handle(request('/login'));
    assert.equal(page.headers.get('Referrer-Policy'), 'same-origin');
    assert.match(await page.text(), /form action="\/login" method="post"/);
    for (const originValue of ['null', 'https://foreign.example', undefined]) {
      const headers = {'Content-Type': 'application/x-www-form-urlencoded'};
      if (originValue !== undefined) headers.Origin = originValue;
      const r = await handle(new Request(origin + '/login', {method:'POST', headers,
        body: new URLSearchParams({access: credentials.JURY_ACCESS_CODE})}));
      assert.equal(r.status, 403);
      assert.equal(r.headers.get('Set-Cookie'), null);
    }
    assert.ok(await login(handle));
  } finally { db.close(); }
});

test('Cloudflare SQLite sessions, tickets, immutable approval, restart, logout and historical evidence', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gwmath-cf-')); let db;
  try {
    db = new DatabaseSync(join(dir, 'trial.sqlite'));
    let handle = createCloudflareHandler(storage(db), env);
    assert.equal((await handle(request('/api/tasks'))).status, 401);
    const a = await login(handle), b = await login(handle);
    const savedBefore = await (await handle(request('/api/jury-example', a))).json();
    assert.equal(savedBefore.run.status, 'RELEASED');
    const run = await (await handle(request('/api/run', a, attempt))).json();
    assert.equal(run.status, 'HUMAN_REVIEW'); assert.equal(run.provider, 'LOCAL_SIMULATION');
    assert.equal((await handle(request('/api/runs/' + run.id, b))).status, 400);
    assert.deepEqual(await (await handle(request('/api/runs', b))).json(), {runs: []});
    const shown = await (await handle(request('/api/runs/' + run.id, a))).json();
    db.close(); db = new DatabaseSync(join(dir, 'trial.sqlite'));
    handle = createCloudflareHandler(storage(db), env);
    const review = {id: run.id, bindingHash: run.bindingHash, decision: 'APPROVE', comment: 'Synthetic offline test only', displayToken: shown.displayToken};
    assert.equal((await handle(request('/api/review', b, review))).status, 400);
    assert.equal((await handle(request('/api/review', a, {...review, bindingHash: 'changed'}))).status, 400);
    const approved = await (await handle(request('/api/review', a, review))).json();
    assert.equal(approved.status, 'RELEASED'); assert.equal(approved.nextTask.equation, 'x^2 - 5x + 6 = 0');
    assert.equal((await handle(request('/api/review', a, review))).status, 400);
    const historicalReview = {...review, id: savedBefore.run.id, bindingHash: savedBefore.run.bindingHash};
    assert.equal((await handle(request('/api/review', a, historicalReview))).status, 400);
    db.close(); db = new DatabaseSync(join(dir, 'trial.sqlite'));
    handle = createCloudflareHandler(storage(db), env);
    assert.equal((await (await handle(request('/api/runs/' + run.id, a))).json()).run.status, 'RELEASED');
    assert.deepEqual(await (await handle(request('/api/jury-example', a))).json(), savedBefore);
    const logout = new Request(origin + '/logout', {method: 'POST', headers: {Cookie: a, Origin: origin}});
    assert.equal((await handle(logout)).status, 303);
    assert.equal((await handle(request('/api/runs', a))).status, 401);
    assert.equal((await handle(request('/api/runs', b))).status, 200);
  } finally { db?.close(); rmSync(dir, {recursive: true, force: true}); }
});

test('Cloudflare defaults cannot dispatch live inference, UNKNOWN blocks and origin/asset guards hold', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    const handle = createCloudflareHandler(storage(db), env), cookie = await login(handle);
    const tasks = await (await handle(request('/api/tasks', cookie))).json();
    assert.equal(tasks.liveEnabled, false);
    const unknown = await (await handle(request('/api/run', cookie, {...attempt, steps: ['1/x = 2']}))).json();
    assert.equal(unknown.status, 'INPUT_REVIEW');
    const proof = await (await handle(request('/api/live-status', cookie))).json();
    assert.equal(proof.counts.inference_calls, 0);
    const wrongOrigin = new Request(origin + '/api/run', {method: 'POST', headers: {Origin: 'https://other.example', Cookie: cookie}, body: '{}'});
    assert.equal((await handle(wrongOrigin)).status, 403);
    assert.equal((await handle(new Request('https://other.example/api/tasks'))).status, 421);
    assert.equal((await handle(request('/data/showcase.json', cookie))).status, 404);
    assert.equal((await handle(request('/server.mjs', cookie))).status, 404);
    assert.equal((await handle(request('/app.mjs'))).status, 303);
    assert.equal(await (await handle(request('/app.mjs', cookie))).text(), '/replay-app.mjs');
    const tooLarge = new Request(origin + '/api/run', {method: 'POST', headers: {Cookie: cookie, Origin: origin, 'Content-Type': 'application/json', 'X-Local-Demo': '1'}, body: ' '.repeat(12001)});
    assert.equal((await handle(tooLarge)).status, 400);
  } finally { db.close(); }
});

test('Cloudflare display tickets expire on new display and decisions fail closed after storage tampering', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    const backing = storage(db), state = createSqlState(backing), handle = createCloudflareHandler(backing, env), cookie = await login(handle);
    const run = await (await handle(request('/api/run', cookie, attempt))).json();
    const first = await (await handle(request('/api/runs/' + run.id, cookie))).json();
    await handle(request('/api/runs/' + run.id, cookie));
    const review = {id: run.id, bindingHash: run.bindingHash, decision: 'APPROVE', comment: '', displayToken: first.displayToken};
    assert.equal((await handle(request('/api/review', cookie, review))).status, 400);
    const key = state.entries('run:')[0][0], value = state.get(key); value.value.report.verdict = 'INCORRECT'; state.set(key, value);
    assert.equal((await handle(request('/api/runs/' + run.id, cookie))).status, 400);
  } finally { db.close(); }
});

test('Cloudflare login throttling and expiry persist across handler reconstruction', async () => {
  const db = new DatabaseSync(':memory:'); let now = Date.now();
  try {
    const backing = storage(db); let handle = createCloudflareHandler(backing, env, () => now);
    const cookie = await login(handle);
    for (let i = 0; i < 19; i++) {
      await handle(new Request(origin + '/login', {method: 'POST', headers: {Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded'}, body: 'access=wrong'}));
    }
    handle = createCloudflareHandler(backing, env, () => now);
    assert.equal((await handle(new Request(origin + '/login', {method: 'POST', headers: {Origin: origin}, body: ''}))).status, 429);
    now += 86400001;
    assert.equal((await handle(request('/api/runs', cookie))).status, 401);
    assert.throws(() => createCloudflareHandler(backing, {...env, PUBLIC_ORIGIN: 'http://math.example'}));
    assert.throws(() => createCloudflareHandler(backing, {...env, SESSION_SECRET: ''}));
  } finally { db.close(); }
});

test('Cloudflare assets invoke worker first and runtime dependencies are isolated', () => {
  const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(config.assets.run_worker_first, true);
  assert.deepEqual(config.migrations[0].new_sqlite_classes, ['MathDemo']);
  const code = readFileSync(new URL('../cloudflare/handler.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(code, /node:fs|NEBIUS_API_KEY|persistent-live-budget/);
});
