const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { ocppServer } = require('../ocppServer');
const { broadcastEvent } = require('../utils');

// Trigger simulated fault on charger (SF-2 & SI-1.3)
router.post('/fault', (req, res) => {
  const { chargerId, faultType = 'Overheating' } = req.body;
  if (!chargerId) return res.status(400).json({ error: 'chargerId required' });

  const prev = db.prepare('SELECT status, current_booking_id FROM chargers WHERE id = ?').get(chargerId);
  if (!prev) return res.status(404).json({ error: 'Charger not found' });

  const now = new Date().toISOString();
  db.prepare('UPDATE chargers SET status = "faulted" WHERE id = ?').run(chargerId);

  const histId = 'HST-' + uuidv4().substring(0, 6).toUpperCase();
  db.prepare(`
    INSERT INTO charger_status_history (id, charger_id, previous_status, new_status, changed_by, reason, timestamp)
    VALUES (?, ?, ?, 'faulted', 'HARDWARE_SIMULATOR', ?, ?)
  `).run(histId, chargerId, prev.status, `Hardware Fault: ${faultType}`, now);

  // Safety Requirement SF-2 notification
  broadcastEvent('CHARGER_FAULT_ALERT', {
    chargerId,
    errorCode: faultType,
    info: `Hardware fault reported: ${faultType}. Charger automatically isolated from search results (SI-1.3).`,
    activeBookingId: prev.current_booking_id
  });

  broadcastEvent('CHARGER_STATUS_CHANGED', {
    chargerId,
    previousStatus: prev.status,
    newStatus: 'faulted',
    reason: faultType
  });

  res.json({ message: `Charger ${chargerId} is now marked FAULTED (${faultType})` });
});

// Clear fault on charger -> return to available
router.post('/clear-fault', (req, res) => {
  const { chargerId } = req.body;
  if (!chargerId) return res.status(400).json({ error: 'chargerId required' });

  const now = new Date().toISOString();
  db.prepare('UPDATE chargers SET status = "available", last_heartbeat = ? WHERE id = ?').run(now, chargerId);

  const histId = 'HST-' + uuidv4().substring(0, 6).toUpperCase();
  db.prepare(`
    INSERT INTO charger_status_history (id, charger_id, previous_status, new_status, changed_by, reason, timestamp)
    VALUES (?, ?, 'faulted', 'available', 'OPERATOR_DISPATCH', 'Technician cleared fault and verified diagnostics', ?)
  `).run(histId, chargerId, now);

  broadcastEvent('CHARGER_STATUS_CHANGED', {
    chargerId,
    previousStatus: 'faulted',
    newStatus: 'available'
  });

  res.json({ message: `Fault cleared for charger ${chargerId}. Status is now Available.` });
});

// Simulate Heartbeat
router.post('/heartbeat', (req, res) => {
  const { chargerId } = req.body;
  const now = new Date().toISOString();
  db.prepare('UPDATE chargers SET last_heartbeat = ? WHERE id = ?').run(now, chargerId);

  res.json({ message: 'Heartbeat registered', chargerId, timestamp: now });
});

// Simulate Heartbeat Timeout (>90s) per Monitor.Status.Timeout
router.post('/simulate-timeout', (req, res) => {
  const { chargerId } = req.body;
  const past = new Date(Date.now() - 100 * 1000).toISOString(); // 100s ago
  db.prepare('UPDATE chargers SET last_heartbeat = ? WHERE id = ?').run(past, chargerId);

  // Run watchdog trigger manually for immediate responsiveness
  const now = new Date().toISOString();
  db.prepare('UPDATE chargers SET status = "out of service" WHERE id = ?').run(chargerId);

  const histId = 'HST-' + uuidv4().substring(0, 6).toUpperCase();
  db.prepare(`
    INSERT INTO charger_status_history (id, charger_id, previous_status, new_status, changed_by, reason, timestamp)
    VALUES (?, ?, 'available', 'out of service', 'WATCHDOG_TIMEOUT', 'Simulated 90s heartbeat loss', ?)
  `).run(histId, chargerId, now);

  broadcastEvent('CHARGER_STATUS_CHANGED', {
    chargerId,
    previousStatus: 'available',
    newStatus: 'out of service',
    reason: 'Heartbeat timeout > 90s'
  });

  broadcastEvent('OPERATOR_NOTIFICATION', {
    title: 'Heartbeat Timeout Alert',
    message: `Charger ${chargerId} failed to report heartbeat for 90s. Status changed to Out of Service.`,
    level: 'warning'
  });

  res.json({ message: `Charger ${chargerId} timed out and marked Out of Service` });
});

// Start live charging simulation with stream of meter values
router.post('/start-session-stream', (req, res) => {
  const { bookingId, chargerId, targetSoc = 85 } = req.body;

  ocppServer.startTelemetrySimulation(bookingId, chargerId, targetSoc, (meter) => {
    // on tick
  }, (finalMeter) => {
    // on complete
  });

  res.json({ message: 'Telemetry simulation started. Streaming live meter ticks over WebSocket.' });
});

router.post('/stop-session-stream', (req, res) => {
  const { bookingId } = req.body;
  ocppServer.stopTelemetrySimulation(bookingId);
  res.json({ message: 'Telemetry simulation stopped.' });
});

module.exports = router;
