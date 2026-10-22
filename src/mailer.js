
require('dotenv').config();
const nodemailer = require('nodemailer');

async function sendWinnerEmail(to, username, auctionTitle, amount) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email skipped: EMAIL_USER/EMAIL_PASS not configured.');
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: `You won: ${auctionTitle}`,
    text:
      `Hello ${username},\n\n` +
      `You won the auction "${auctionTitle}".\n` +
      `Final price: ${Number(amount).toFixed(2)}\n\n` +
      'Thank you for using Auction House.'
  });

  return true;
}

module.exports = { sendWinnerEmail };