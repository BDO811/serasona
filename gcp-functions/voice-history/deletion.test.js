const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function harness({ valid = true, pages = {} } = {}) {
  const calls = { verifies: [], filters: [], deletes: [], commits: 0 };
  class Firestore {
    collection(name) {
      return { where(field, op, value) {
        calls.filters.push({ name, field, op, value });
        return { limit(count) {
          assert.equal(count, 400);
          return { async get() {
            const ids = (pages[name] || []).shift() || [];
            return { empty: !ids.length, size: ids.length, docs: ids.map(id => ({ ref: { name, id } })) };
          } };
        } };
      } };
    }
    batch() {
      return { delete(ref) { calls.deletes.push(ref); }, async commit() { calls.commits++; } };
    }
  }
  const auth = { async verifyIdToken(token, checkRevoked) {
    calls.verifies.push({ token, checkRevoked });
    if (!valid) throw Error('invalid token');
    return { uid: 'owner' };
  } };
  const context = {
    exports: {}, console: { log() {}, warn() {}, error() {} }, process: { env: {} },
    require(name) {
      if (name === '@google-cloud/firestore') return { Firestore, FieldValue: {} };
      if (name === 'firebase-admin') return { apps: [{}], auth: () => auth };
      if (name === 'crypto') return require('node:crypto');
      throw Error(`Unexpected dependency: ${name}`);
    },
  };
  vm.runInNewContext(fs.readFileSync(__dirname + '/index.js', 'utf8'), context);
  async function request(headers = {}, query = { email: 'someone-else@example.com' }, method = 'DELETE') {
    const response = { statusCode: 200, headers: {},
      set(k, v) { this.headers[k] = v; return this; },
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; } };
    await context.exports.voiceHistory({ method, headers, query }, response);
    return response;
  }
  return { request, calls };
}

test('DELETE requires a bearer token even if an email is supplied', async () => {
  const h = harness();
  assert.equal((await h.request()).statusCode, 401);
  assert.equal(h.calls.filters.length, 0);
});

test('DELETE rejects invalid or revoked credentials without reading rows', async () => {
  const h = harness({ valid: false });
  assert.equal((await h.request({ authorization: 'Bearer invalid' })).statusCode, 401);
  assert.equal(h.calls.verifies[0].checkRevoked, true);
  assert.equal(h.calls.filters.length, 0);
});

test('DELETE uses verified ownership, removes all batches, and ignores supplied email', async () => {
  const h = harness({ pages: { voiceSessions: [['a', 'b'], ['c'], []] } });
  const response = await h.request({ authorization: 'Bearer valid' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.deleted, 3);
  assert.equal(h.calls.commits, 2);
  assert.ok(h.calls.filters.every(f => f.field === 'userKey' && f.op === '==' && f.value === 'uid:owner'));
  assert.equal(h.calls.deletes.length, 3);
});

test('DELETE on an empty account is safely repeatable', async () => {
  const h = harness();
  assert.equal((await h.request({ authorization: 'Bearer valid' })).body.deleted, 0);
  assert.equal(h.calls.commits, 0);
});

test('CORS preflight advertises DELETE without touching data', async () => {
  const h = harness();
  const response = await h.request({}, {}, 'OPTIONS');
  assert.equal(response.statusCode, 204);
  assert.match(response.headers['Access-Control-Allow-Methods'], /DELETE/);
  assert.equal(h.calls.filters.length, 0);
});
