const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'dmat_token';

/**
 * Returns the userId string from the JWT cookie if present and valid,
 * otherwise returns null (guest).
 */
function getUserId(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.userId;
  } catch {
    return null;
  }
}

/**
 * Express middleware. Attaches req.userId (string | null).
 * Never rejects — guests simply get null.
 */
function attachUser(req, _res, next) {
  req.userId = getUserId(req);
  next();
}

module.exports = { COOKIE_NAME, getUserId, attachUser };
