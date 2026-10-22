// SYLLABUS: Node.js Modules (require / module.exports), Environment variables,
// MongoDB setup, Indexes.
// This file opens ONE connection to MongoDB and shares it with the rest of the app.

require('dotenv').config(); // reads the .env file into process.env
const { MongoClient } = require('mongodb');

// DATA MODEL (3 collections, like the 3 MySQL tables in the Java version):
//
// users    { _id, username, password, role, createdAt }
//            password = salted hash (never plain text), role = BUYER / SELLER / ADMIN
//
// auctions { _id, title, description, sellerId, minPrice, timeLimitSec,
//            lastActivity, status, winnerId, finalPrice, image, createdAt }
//            lastActivity = Date.now() in milliseconds (same idea as the Java version)
//            status = OPEN / CLOSED
//
// bids     { _id, auctionId, bidderId, amount, bidTime }
//
// SYLLABUS: "Relational logic in NoSQL". The collections point to each other with ids:
// auctions.sellerId -> users._id, bids.auctionId -> auctions._id, bids.bidderId -> users._id

let db = null; // the connected database (shared)

// Connects to MongoDB. Called once when the server starts.
async function connectDB() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  db = client.db(process.env.DB_NAME || 'auction_db');

  // SYLLABUS: Indexes
  // unique index: two users can never have the same username
  await db.collection('users').createIndex({ username: 1 }, { unique: true });
  // speeds up "find the highest bid of an auction"
  await db.collection('bids').createIndex({ auctionId: 1, amount: -1 });

  console.log('MongoDB connected: ' + db.databaseName);
  return db;
}

// Gives the connected database to any file that needs it.
function getDB() {
  if (db === null) {
    throw new Error('Database is not connected yet. Call connectDB() first.');
  }
  return db;
}

module.exports = { connectDB, getDB };