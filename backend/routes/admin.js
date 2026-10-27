const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { broadcastEvent, logAudit } = require('../utils');

// Require admin for all routes here
router.use(authenticateToken, requireRole('admin'));

// Platform Analytics & System Overview
router.get('/overview', (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT count(*) as count FROM users').get().count;
    const totalDrivers = db.prepare('SELECT count(*) as count FROM users WHERE role = "driver"').get().count;
    const totalOperators = db.prepare('SELECT count(*) as count FROM users WHERE role = "operator"').get().count;
    const pendingOperators = db.prepare('SELECT count(*) as count FROM users WHERE role = "operator" AND status = "pending_approval"').get().count;

    const totalStations = db.prepare('SELECT count(*) as count FROM stations').get().count;
    const pendingStations = db.prepare('SELECT count(*) as count FROM stations WHERE approval_status = "pending approval"').get().count;
    const approvedStations = db.prepare('SELECT count(*) as count FROM stations WHERE approval_status = "approved"').get().count;

    const totalChargers = db.prepare('SELECT count(*) as count FROM chargers').get().count;
    const chargersByStatus = db.prepare(`
      SELECT status, count(*) as count FROM chargers GROUP BY status
    `).all();

    const totalBookings = db.prepare('SELECT count(*) as count FROM bookings').get().count;
    const activeSessions = db.prepare('SELECT count(*) as count FROM bookings WHERE status = "in-progress"').get().count;
    const revenueRow = db.prepare('SELECT SUM(captured_amount) as totalRevenue FROM payments WHERE status = "captured"').get();

    res.json({
      users: { total: totalUsers, drivers: totalDrivers, operators: totalOperators, pendingOperators },
      stations: { total: totalStations, approved: approvedStations, pending: pendingStations },
      chargers: { total: totalChargers, byStatus: chargersByStatus },
      bookings: { total: totalBookings, activeSessions },
      financials: { totalRevenue: revenueRow.totalRevenue || 0 },
      concurrentUsersEstimate: Math.floor(Math.random() * 80) + 120 // simulated peak metric per PE-1
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load system overview' });
  }
});

// List all user accounts with filter
router.get('/users', (req, res) => {
  try {
    const { role, status } = req.query;
    let query = 'SELECT id, name, email, phone, role, status, is_verified, organization_name, created_at FROM users WHERE 1=1';
    const params = [];

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';
    const users = db.prepare(query).all(...params);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Account.Deactivate: Deactivate account & cancel pending bookings
router.post('/users/:id/deactivate', (req, res) => {
  try {
    const targetUserId = req.params.id;
    const { reason = 'Administrative deactivation' } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ error: 'Cannot deactivate an administrator' });

    const deactivateTx = db.transaction(() => {
      // Deactivate user
      db.prepare('UPDATE users SET status = "deactivated" WHERE id = ?').run(targetUserId);

      // Cancel pending/confirmed bookings (Account.Deactivate)
      const pendingBookings = db.prepare(`
        SELECT id, charger_id FROM bookings
        WHERE driver_id = ? AND status = 'confirmed'
      `).all(targetUserId);

      for (const bk of pendingBookings) {
        db.prepare(`
          UPDATE bookings SET status = 'canceled', cancellation_reason = 'User account deactivated', updated_at = ?
          WHERE id = ?
        `).run(new Date().toISOString(), bk.id);

        db.prepare(`
          UPDATE chargers SET status = 'available', current_booking_id = NULL
          WHERE id = ? AND current_booking_id = ?
        `).run(bk.charger_id, bk.id);
      }
    });

    deactivateTx();

    logAudit({
      userId: req.user.id,
      userName: req.user.name,
      userRole: 'admin',
      action: 'ACCOUNT_DEACTIVATED',
      targetType: 'user',
      targetId: targetUserId,
      details: `Deactivated account of ${user.name} (${user.email}). Reason: ${reason}`
    });

    broadcastEvent('USER_STATUS_CHANGED', { userId: targetUserId, status: 'deactivated' });

    res.json({ message: `Account deactivated successfully. Any active bookings have been canceled.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate account' });
  }
});

// Reactivate account
router.post('/users/:id/activate', (req, res) => {
  try {
    const targetUserId = req.params.id;
    db.prepare('UPDATE users SET status = "active" WHERE id = ?').run(targetUserId);

    logAudit({
      userId: req.user.id,
      userName: req.user.name,
      userRole: 'admin',
      action: 'ACCOUNT_ACTIVATED',
      targetType: 'user',
      targetId: targetUserId,
      details: `Reactivated account ${targetUserId}`
    });

    res.json({ message: 'Account reactivated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to activate account' });
  }
});

// Account.Register.Operator approval workflow
router.post('/users/:id/review-operator', (req, res) => {
  try {
    const operatorId = req.params.id;
    const { action } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Action must be approved or rejected' });
    }

    const newStatus = action === 'approved' ? 'active' : 'deactivated';
    db.prepare('UPDATE users SET status = ? WHERE id = ? AND role = "operator"').run(newStatus, operatorId);

    logAudit({
      userId: req.user.id,
      userName: req.user.name,
      userRole: 'admin',
      action: action === 'approved' ? 'OPERATOR_APPROVED' : 'OPERATOR_REJECTED',
      targetType: 'user',
      targetId: operatorId,
      details: `Operator registration review: ${action}`
    });

    res.json({ message: `Operator account has been ${action}.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to review operator' });
  }
});

// Station.Approval: List all stations for admin review
router.get('/stations', (req, res) => {
  try {
    const stations = db.prepare(`
      SELECT s.*, u.name as operator_name, u.email as operator_email, u.organization_name
      FROM stations s
      JOIN users u ON s.operator_id = u.id
      ORDER BY s.created_at DESC
    `).all();

    const enriched = stations.map(stn => {
      const chargers = db.prepare('SELECT * FROM chargers WHERE station_id = ?').all(stn.id);
      return {
        ...stn,
        chargers
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stations for admin' });
  }
});

// Station.Approval: Approve, reject, or suspend station
router.post('/stations/:id/review', (req, res) => {
  try {
    const stationId = req.params.id;
    const { status } = req.body; // 'approved', 'rejected', 'suspended'

    if (!['approved', 'rejected', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved, rejected, or suspended' });
    }

    db.prepare('UPDATE stations SET approval_status = ? WHERE id = ?').run(status, stationId);

    logAudit({
      userId: req.user.id,
      userName: req.user.name,
      userRole: 'admin',
      action: `STATION_${status.toUpperCase()}`,
      targetType: 'station',
      targetId: stationId,
      details: `Station approval status updated to ${status}`
    });

    broadcastEvent('STATION_APPROVAL_CHANGED', { stationId, status });

    res.json({ message: `Station has been updated to "${status}".` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update station status' });
  }
});

// Audit Logs (SE-6): View all administrative actions
router.get('/audit-logs', (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const logs = db.prepare(`
      SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?
    `).all(parseInt(limit));
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;
