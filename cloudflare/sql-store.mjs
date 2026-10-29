import {hash} from '../src/binding.mjs';

// Synchronous SQLite operations fit the existing workflow's storage contract.
// Cloudflare commits writes before releasing responses through its output gate.
export function createSqlState(storage) {
  const sql = storage.sql;
  sql.exec('CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  return {
    get(key) {
      const row = [...sql.exec('SELECT value FROM state WHERE key = ?', key)][0];
      return row ? JSON.parse(row.value) : null;
    },
    set(key, value) {
      sql.exec('INSERT INTO state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, JSON.stringify(value));
    },
    insert(key, value) {
      sql.exec('INSERT INTO state(key,value) VALUES(?,?)', key, JSON.stringify(value));
    },
    remove(key) { sql.exec('DELETE FROM state WHERE key = ?', key); },
    entries(prefix) {
      return [...sql.exec('SELECT key,value FROM state WHERE substr(key,1,?) = ? ORDER BY key', prefix.length, prefix)]
        .map(r => [r.key, JSON.parse(r.value)]);
    },
    atomic(fn) { return storage.transactionSync(fn); }
  };
}

const validId = id => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id);
const pack = value => ({version: 1, sha256: hash(value), value});
function unpack(envelope) {
  if (!envelope || envelope.version !== 1 || hash(envelope.value) !== envelope.sha256) throw Error('STORAGE_INTEGRITY');
  return structuredClone(envelope.value);
}

export function createSqlRunStore(state, session) {
  if (!/^[a-f0-9]{64}$/.test(session)) throw Error('INVALID_SESSION');
  const prefix = 'run:' + session + ':';
  const key = (id, suffix = '') => {
    if (!validId(id)) throw Error('INVALID_RUN_ID');
    return prefix + id + suffix;
  };
  return Object.freeze({
    save(run) { state.insert(key(run.id), pack(run)); },
    decide(run) {
      state.atomic(() => {
        const original = unpack(state.get(key(run.id)));
        if (original.bindingHash !== run.bindingHash || original.proposalHash !== run.proposalHash) throw Error('STALE_REVIEW');
        state.insert(key(run.id, ':decision'), pack({id: run.id, bindingHash: run.bindingHash,
          proposalHash: run.proposalHash, status: run.status, release: run.release ?? null,
          nextTask: run.nextTask ?? null, decision: run.decision}));
      });
    },
    load(id) {
      const run = unpack(state.get(key(id)));
      if (run.id !== id) throw Error('STORAGE_INTEGRITY');
      const decision = state.get(key(id, ':decision'));
      if (decision) {
        const d = unpack(decision);
        if (d.id !== id || d.bindingHash !== run.bindingHash || d.proposalHash !== run.proposalHash || !['RELEASED','REJECTED'].includes(d.status)) throw Error('STORAGE_INTEGRITY');
        Object.assign(run, d);
      }
      return run;
    },
    list() {
      return state.entries(prefix).filter(([k]) => !k.endsWith(':decision')).map(([k]) => {
        const id = k.slice(prefix.length);
        try { const r = this.load(id); return {id, status: r.status, createdAt: r.createdAt, title: r.task.title, provider: r.provider}; }
        catch { return {id, status: 'STORAGE_INTEGRITY', title: 'Storage integrity failure — locked'}; }
      });
    }
  });
}
