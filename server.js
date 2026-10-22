
require('dotenv').config();

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const { URL } = require('node:url');

const { connectDB } = require('./src/db');
const { handleUsers } = require('./src/routes/users');
const { handleAuctions } = require('./src/routes/auctions');
const { handleBids } = require('./src/routes/bids');
const { startMonitor, stopMonitor } = require('./src/monitor');
const { sendJson, fail } = require('./src/utils');
const { getSession, requireRole } = require('./src/auth');
const { logEvent } = require('./src/logger');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const STATIC_PAGES = new Set([
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/auctions.html',
  '/create.html',
  '/mybids.html',
  '/results.html',
  '/admin.html'
]);

async function serveStatic(req, res, pathname) {
  let baseDir = PUBLIC_DIR;
  let relativePath;

  if (pathname.startsWith('/uploads/')) {
    baseDir = UPLOAD_DIR;
    relativePath = pathname.slice('/uploads/'.length);
  } else {
    if (pathname === '/') pathname = '/index.html';

    if (pathname.endsWith('.html') && !STATIC_PAGES.has(pathname)) {
      return false;
    }

    relativePath = pathname.replace(/^\/+/, '');
  }

  let decoded;
  try {
    decoded = decodeURIComponent(relativePath);
  } catch {
    fail(res, 400, 'Invalid path.');
    return true;
  }

  const resolvedBase = path.resolve(baseDir);
  const resolvedFile = path.resolve(resolvedBase, decoded);

  if (!resolvedFile.startsWith(resolvedBase + path.sep)) {
    fail(res, 403, 'Forbidden.');
    return true;
  }

  try {
    const data = await fs.readFile(resolvedFile);
    const ext = path.extname(resolvedFile).toLowerCase();

    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store'
    });
    res.end(data);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'EISDIR') {
      return false;
    }
    throw err;
  }
}

async function routeRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    if (pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, { status: 'ok' });
    }

    const handledUsers = await handleUsers(req, res, pathname);
    if (handledUsers !== false) return;

    const handledAuctions = await handleAuctions(req, res, pathname, url);
    if (handledAuctions !== false) return;

    const handledBids = await handleBids(req, res, pathname);
    if (handledBids !== false) return;

    if (pathname === '/api/admin/stats' && req.method === 'GET') {
      const user = requireRole(req, res, ['ADMIN']);
      if (!user) return;

      const { getDB } = require('./src/db');
      const db = getDB();

      const [users, auctions, openAuctions, bids] = await Promise.all([
        db.collection('users').countDocuments(),
        db.collection('auctions').countDocuments(),
        db.collection('auctions').countDocuments({ status: 'OPEN' }),
        db.collection('bids').countDocuments()
      ]);

      return sendJson(res, 200, {
        users,
        auctions,
        openAuctions,
        bids
      });
    }

    return fail(res, 404, 'API endpoint not found.');
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return fail(res, 405, 'Method not allowed.');
  }

  const served = await serveStatic(req, res, pathname);
  if (served) return;

  return fail(res, 404, 'Page not found.');
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  try {
    await routeRequest(req, res);
  } catch (err) {
    console.error('Server error:', err);

    if (!res.headersSent) {
      fail(res, 500, 'Internal server error.');
    } else {
      res.destroy();
    }
  }
});

async function startServer() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await connectDB();

  startMonitor();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Auction website running at http://localhost:${PORT}`);
    logEvent('SERVER_STARTED', { port: PORT });
  });
}

function shutdown() {
  console.log('Shutting down auction server...');
  stopMonitor();

  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startServer().catch(err => {
  console.error('Startup failed:', err.message);
  process.exit(1);
});