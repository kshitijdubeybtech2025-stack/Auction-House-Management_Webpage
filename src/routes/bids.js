
const { ObjectId } = require('mongodb');
const { getDB } = require('../db');
const { requireRole } = require('../auth');
const {
  sendJson, fail, readBody, parseAmount, toObjectId
} = require('../utils');
const { logEvent } = require('../logger');

async function handleBids(req, res, pathname) {
  try {
    const db = getDB();

    if (pathname === '/api/bids' && req.method === 'POST') {
      const user = requireRole(req, res, ['BUYER']);
      if (!user) return;

      const body = await readBody(req);
      const auctionId = toObjectId(body.auctionId);
      const amount = parseAmount(body.amount);

      if (!auctionId || amount <= 0) {
        return fail(res, 400, 'Valid auction ID and positive bid amount required.');
      }

      // Transaction-like serialized update via conditional filter.
      const auction = await db.collection('auctions').findOne({
        _id: auctionId,
        status: 'OPEN'
      });

      if (!auction) return fail(res, 404, 'Auction is not open.');

      if (auction.sellerId.toString() === user.id) {
        return fail(res, 403, 'You cannot bid on your own auction.');
      }

      const now = Date.now();
      if (now >= auction.lastActivity + auction.timeLimitSec * 1000) {
        return fail(res, 400, 'Auction has expired.');
      }

      const bids = db.collection('bids');
      const highestBid = await bids.find({ auctionId })
        .sort({ amount: -1, bidTime: 1 }).limit(1).next();

      if (highestBid && highestBid.bidderId.toString() === user.id) {
        return fail(res, 400, 'The current highest bidder cannot bid again.');
      }

      const minimumAllowed = highestBid
        ? highestBid.amount
        : auction.minPrice;

      if (amount < minimumAllowed ||
          (highestBid && amount <= highestBid.amount)) {
        return fail(res, 400,
          highestBid
            ? 'Your bid must be strictly higher than the current highest bid.'
            : 'Your first bid must be at least the minimum price.');
      }

      // Re-check the auction state and activity before accepting the bid.
      const updated = await db.collection('auctions').updateOne({
        _id: auctionId,
        status: 'OPEN',
        lastActivity: auction.lastActivity
      }, {
        $set: { lastActivity: now }
      });

      if (updated.modifiedCount !== 1) {
        return fail(res, 409, 'Auction changed. Please try again.');
      }

      await bids.insertOne({
        auctionId,
        bidderId: new ObjectId(user.id),
        amount,
        bidTime: new Date(now)
      });

      logEvent('BID_PLACED', {
        auctionId: auctionId.toString(),
        bidder: user.username,
        amount
      });

      return sendJson(res, 201, {
        message: 'Bid accepted.',
        amount,
        lastActivity: now
      });
    }

    if (pathname === '/api/bids/mine' && req.method === 'GET') {
      const user = requireRole(req, res, ['BUYER']);
      if (!user) return;

      const results = await db.collection('bids').aggregate([
        { $match: { bidderId: new ObjectId(user.id) } },
        { $sort: { bidTime: -1 } },
        {
          $lookup: {
            from: 'auctions',
            localField: 'auctionId',
            foreignField: '_id',
            as: 'auction'
          }
        },
        { $unwind: '$auction' },
        { $limit: 100 }
      ]).toArray();

      return sendJson(res, 200, results);
    }

    return false;
  } catch (err) {
    console.error('Bids route error:', err);
    if (!res.headersSent) fail(res, 500, 'Internal server error.');
    return true;
  }
}

module.exports = { handleBids };