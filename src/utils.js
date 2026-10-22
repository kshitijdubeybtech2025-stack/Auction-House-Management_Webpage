// SYLLABUS: Node.js Modules, HTTP Module (request/response), RegExp,
// Secure form validation and sanitization (preventing script injection).
// Small helper functions used by every route file.

const { ObjectId } = require('mongodb');

// ---------- constants (same numbers as the Java version) ----------
const MIN_TIME_LIMIT = 10;
const MAX_TIME_LIMIT = 3600;
const DEFAULT_TIME_LIMIT = 60;

// ---------- sending answers ----------

// Sends a JSON answer to the browser.
function sendJson(res, status, data) {
  const text = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text)
  });
  res.end(text);
}

// Sends an error message as JSON: { "error": "..." }
function fail(res, status, message) {
  sendJson(res, status, { error: message });
}

// ---------- reading what the browser sent ----------

// Reads the body of a request and turns the JSON text into an object.
// Returns a Promise. It rejects if the body is too big or is not valid JSON.
function readBody(req) {
  return new Promise(function (resolve, reject) {
    let raw = '';
    req.on('data', function (chunk) {
      raw += chunk;
      if (raw.length > 1000000) { // more than about 1 MB: stop
        reject(new Error('Request is too big.'));
        req.destroy();
      }
    });
    req.on('end', function () {
      if (raw.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('Invalid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

// Turns the Cookie header text into an object: "a=1; b=2" -> { a: '1', b: '2' }
function parseCookies(req) {
  const result = {};
  const header = req.headers.cookie;
  if (!header) {
    return result;
  }
  const parts = header.split(';');
  for (let i = 0; i < parts.length; i++) {
    const index = parts[i].indexOf('=');
    if (index > -1) {
      const name = parts[i].substring(0, index).trim();
      const value = parts[i].substring(index + 1).trim();
      result[name] = value;
    }
  }
  return result;
}

// ---------- sanitizing and validating (RegExp) ----------

// SANITIZE: removes < and > and control characters, then trims.
// Without < and > nobody can sneak in a <script> tag.
function cleanText(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/[<>]/g, '').replace(/[\u0000-\u001F]/g, '').trim();
}

// Username: 3 to 20 letters, digits or underscore
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

function isValidUsername(text) {
  return USERNAME_PATTERN.test(text);
}

// Password: 6 to 30 characters
function isValidPassword(text) {
  return typeof text === 'string' && text.length >= 6 && text.length <= 30;
}

// Role chosen at registration (ADMIN can never be chosen)
function isValidRole(text) {
  return text === 'BUYER' || text === 'SELLER';
}

// Reads a money amount. Returns -1 if it is not a positive number.
function parseAmount(value) {
  const number = Number(value);
  if (!isFinite(number) || number <= 0) {
    return -1;
  }
  return Math.round(number * 100) / 100; // keep 2 decimals
}

// Reads the time limit. Empty means the default (60).
// Returns -1 if it is not a whole number from 10 to 3600.
function parseTimeLimit(value) {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_TIME_LIMIT;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < MIN_TIME_LIMIT || number > MAX_TIME_LIMIT) {
    return -1;
  }
  return number;
}

// Turns an id text into a MongoDB ObjectId. Returns null if the text is not a valid id.
function toObjectId(text) {
  if (typeof text === 'string' && ObjectId.isValid(text) && text.length === 24) {
    return new ObjectId(text);
  }
  return null;
}

module.exports = {
  MIN_TIME_LIMIT, MAX_TIME_LIMIT, DEFAULT_TIME_LIMIT,
  sendJson, fail, readBody, parseCookies,
  cleanText, isValidUsername, isValidPassword, isValidRole,
  parseAmount, parseTimeLimit, toObjectId
};