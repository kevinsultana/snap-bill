const jwt = require('jsonwebtoken');

/**
 * Middleware: verifikasi JWT dari httpOnly cookie 'token'.
 * Inject req.user = { id, email } dari payload JWT.
 */
function verifyToken(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: Invalid or expired token.' });
  }
}

module.exports = { verifyToken };
