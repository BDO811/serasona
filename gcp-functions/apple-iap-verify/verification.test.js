const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function harness({ uid = 'user-a', environment = 'Sandbox', transaction = {}, previous = null, emulator = false } = {}) {
  let stored;
  let verified = false;
  const context = vm.createContext({ exports: {}, Buffer, console: { log() {}, warn() {}, error() {} },
    process: { env: { APPLE_APP_APPLE_ID: '123456', FUNCTIONS_EMULATOR: String(emulator) } },
    __dirname, require(name) {
      if (name === 'path' || name === 'crypto') return require('node:' + name);
      if (name === 'fs') return { readFileSync: () => Buffer.from('mock-root') };
      if (name === 'firebase-admin') return { apps: [{}],
        auth: () => ({ verifyIdToken: async () => ({ uid }) }),
        firestore: () => ({ collection: () => ({ doc: () => ({ uid }) }),
          runTransaction: async fn => fn({ get: async () => ({ exists: !!previous, data: () => ({ subscription: previous }) }),
            set: (ref, value) => { stored = value.subscription; } }) }) };
      if (name === '@apple/app-store-server-library') return {
        Environment: { XCODE: 'Xcode', SANDBOX: 'Sandbox', PRODUCTION: 'Production' },
        SignedDataVerifier: class { async verifyAndDecodeTransaction() {
          verified = true;
          return { productId: 'com.serasona.app.core.monthly', originalTransactionId: 'original-1',
            expiresDate: Date.now() + 3600000, appAccountToken: vm.runInContext(`accountToken(${JSON.stringify(uid)})`, context),
            ...transaction };
        } } };
      throw Error('Unexpected dependency: ' + name);
    } });
  vm.runInContext(fs.readFileSync(__dirname + '/index.js', 'utf8'), context);
  async function request(authorization = 'Bearer fixture') {
    const response = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await context.exports.appleIapVerify({ method: 'POST', headers: { authorization },
      body: { signedTransactionInfo: 'mock-signed-value', environment } }, response);
    return { response, stored, verified };
  }
  return { request };
}

test('hosted verifier refuses Xcode transactions before decoding', async () => {
  const result = await harness({ environment: 'Xcode' }).request();
  assert.equal(result.response.code, 400);
  assert.equal(result.verified, false);
  assert.equal(result.stored, undefined);
});
test('unsigned caller cannot redeem a purchase', async () => {
  assert.equal((await harness().request('')).response.code, 401);
});
test('a signed purchase for the caller grants its mapped plan', async () => {
  const result = await harness().request();
  assert.equal(result.response.code, 200);
  assert.equal(result.stored.planId, 'core');
  assert.equal(result.stored.provider, 'apple');
});
test('copied purchase from another account is rejected', async () => {
  const result = await harness({ transaction: { appAccountToken: 'another-account' } }).request();
  assert.equal(result.response.code, 403);
  assert.equal(result.stored, undefined);
});
test('purchase without an expiration cannot grant unlimited access', async () => {
  const result = await harness({ transaction: { expiresDate: undefined } }).request();
  assert.equal(result.response.code, 400);
  assert.equal(result.stored, undefined);
});
test('unknown products do not grant a plan', async () => {
  const result = await harness({ transaction: { productId: 'another.app.product' } }).request();
  assert.equal(result.response.code, 400);
  assert.equal(result.stored, undefined);
});
test('restoring an older period cannot shorten a newer Apple subscription', async () => {
  const result = await harness({ previous: { provider: 'apple', currentPeriodEnd: Math.floor(Date.now()/1000) + 86400 } }).request();
  assert.equal(result.response.code, 200);
  assert.equal(result.stored, undefined);
});
test('expired Apple purchase does not cancel an active web subscription', async () => {
  const result = await harness({ transaction: { expiresDate: Date.now() - 1000 },
    previous: { provider: 'stripe', status: 'active' } }).request();
  assert.equal(result.response.code, 200);
  assert.equal(result.stored, undefined);
});
