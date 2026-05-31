const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createStore } = require('../src/storage');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pasteboard-store-'));
}

function fixedKey() {
  return Buffer.alloc(32, 7).toString('base64');
}

test('store encrypts paste data at rest and reloads it with the same key', async () => {
  const dir = tempDir();
  const file = path.join(dir, 'pastes.json.enc');
  const store = createStore({ file, dataKey: fixedKey() });

  const created = await store.createPaste({
    title: 'server token',
    content: 'super-secret-value',
    tags: ['ops'],
    pinned: true
  });

  assert.equal(created.title, 'server token');
  const raw = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(raw, /super-secret-value/);
  assert.doesNotMatch(raw, /server token/);

  const reloaded = createStore({ file, dataKey: fixedKey() });
  const pastes = await reloaded.listPastes();

  assert.equal(pastes.length, 1);
  assert.equal(pastes[0].content, 'super-secret-value');
  assert.equal(pastes[0].pinned, true);
});

test('store rejects invalid data keys', () => {
  assert.throws(
    () => createStore({ file: path.join(tempDir(), 'pastes.json.enc'), dataKey: 'bad-key' }),
    /PASTEBOARD_DATA_KEY/
  );
});
