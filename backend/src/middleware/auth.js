const jwt = require('jsonwebtoken');

/**
 * JWT authentication middleware.
 * Reads Bearer token from Authorization header, verifies with JWT_SECRET.
 * Attaches decoded payload to req.user ({ sub: userId }).
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { sub: userId, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

module.exports = authMiddleware;
