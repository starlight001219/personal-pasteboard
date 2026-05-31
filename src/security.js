const crypto = require('node:crypto');

const HASH_ALGORITHM = 'sha256';
const HASH_ITERATIONS = 310000;
const KEY_LENGTH = 32;
const HASH_SEPARATOR = ':';

function base64Url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function requireBase64Key(value, name) {
  let buffer;
  try {
    buffer = Buffer.from(value || '', 'base64');
  } catch {
    buffer = Buffer.alloc(0);
  }
  if (buffer.length !== KEY_LENGTH) {
    throw new Error(`${name} must be a base64-encoded 32-byte key`);
  }
  return buffer;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('base64url')) {
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('Password must be at least 12 characters');
  }
  const digest = crypto
    .pbkdf2Sync(password, salt, HASH_ITERATIONS, KEY_LENGTH, HASH_ALGORITHM)
    .toString('base64url');
  return `pbkdf2_${HASH_ALGORITHM}${HASH_SEPARATOR}${HASH_ITERATIONS}${HASH_SEPARATOR}${salt}${HASH_SEPARATOR}${digest}`;
}

function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || typeof storedHash !== 'string') {
    return false;
  }

  const parts = storedHash.includes(HASH_SEPARATOR) ? storedHash.split(HASH_SEPARATOR) : storedHash.split('$');
  if (parts.length !== 4 || parts[0] !== `pbkdf2_${HASH_ALGORITHM}`) {
    return false;
  }

  const iterations = Number(parts[1]);
  const salt = parts[2];
  const expected = Buffer.from(parts[3], 'base64url');
  if (!Number.isInteger(iterations) || iterations < HASH_ITERATIONS || expected.length !== KEY_LENGTH) {
    return false;
  }

  const actual = crypto.pbkdf2Sync(password, salt, iterations, expected.length, HASH_ALGORITHM);
  return crypto.timingSafeEqual(actual, expected);
}

function signValue(value, secret) {
  const key = Buffer.isBuffer(secret) ? secret : requireBase64Key(secret, 'PASTEBOARD_SESSION_SECRET');
  const signature = crypto.createHmac('sha256', key).update(value).digest('base64url');
  return `${value}.${signature}`;
}

function verifySignedValue(signedValue, secret) {
  if (typeof signedValue !== 'string' || !signedValue.includes('.')) {
    return null;
  }
  const separator = signedValue.lastIndexOf('.');
  const value = signedValue.slice(0, separator);
  const signature = signedValue.slice(separator + 1);
  const expected = signValue(value, secret).slice(separator + 1);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer) ? value : null;
}

module.exports = {
  base64Url,
  hashPassword,
  randomToken,
  requireBase64Key,
  signValue,
  verifyPassword,
  verifySignedValue
};
