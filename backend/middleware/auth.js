const jwt = require('jsonwebtoken');
const { db } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'csms-super-secret-key-2026';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    const user = db.prepare('SELECT id, name, email, role, status, is_verified FROM users WHERE id = ?').get(payload.id);
    if (!user) {
      return res.status(403).json({ error: 'User no longer exists' });
    }

    if (user.status === 'deactivated') {
      return res.status(403).json({ error: 'Account has been deactivated by administrator' });
    }

    req.user = user;
    next();
  });
}

function optionalToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (!err && payload) {
      const user = db.prepare('SELECT id, name, email, role, status FROM users WHERE id = ?').get(payload.id);
      if (user && user.status !== 'deactivated') {
        req.user = user;
      }
    }
    next();
  });
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: requires one of [${allowedRoles.join(', ')}] role` });
    }
    next();
  };
}

module.exports = {
  JWT_SECRET,
  authenticateToken,
  optionalToken,
  requireRole
};
