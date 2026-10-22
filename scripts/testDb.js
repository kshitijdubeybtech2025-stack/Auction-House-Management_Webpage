// Quick test: can we connect to MongoDB with the settings in .env ?
const { connectDB } = require('../src/db');

connectDB()
  .then(function () {
    console.log('Connection works.');
    process.exit(0);
  })
  .catch(function (err) {
    console.log('Connection failed: ' + err.message);
    process.exit(1);
  });