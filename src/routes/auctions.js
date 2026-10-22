
const { ObjectId } = require('mongodb');
const formidable = require('formidable');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { getDB } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const {
  sendJson, fail, readBody, cleanText,
  parseAmount, parseTimeLimit, toObjectId
} = require('../utils');
const { logEvent } = require('../logger');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');

async function handleAuctions(req, res, pathname, url) {
  try {
    const db = getDB();
    const collection = db.collection('auctions');

    if (pathname === '/api/auctions' && req.method === 'GET') {
      const status = url.searchParams.get('status');
      const filter = {};

      if (status === 'OPEN' || status === 'CLOSED') {
        filter.status = status;
      }

      const results = await collection.find(filter)
        .sort({ createdAt: -1 }).limit(100).toArray();

      return sendJson(res, 200, results);
    }

    if (pathname === '/api/auctions/create' && req.method === 'POST') {
      const user = requireRole(req, res, ['SELLER', 'ADMIN']);
      if (!user) return;

      let fields;
      let files;

      const form = formidable({
        uploadDir,
        maxFiles: 1,
        maxFileSize: 5 * 1024 * 1024,
        allowEmptyFiles: false,
        filter: ({ mimetype }) =>
          ['image/jpeg', 'image/png', 'image/webp'].includes(mimetype)
      });

      try {
        await fs.mkdir(uploadDir, { recursive: true });
        [fields, files] = await form.parse(req);
      } catch (err) {
        return fail(res, 400, 'Invalid upload or form data.');
      }

      const title = cleanText(fields.title?.[0]);
      const description = cleanText(fields.description?.[0]);
      const minPrice = parseAmount(fields.minPrice?.[0]);
      const timeLimitSec = parseTimeLimit(fields.timeLimitSec?.[0]);

      if (!title || title.length > 100 ||
          !description || description.length > 3000 ||
          minPrice <= 0 || timeLimitSec < 0) {
        return fail(res, 400, 'Invalid auction details.');
      }

      let image = null;
      const uploaded = files.image?.[0];

      if (uploaded) {
        const extensionByType = {
          'image/jpeg': '.jpg',
          'image/png': '.png',
          'image/webp': '.webp'
        };
        const extension = extensionByType[uploaded.mimetype];

        if (!extension) {
          await fs.unlink(uploaded.filepath).catch(() => {});
          return fail(res, 400, 'Only JPEG, PNG, or WebP images are allowed.');
        }

        const filename = crypto.randomBytes(16).toString('hex') + extension;
        const destination = path.join(uploadDir, filename);
        await fs.rename(uploaded.filepath, destination);
        image = filename;
      }

      const now = Date.now();
      const result = await collection.insertOne({
        title,
        description,
        sellerId: new ObjectId(user.id),
        minPrice,
        timeLimitSec,
        lastActivity: now,
        status: 'OPEN',
        winnerId: null,
        finalPrice: null,
        image,
        createdAt: new Date()
      });

      logEvent('AUCTION_CREATED', {
        auctionId: result.insertedId.toString(),
        seller: user.username
      });

      return sendJson(res, 201, {
        message: 'Auction created.',
        auctionId: result.insertedId.toString()
      });
    }

    const match = pathname.match(/^\/api\/auctions\/([a-f0-9]{24})$/i);

    if (match && req.method === 'GET') {
      const id = toObjectId(match[1]);
      const auction = await collection.findOne({ _id: id });

      if (!auction) return fail(res, 404, 'Auction not found.');

      const highestBid = await db.collection('bids')
        .find({ auctionId: id })
        .sort({ amount: -1, bidTime: 1 })
        .limit(1).next();

      return sendJson(res, 200, { ...auction, highestBid });
    }

    if (match && req.method === 'DELETE') {
      const user = requireAuth(req, res);
      if (!user) return;

      const id = toObjectId(match[1]);
      const auction = await collection.findOne({ _id: id });

      if (!auction) return fail(res, 404, 'Auction not found.');

      if (user.role !== 'ADMIN' &&
          auction.sellerId.toString() !== user.id) {
        return fail(res, 403, 'Not permitted.');
      }

      if (auction.status !== 'OPEN') {
        return fail(res, 400, 'Only open auctions can be deleted.');
      }

      const bidCount = await db.collection('bids').countDocuments({
        auctionId: id
      });

      if (bidCount > 0) {
        return fail(res, 400, 'Auctions with bids cannot be deleted.');
      }

      await collection.deleteOne({ _id: id });

      if (auction.image) {
        await fs.unlink(path.join(uploadDir, auction.image)).catch(() => {});
      }

      logEvent('AUCTION_DELETED', { auctionId: id.toString() });
      return sendJson(res, 200, { message: 'Auction deleted.' });
    }

    return false;
  } catch (err) {
    console.error('Auctions route error:', err);
    if (!res.headersSent) fail(res, 500, 'Internal server error.');
    return true;
  }
}

module.exports = { handleAuctions };