const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createServer } = require('../src/server');
const { hashPassword } = require('../src/security');

function dataKey() {
  return Buffer.alloc(32, 9).toString('base64');
}

async function startTestServer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pasteboard-api-'));
  const passwordHash = hashPassword('correct horse battery staple', 'fixed-salt');
  const app = createServer({
    env: 'test',
    dataDir: dir,
    passwordHash,
    dataKey: dataKey(),
    sessionSecret: Buffer.alloc(32, 3).toString('base64'),
    secureCookies: false
  });
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  const { port } = app.address();
  return {
    app,
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => app.close(resolve))
  };
}

async function request(baseUrl, method, route, options = {}) {
  const headers = { ...(options.headers || {}) };
  let body = options.body;
  if (body && typeof body !== 'string') {
    body = JSON.stringify(body);
    headers['content-type'] = 'application/json';
  }
  const response = await fetch(`${baseUrl}${route}`, { method, headers, body });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  return { response, json, cookie: response.headers.get('set-cookie') };
}

async function login(baseUrl) {
  const result = await request(baseUrl, 'POST', '/api/login', {
    body: { password: 'correct horse battery staple' }
  });
  return {
    cookie: result.cookie.split(';')[0],
    csrfToken: result.json.csrfToken
  };
}

test('requires login before paste APIs can be read', async () => {
  const server = await startTestServer();
  try {
    const { response, json } = await request(server.baseUrl, 'GET', '/api/pastes');

    assert.equal(response.status, 401);
    assert.equal(json.error, 'AUTH_REQUIRED');
  } finally {
    await server.close();
  }
});

test('login creates an httpOnly session and CSRF is required for writes', async () => {
  const server = await startTestServer();
  try {
    const login = await request(server.baseUrl, 'POST', '/api/login', {
      body: { password: 'correct horse battery staple' }
    });
    const cookie = login.cookie.split(';')[0];

    assert.equal(login.response.status, 200);
    assert.match(login.cookie, /HttpOnly/);
    assert.equal(login.json.authenticated, true);
    assert.match(login.json.csrfToken, /^[a-f0-9]{64}$/);

    const blocked = await request(server.baseUrl, 'POST', '/api/pastes', {
      headers: { cookie },
      body: { title: 'blocked', content: 'missing csrf' }
    });
    assert.equal(blocked.response.status, 403);
    assert.equal(blocked.json.error, 'CSRF_INVALID');

    const created = await request(server.baseUrl, 'POST', '/api/pastes', {
      headers: { cookie, 'x-csrf-token': login.json.csrfToken },
      body: { title: 'allowed', content: 'stored safely', tags: ['safe'] }
    });

    assert.equal(created.response.status, 201);
    assert.equal(created.json.paste.title, 'allowed');

    const list = await request(server.baseUrl, 'GET', '/api/pastes', {
      headers: { cookie }
    });
    assert.equal(list.response.status, 200);
    assert.equal(list.json.pastes.length, 1);
    assert.equal(list.json.pastes[0].content, 'stored safely');
  } finally {
    await server.close();
  }
});

test('security headers are sent on public pages', async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  } finally {
    await server.close();
  }
});

test('settings can be read and background image can be customized', async () => {
  const server = await startTestServer();
  try {
    const auth = await login(server.baseUrl);
    const initial = await request(server.baseUrl, 'GET', '/api/settings', {
      headers: { cookie: auth.cookie }
    });

    assert.equal(initial.response.status, 200);
    assert.equal(initial.json.settings.backgroundUrl, '/assets/background.png');
    assert.equal(initial.json.settings.musicUrl, '/assets/music.mp3');

    const uploaded = await request(server.baseUrl, 'POST', '/api/settings/background', {
      headers: {
        cookie: auth.cookie,
        'x-csrf-token': auth.csrfToken
      },
      body: {
        filename: 'wallpaper.png',
        contentType: 'image/png',
        data: Buffer.from('fake png bytes').toString('base64')
      }
    });

    assert.equal(uploaded.response.status, 200);
    assert.match(uploaded.json.settings.backgroundUrl, /^\/user-assets\/background-[a-f0-9]+\.png$/);

    const asset = await fetch(`${server.baseUrl}${uploaded.json.settings.backgroundUrl}`, {
      headers: { cookie: auth.cookie }
    });
    assert.equal(asset.status, 200);
    assert.equal(asset.headers.get('content-type'), 'image/png');
    assert.equal(await asset.text(), 'fake png bytes');
  } finally {
    await server.close();
  }
});

test('settings upload rejects unsupported media types', async () => {
  const server = await startTestServer();
  try {
    const auth = await login(server.baseUrl);
    const uploaded = await request(server.baseUrl, 'POST', '/api/settings/music', {
      headers: {
        cookie: auth.cookie,
        'x-csrf-token': auth.csrfToken
      },
      body: {
        filename: 'bad.exe',
        contentType: 'application/x-msdownload',
        data: Buffer.from('not music').toString('base64')
      }
    });

    assert.equal(uploaded.response.status, 415);
    assert.equal(uploaded.json.error, 'UNSUPPORTED_MEDIA_TYPE');
  } finally {
    await server.close();
  }
});

test('settings music upload accepts browser-playable m4a files', async () => {
  const server = await startTestServer();
  try {
    const auth = await login(server.baseUrl);
    const uploaded = await request(server.baseUrl, 'POST', '/api/settings/music', {
      headers: {
        cookie: auth.cookie,
        'x-csrf-token': auth.csrfToken
      },
      body: {
        filename: 'song.m4a',
        contentType: 'audio/mp4',
        data: Buffer.from('m4a bytes').toString('base64')
      }
    });

    assert.equal(uploaded.response.status, 200);
    assert.match(uploaded.json.settings.musicUrl, /^\/user-assets\/music-[a-f0-9]+\.m4a$/);
  } finally {
    await server.close();
  }
});
