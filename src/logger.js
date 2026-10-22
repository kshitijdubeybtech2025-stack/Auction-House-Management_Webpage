
const fs = require('node:fs');
const path = require('node:path');

const LOG_FILE = path.join(__dirname, '..', 'auction-log.txt');

function logEvent(event, details = {}) {
  const entry = {
    time: new Date().toISOString(),
    event: String(event),
    details
  };

  // Never log passwords, session tokens, or other secrets.
  const line = JSON.stringify(entry) + '\n';

  fs.appendFile(LOG_FILE, line, 'utf8', function (err) {
    if (err) {
      console.error('Could not write application log:', err.message);
      return;
    }

    console.log('[LOG]', entry.time, entry.event);
  });
}

module.exports = { logEvent };