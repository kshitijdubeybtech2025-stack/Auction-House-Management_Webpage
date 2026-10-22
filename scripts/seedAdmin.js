
require('dotenv').config();

const { connectDB } = require('../src/db');
const { hashPassword } = require('../src/auth');
const {
  isValidUsername,
  isValidPassword
} = require('../src/utils');

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !isValidUsername(username)) {
    throw new Error(
      'Set ADMIN_USERNAME in .env to 3-20 letters, digits, or underscores.'
    );
  }

  if (!password || !isValidPassword(password)) {
    throw new Error(
      'Set ADMIN_PASSWORD in .env to a password of 6-30 characters.'
    );
  }

  const db = await connectDB();
  const users = db.collection('users');

  const existingAdmin = await users.findOne({
    username,
    role: 'ADMIN'
  });

  if (existingAdmin) {
    console.log(`Admin "${username}" already exists. No changes made.`);
    return;
  }

  const existingUser = await users.findOne({ username });

  if (existingUser) {
    throw new Error(
      `Username "${username}" already belongs to a non-admin account. ` +
      'Choose a different ADMIN_USERNAME in .env.'
    );
  }

  const passwordHash = await hashPassword(password);

  await users.insertOne({
    username,
    password: passwordHash,
    role: 'ADMIN',
    createdAt: new Date()
  });

  console.log(`Admin account "${username}" created successfully.`);
}

seedAdmin()
  .catch(function (err) {
    console.error('Admin setup failed:', err.message);
    process.exitCode = 1;
  })
  .finally(function () {
    // This script runs once and then exits.
    setTimeout(function () {
      process.exit(process.exitCode || 0);
    }, 100);
  });