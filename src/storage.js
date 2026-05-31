const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { requireBase64Key } = require('./security');

const EMPTY_DOCUMENT = {
  version: 1,
  pastes: [],
  settings: {
    backgroundUrl: '/assets/background.png',
    musicUrl: '/assets/music.mp3'
  }
};

function nowIso() {
  return new Date().toISOString();
}

function normalizePasteInput(input, existing = {}) {
  const title = String(input.title || '').trim().slice(0, 120) || '未命名';
  const content = String(input.content || '').slice(0, 200000);
  const tags = Array.isArray(input.tags)
    ? input.tags
        .map((tag) => String(tag).trim().slice(0, 32))
        .filter(Boolean)
        .slice(0, 10)
    : [];
  const pinned = Boolean(input.pinned);
  const updatedAt = nowIso();

  return {
    ...existing,
    title,
    content,
    tags,
    pinned,
    updatedAt
  };
}

function encryptDocument(document, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(document), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify(
    {
      version: 1,
      algorithm: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: ciphertext.toString('base64')
    },
    null,
    2
  );
}

function decryptDocument(raw, key) {
  if (!raw || !raw.trim()) {
    return { ...EMPTY_DOCUMENT, pastes: [] };
  }
  const envelope = JSON.parse(raw);
  if (envelope.algorithm !== 'aes-256-gcm') {
    throw new Error('Unsupported encrypted store format');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(envelope.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final()
  ]);
  const document = JSON.parse(plaintext.toString('utf8'));
  if (!document || !Array.isArray(document.pastes)) {
    throw new Error('Encrypted store is not a pasteboard document');
  }
  document.settings = {
    ...EMPTY_DOCUMENT.settings,
    ...(document.settings || {})
  };
  return document;
}

function createStore({ file, dataKey }) {
  const key = requireBase64Key(dataKey, 'PASTEBOARD_DATA_KEY');
  const storeFile = file;
  let document = null;
  let writeQueue = Promise.resolve();

  function load() {
    if (document) {
      return document;
    }
    fs.mkdirSync(path.dirname(storeFile), { recursive: true });
    if (!fs.existsSync(storeFile)) {
      document = { ...EMPTY_DOCUMENT, pastes: [] };
      fs.writeFileSync(storeFile, encryptDocument(document, key), { mode: 0o600 });
      return document;
    }
    document = decryptDocument(fs.readFileSync(storeFile, 'utf8'), key);
    return document;
  }

  async function save() {
    const current = load();
    writeQueue = writeQueue.then(async () => {
      const tempFile = `${storeFile}.${process.pid}.${Date.now()}.tmp`;
      await fs.promises.writeFile(tempFile, encryptDocument(current, key), {
        mode: 0o600
      });
      await fs.promises.rename(tempFile, storeFile);
    });
    return writeQueue;
  }

  return {
    async listPastes() {
      return [...load().pastes].sort((a, b) => {
        if (a.pinned !== b.pinned) {
          return a.pinned ? -1 : 1;
        }
        return b.updatedAt.localeCompare(a.updatedAt);
      });
    },

    async createPaste(input) {
      const createdAt = nowIso();
      const paste = normalizePasteInput(input, {
        id: crypto.randomUUID(),
        createdAt
      });
      load().pastes.push(paste);
      await save();
      return paste;
    },

    async updatePaste(id, input) {
      const current = load();
      const index = current.pastes.findIndex((paste) => paste.id === id);
      if (index === -1) {
        return null;
      }
      current.pastes[index] = normalizePasteInput(input, current.pastes[index]);
      await save();
      return current.pastes[index];
    },

    async deletePaste(id) {
      const current = load();
      const before = current.pastes.length;
      current.pastes = current.pastes.filter((paste) => paste.id !== id);
      if (current.pastes.length === before) {
        return false;
      }
      await save();
      return true;
    },

    async getSettings() {
      return { ...EMPTY_DOCUMENT.settings, ...load().settings };
    },

    async updateSettings(nextSettings) {
      const current = load();
      current.settings = {
        ...EMPTY_DOCUMENT.settings,
        ...(current.settings || {}),
        ...nextSettings
      };
      await save();
      return current.settings;
    }
  };
}

module.exports = {
  createStore,
  decryptDocument,
  encryptDocument
};
