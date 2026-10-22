
const { EventEmitter } = require('node:events');
const { getDB } = require('./db');
const { sendWinnerEmail } = require('./mailer');
const { logEvent } = require('./logger');

const auctionEvents = new EventEmitter();
let monitorTimer = null;
let checking = false;

auctionEvents.on('auctionEnded', async function (auction) {
  logEvent('AUCTION_ENDED', {
    auctionId: auction._id.toString(),
    title: auction.title,
    winnerId: auction.winnerId ? auction.winnerId.toString() : null,
    finalPrice: auction.finalPrice
  });

  if (!auction.winnerId) return;

  try {
    const db = getDB();
    const winner = await db.collection('users').findOne({
      _id: auction.winnerId
    });

    // Winner email is sent only if an email field is available.
    if (winner && winner.email) {
      await sendWinnerEmail(
        winner.email,
        winner.username,
        auction.title,
        auction.finalPrice
      );
    }
  } catch (err) {
    console.error('Auction completion notification failed:', err.message);
  }
});

async function checkAuctions() {
  if (checking) return;
  checking = true;

  try {
    const db = getDB();
    const auctions = db.collection('auctions');
    const bids = db.collection('bids');
    const now = Date.now();

    const expired = await auctions.find({
      status: 'OPEN',
      $expr: {
        $lte: [
          { $add: ['$lastActivity', { $multiply: ['$timeLimitSec', 1000] }] },
          now
        ]
      }
    }).toArray();

    for (const auction of expired) {
      const highestBid = await bids.find({
        auctionId: auction._id
      }).sort({ amount: -1, bidTime: 1 }).limit(1).next();

      const winnerId = highestBid ? highestBid.bidderId : null;
      const finalPrice = highestBid ? highestBid.amount : null;

      const result = await auctions.updateOne(
        { _id: auction._id, status: 'OPEN' },
        {
          $set: {
            status: 'CLOSED',
            winnerId,
            finalPrice,
            closedAt: new Date()
          }
        }
      );

      if (result.modifiedCount === 1) {
        auctionEvents.emit('auctionEnded', {
          ...auction,
          status: 'CLOSED',
          winnerId,
          finalPrice
        });
      }
    }
  } catch (err) {
    console.error('Auction monitor error:', err.message);
  } finally {
    checking = false;
  }
}

function startMonitor() {
  if (monitorTimer) return;

  monitorTimer = setInterval(checkAuctions, 1000);
  checkAuctions();
  console.log('Auction monitor started.');
}

function stopMonitor() {
  if (monitorTimer) clearInterval(monitorTimer);
  monitorTimer = null;
}

module.exports = { startMonitor, stopMonitor, auctionEvents };