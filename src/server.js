const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const { createStore } = require('./storage');
const {
  hashPassword,
  randomToken,
  requireBase64Key,
  signValue,
  verifyPassword,
  verifySignedValue
} = require('./security');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_ASSET_BYTES = 12 * 1024 * 1024;
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const LOGIN_WINDOW_MS = 1000 * 60 * 10;
const LOGIN_LIMIT = 8;
const PASTE_WINDOW_MS = 60_000;
const PASTE_LIMIT = 20;

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.mp3', 'audio/mpeg'],
  ['.ico', 'image/x-icon']
]);

const ASSET_TYPES = {
  background: new Map([
    ['image/png', '.png'],
    ['image/jpeg', '.jpg'],
    ['image/webp', '.webp']
  ]),
  music: new Map([
    ['audio/mpeg', '.mp3'],
    ['audio/mp3', '.mp3'],
    ['audio/mp4', '.m4a'],
    ['audio/aac', '.aac'],
    ['audio/flac', '.flac'],
    ['audio/x-flac', '.flac'],
    ['audio/wav', '.wav'],
    ['audio/ogg', '.ogg']
  ])
};

function securityHeaders() {
  return {
    'content-security-policy': [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "media-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "connect-src 'self'",
      "object-src 'none'"
    ].join('; '),
    'cross-origin-opener-policy': 'same-origin',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'x-permitted-cross-domain-policies': 'none'
  };
}

function send(response, status, payload, headers = {}) {
  const body = payload === null ? '' : JSON.stringify(payload);
  response.writeHead(status, {
    ...securityHeaders(),
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    ...headers
  });
  response.end(body);
}

function parseCookies(header) {
  const cookies = new Map();
  if (!header) {
    return cookies;
  }
  for (const part of header.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName) {
      cookies.set(rawName, decodeURIComponent(rawValue.join('=')));
    }
  }
  return cookies;
}

async function parseJsonBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Request body is too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Request body must be JSON');
    error.statusCode = 400;
    throw error;
  }
}

function decodeAssetBody(body, kind) {
  const allowed = ASSET_TYPES[kind];
  const contentType = String(body.contentType || '').toLowerCase().split(';')[0].trim();
  const extension = allowed.get(contentType);
  if (!extension) {
    const error = new Error('Unsupported media type');
    error.statusCode = 415;
    error.code = 'UNSUPPORTED_MEDIA_TYPE';
    throw error;
  }
  if (typeof body.data !== 'string' || body.data.length === 0) {
    const error = new Error('Missing upload data');
    error.statusCode = 400;
    error.code = 'BAD_UPLOAD';
    throw error;
  }
  const buffer = Buffer.from(body.data, 'base64');
  if (!buffer.length || buffer.length > MAX_ASSET_BYTES) {
    const error = new Error('Upload size is invalid');
    error.statusCode = 413;
    error.code = 'UPLOAD_TOO_LARGE';
    throw error;
  }
  return { buffer, contentType, extension };
}

function cookie(name, value, { maxAge = SESSION_TTL_MS / 1000, secure = true } = {}) {
  const pieces = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(maxAge)}`
  ];
  if (secure) {
    pieces.push('Secure');
  }
  return pieces.join('; ');
}

function clearCookie(name, secure) {
  return cookie(name, '', { maxAge: 0, secure });
}

function createSessionManager({ sessionSecret, secureCookies }) {
  const secret = requireBase64Key(sessionSecret, 'PASTEBOARD_SESSION_SECRET');
  const sessions = new Map();

  function create() {
    const token = randomToken(32);
    const session = {
      token,
      csrfToken: randomToken(32),
      expiresAt: Date.now() + SESSION_TTL_MS
    };
    sessions.set(token, session);
    return {
      session,
      header: cookie('pb_session', signValue(token, secret), { secure: secureCookies })
    };
  }

  function read(request) {
    const signedToken = parseCookies(request.headers.cookie).get('pb_session');
    const token = verifySignedValue(signedToken, secret);
    if (!token) {
      return null;
    }
    const session = sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      sessions.delete(token);
      return null;
    }
    session.expiresAt = Date.now() + SESSION_TTL_MS;
    return session;
  }

  function destroy(request) {
    const signedToken = parseCookies(request.headers.cookie).get('pb_session');
    const token = verifySignedValue(signedToken, secret);
    if (token) {
      sessions.delete(token);
    }
    return clearCookie('pb_session', secureCookies);
  }

  return { create, destroy, read };
}

function createLoginLimiter() {
  const attempts = new Map();

  return {
    allow(ip) {
      const now = Date.now();
      const record = attempts.get(ip) || { failures: 0, resetAt: now + LOGIN_WINDOW_MS };
      if (record.resetAt <= now) {
        record.failures = 0;
        record.resetAt = now + LOGIN_WINDOW_MS;
      }
      attempts.set(ip, record);
      return record.failures < LOGIN_LIMIT;
    },
    fail(ip) {
      const now = Date.now();
      const record = attempts.get(ip) || { failures: 0, resetAt: now + LOGIN_WINDOW_MS };
      record.failures += 1;
      attempts.set(ip, record);
    },
    pass(ip) {
      attempts.delete(ip);
    }
  };
}

function clientIp(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || request.socket.remoteAddress || 'unknown';
}

function createPasteLimiter() {
  const attempts = new Map();
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of attempts) {
      if (record.resetAt <= now) attempts.delete(ip);
    }
  }, 120_000);
  cleanupTimer.unref?.();

  return {
    allow(ip) {
      const now = Date.now();
      const record = attempts.get(ip) || { count: 0, resetAt: now + PASTE_WINDOW_MS };
      if (record.resetAt <= now) {
        record.count = 0;
        record.resetAt = now + PASTE_WINDOW_MS;
      }
      record.count += 1;
      attempts.set(ip, record);
      return record.count <= PASTE_LIMIT;
    }
  };
}

function requireAuth(request, response, sessions) {
  const session = sessions.read(request);
  if (!session) {
    send(response, 401, { error: 'AUTH_REQUIRED' });
    return null;
  }
  return session;
}

function requireCsrf(request, response, session) {
  const token = request.headers['x-csrf-token'];
  if (!token || token !== session.csrfToken) {
    send(response, 403, { error: 'CSRF_INVALID' });
    return false;
  }
  return true;
}

async function serveStatic(request, response) {
  const url = new URL(request.url, 'http://127.0.0.1');
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const requestedPath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = path.join(PUBLIC_DIR, requestedPath);
  const relative = path.relative(PUBLIC_DIR, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    response.writeHead(403, securityHeaders());
    response.end('Forbidden');
    return;
  }
  try {
    const stat = await fs.promises.stat(file);
    if (!stat.isFile()) {
      throw new Error('not a file');
    }
    response.writeHead(200, {
      ...securityHeaders(),
      'cache-control': pathname === '/index.html' ? 'no-store' : 'public, max-age=3600',
      'content-type': MIME_TYPES.get(path.extname(file).toLowerCase()) || 'application/octet-stream'
    });
    fs.createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, {
      ...securityHeaders(),
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8'
    });
    response.end('Not found');
  }
}

async function serveUserAsset(request, response, dataDir, sessions) {
  if (!requireAuth(request, response, sessions)) {
    return;
  }
  const url = new URL(request.url, 'http://127.0.0.1');
  const assetName = path.basename(decodeURIComponent(url.pathname.replace('/user-assets/', '')));
  if (!/^(background|music)-[a-f0-9]{16}\.(png|jpg|webp|mp3|m4a|aac|flac|wav|ogg)$/.test(assetName)) {
    response.writeHead(404, securityHeaders());
    response.end('Not found');
    return;
  }
  const file = path.join(dataDir, 'uploads', assetName);
  try {
    const stat = await fs.promises.stat(file);
    if (!stat.isFile()) {
      throw new Error('not a file');
    }
    response.writeHead(200, {
      ...securityHeaders(),
      'cache-control': 'private, max-age=3600',
      'content-type': MIME_TYPES.get(path.extname(file).toLowerCase()) || 'application/octet-stream'
    });
    fs.createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, {
      ...securityHeaders(),
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8'
    });
    response.end('Not found');
  }
}

function createServer(options = {}) {
  const env = options.env || process.env.NODE_ENV || 'production';
  const dataDir = options.dataDir || process.env.PASTEBOARD_DATA_DIR || path.join(__dirname, '..', 'data');
  const passwordHash = options.passwordHash || process.env.PASTEBOARD_PASSWORD_HASH;
  const dataKey = options.dataKey || process.env.PASTEBOARD_DATA_KEY;
  const sessionSecret = options.sessionSecret || process.env.PASTEBOARD_SESSION_SECRET;
  const secureCookies =
    options.secureCookies ??
    (process.env.PASTEBOARD_SECURE_COOKIES
      ? process.env.PASTEBOARD_SECURE_COOKIES === 'true'
      : env !== 'test');

  if (!passwordHash) {
    throw new Error('PASTEBOARD_PASSWORD_HASH is required');
  }

  const store = createStore({
    file: path.join(dataDir, 'pastes.json.enc'),
    dataKey
  });
  const sessions = createSessionManager({ sessionSecret, secureCookies });
  const limiter = createLoginLimiter();
  const pasteLimiter = createPasteLimiter();

  return http.createServer(async (request, response) => {
    const reqStart = Date.now();
    try {
      const url = new URL(request.url, 'http://127.0.0.1');

      if (url.pathname === '/healthz') {
        send(response, 200, { ok: true, service: 'personal-pasteboard' });
        return;
      }

      if (url.pathname.startsWith('/user-assets/') && request.method === 'GET') {
        await serveUserAsset(request, response, dataDir, sessions);
        return;
      }

      if (url.pathname === '/api/session' && request.method === 'GET') {
        const session = sessions.read(request);
        send(response, 200, {
          authenticated: Boolean(session),
          csrfToken: session ? session.csrfToken : null
        });
        return;
      }

      if (url.pathname === '/api/login' && request.method === 'POST') {
        const ip = clientIp(request);
        if (!limiter.allow(ip)) {
          send(response, 429, { error: 'LOGIN_RATE_LIMITED' });
          return;
        }
        const body = await parseJsonBody(request);
        if (!verifyPassword(body.password, passwordHash)) {
          limiter.fail(ip);
          send(response, 401, { error: 'LOGIN_FAILED' });
          return;
        }
        limiter.pass(ip);
        const { session, header } = sessions.create();
        send(
          response,
          200,
          { authenticated: true, csrfToken: session.csrfToken },
          { 'set-cookie': header }
        );
        return;
      }

      if (url.pathname === '/api/logout' && request.method === 'POST') {
        const session = requireAuth(request, response, sessions);
        if (!session || !requireCsrf(request, response, session)) {
          return;
        }
        send(
          response,
          200,
          { authenticated: false },
          { 'set-cookie': sessions.destroy(request) }
        );
        return;
      }

      if (url.pathname === '/api/pastes' && request.method === 'GET') {
        if (!requireAuth(request, response, sessions)) {
          return;
        }
        send(response, 200, { pastes: await store.listPastes() });
        return;
      }

      if (url.pathname === '/api/settings' && request.method === 'GET') {
        if (!requireAuth(request, response, sessions)) {
          return;
        }
        send(response, 200, { settings: await store.getSettings() });
        return;
      }

      const settingsUploadMatch = url.pathname.match(/^\/api\/settings\/(background|music)$/);
      if (settingsUploadMatch && request.method === 'POST') {
        const session = requireAuth(request, response, sessions);
        if (!session || !requireCsrf(request, response, session)) {
          return;
        }
        const kind = settingsUploadMatch[1];
        const asset = decodeAssetBody(await parseJsonBody(request), kind);
        const uploadsDir = path.join(dataDir, 'uploads');
        await fs.promises.mkdir(uploadsDir, { recursive: true });
        const name = `${kind}-${randomToken(8)}${asset.extension}`;
        await fs.promises.writeFile(path.join(uploadsDir, name), asset.buffer, { mode: 0o600 });
        const key = kind === 'background' ? 'backgroundUrl' : 'musicUrl';
        const settings = await store.updateSettings({ [key]: `/user-assets/${name}` });
        send(response, 200, { settings });
        return;
      }

      if (url.pathname === '/api/pastes' && request.method === 'POST') {
        const ip = clientIp(request);
        if (!pasteLimiter.allow(ip)) {
          send(response, 429, { error: 'PASTE_RATE_LIMITED' });
          return;
        }
        const session = requireAuth(request, response, sessions);
        if (!session || !requireCsrf(request, response, session)) {
          return;
        }
        const paste = await store.createPaste(await parseJsonBody(request));
        send(response, 201, { paste });
        return;
      }

      const pasteMatch = url.pathname.match(/^\/api\/pastes\/([0-9a-fA-F-]{36})$/);
      if (pasteMatch && request.method === 'PUT') {
        const session = requireAuth(request, response, sessions);
        if (!session || !requireCsrf(request, response, session)) {
          return;
        }
        const paste = await store.updatePaste(pasteMatch[1], await parseJsonBody(request));
        if (!paste) {
          send(response, 404, { error: 'PASTE_NOT_FOUND' });
          return;
        }
        send(response, 200, { paste });
        return;
      }

      if (pasteMatch && request.method === 'DELETE') {
        const session = requireAuth(request, response, sessions);
        if (!session || !requireCsrf(request, response, session)) {
          return;
        }
        const deleted = await store.deletePaste(pasteMatch[1]);
        send(response, deleted ? 200 : 404, deleted ? { deleted: true } : { error: 'PASTE_NOT_FOUND' });
        return;
      }

      if (!url.pathname.startsWith('/api/')) {
        await serveStatic(request, response);
        return;
      }

      send(response, 404, { error: 'NOT_FOUND' });
    } catch (error) {
      const status = error.statusCode || 500;
      send(response, status, {
        error: error.code || (status >= 500 ? 'SERVER_ERROR' : 'BAD_REQUEST')
      });
    } finally {
      const ms = Date.now() - reqStart;
      const url = new URL(request.url, 'http://127.0.0.1');
      if (url.pathname !== '/healthz') {
        process.stdout.write(JSON.stringify({ t: new Date().toISOString(), m: request.method, p: url.pathname, s: response.statusCode, ms, ip: clientIp(request) }) + '\n');
      }
    }
  });
}

function readRuntimeConfig() {
  const passwordHash = process.env.PASTEBOARD_PASSWORD_HASH;
  if (!passwordHash && process.argv.includes('--hash-password')) {
    const password = process.argv[process.argv.indexOf('--hash-password') + 1] || '';
    process.stdout.write(`${hashPassword(password)}\n`);
    process.exit(0);
  }
  return {
    host: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 3088)
  };
}

if (require.main === module) {
  const { host, port } = readRuntimeConfig();
  const server = createServer();
  server.listen(port, host, () => {
    process.stdout.write(
      JSON.stringify({
        event: 'pasteboard_started',
        host,
        port,
        time: new Date().toISOString()
      }) + '\n'
    );
  });

  function shutdown(signal) {
    process.stdout.write(JSON.stringify({ event: 'shutdown', signal, time: new Date().toISOString() }) + '\n');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000);
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = {
  createServer,
  securityHeaders
};
