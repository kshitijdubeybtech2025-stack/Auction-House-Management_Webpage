
const { getDB } = require('../db');
const {
  hashPassword,
  verifyPassword,
  createSession,
  setSessionCookie,
  destroySession,
  requireAuth
} = require('../auth');
const {
  sendJson,
  fail,
  readBody,
  cleanText,
  isValidUsername,
  isValidPassword,
  isValidRole
} = require('../utils');
const { logEvent } = require('../logger');

async function handleUsers(req, res, pathname) {
  try {
    const db = getDB();

    // POST /api/users/register
    if (pathname === '/api/users/register' && req.method === 'POST') {
      const body = await readBody(req);
      const username = cleanText(body.username);
      const password = body.password;
      const role = body.role;

      if (!isValidUsername(username)) {
        return fail(res, 400, 'Username must be 3-20 letters, numbers, or underscores.');
      }

      if (!isValidPassword(password)) {
        return fail(res, 400, 'Password must be 6-30 characters.');
      }

      if (!isValidRole(role)) {
        return fail(res, 400, 'Role must be BUYER or SELLER.');
      }

      const passwordHash = await hashPassword(password);

      try {
        const result = await db.collection('users').insertOne({
          username,
          password: passwordHash,
          role,
          createdAt: new Date()
        });

        logEvent('USER_REGISTERED', {
          userId: result.insertedId.toString(),
          username,
          role
        });

        return sendJson(res, 201, {
          message: 'Registration successful. Please log in.'
        });
      } catch (err) {
        if (err.code === 11000) {
          return fail(res, 409, 'Username already exists.');
        }
        throw err;
      }
    }

    // POST /api/users/login
    if (pathname === '/api/users/login' && req.method === 'POST') {
      const body = await readBody(req);
      const username = cleanText(body.username);
      const password = body.password;

      if (!isValidUsername(username) ||
          typeof password !== 'string' ||
          password.length > 1000) {
        return fail(res, 400, 'Invalid username or password format.');
      }

      const user = await db.collection('users').findOne({ username });

      if (!user || !(await verifyPassword(password, user.password))) {
        return fail(res, 401, 'Invalid username or password.');
      }

      const token = createSession(user);
      setSessionCookie(res, token);

      logEvent('USER_LOGIN', {
        userId: user._id.toString(),
        username: user.username
      });

      return sendJson(res, 200, {
        message: 'Login successful.',
        user: {
          id: user._id.toString(),
          username: user.username,
          role: user.role
        }
      });
    }

    // POST /api/users/logout
    if (pathname === '/api/users/logout' && req.method === 'POST') {
      const user = requireAuth(req, res);
      if (!user) return;

      destroySession(req, res);
      logEvent('USER_LOGOUT', { username: user.username });

      return sendJson(res, 200, { message: 'Logged out successfully.' });
    }

    // GET /api/users/me
    if (pathname === '/api/users/me' && req.method === 'GET') {
      const user = requireAuth(req, res);
      if (!user) return;

      return sendJson(res, 200, { user });
    }

    return false;
  } catch (err) {
    console.error('Users route error:', err);
    if (!res.headersSent) {
      fail(res, 500, 'Internal server error.');
    }
    return true;
  }
}

module.exports = { handleUsers };