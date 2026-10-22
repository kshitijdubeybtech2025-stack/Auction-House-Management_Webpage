
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { parseCookies, fail } = require('./utils');

const scrypt = promisify(crypto.scrypt);

// College-demo session store.
// Sessions are lost when the server restarts.
const sessions = new Map();

const SESSION_DURATION_MS = 2 * 60 * 60 * 1000;
const COOKIE_NAME = 'auction_session';

// ---------- Password hashing ----------

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');

  const derivedKey = await scrypt(password, salt, 64);

  return `${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' ||
      typeof storedHash !== 'string') {
    return false;
  }

  const parts = storedHash.split(':');

  if (parts.length !== 2 ||
      !/^[a-f0-9]{32}$/.test(parts[0]) ||
      !/^[a-f0-9]{128}$/.test(parts[1])) {
    return false;
  }

  const salt = parts[0];
  const expectedKey = Buffer.from(parts[1], 'hex');

  const actualKey = await scrypt(password, salt, 64);

  return crypto.timingSafeEqual(actualKey, expectedKey);
}

// ---------- Session management ----------

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');

  sessions.set(token, {
    user: {
      id: user._id.toString(),
      username: user.username,
      role: user.role
    },
    expiresAt: Date.now() + SESSION_DURATION_MS
  });

  return token;
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=7200`
  );
}

function getSession(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return null;
  }

  const session = sessions.get(token);

  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return session.user;
}

function destroySession(req, res) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];

  if (token) {
    sessions.delete(token);
  }

  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
  );
}

// ---------- Authentication and roles ----------

function requireAuth(req, res) {
  const user = getSession(req);

  if (!user) {
    fail(res, 401, 'Please log in first.');
    return null;
  }

  return user;
}

function requireRole(req, res, allowedRoles) {
  const user = requireAuth(req, res);

  if (!user) {
    return null;
  }

  if (!allowedRoles.includes(user.role)) {
    fail(res, 403, 'You do not have permission to perform this action.');
    return null;
  }

  return user;
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  setSessionCookie,
  getSession,
  destroySession,
  requireAuth,
  requireRole
};