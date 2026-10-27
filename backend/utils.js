const { db } = require('./database');
const { v4: uuidv4 } = require('uuid');

let wsBroadcaster = null;

function setWsBroadcaster(fn) {
  wsBroadcaster = fn;
}

function broadcastEvent(type, data) {
  if (wsBroadcaster) {
    wsBroadcaster({ type, data, timestamp: new Date().toISOString() });
  }
}

function logAudit({ userId, userName, userRole, action, targetType, targetId, details, ipAddress = '127.0.0.1' }) {
  try {
    const id = 'LOG-' + uuidv4().substring(0, 8);
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_name, user_role, action, target_type, target_id, details, ip_address, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, userName, userRole, action, targetType, targetId, details, ipAddress, now);
  } catch (err) {
    console.error('Audit logging error:', err);
  }
}

// Haversine formula for calculating distance between 2 coordinates in kilometers
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10; // 1 decimal place
}

module.exports = {
  setWsBroadcaster,
  broadcastEvent,
  logAudit,
  calculateDistance
};
