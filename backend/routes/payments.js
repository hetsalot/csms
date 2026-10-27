const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { broadcastEvent, logAudit } = require('../utils');

// Invoices list (Driver views own invoices, Operator views their stations' invoices)
router.get('/invoices', authenticateToken, (req, res) => {
  try {
    let query = `
      SELECT i.*, b.booking_number, b.booking_date, s.name as station_name
      FROM invoices i
      JOIN bookings b ON i.booking_id = b.id
      JOIN stations s ON b.station_id = s.id
    `;
    const params = [];

    if (req.user.role === 'driver') {
      query += ' WHERE i.driver_id = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'operator') {
      query += ' WHERE s.operator_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY i.issued_at DESC';

    const invoices = db.prepare(query).all(...params);
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Single invoice detail
router.get('/invoices/:id', authenticateToken, (req, res) => {
  try {
    const invoice = db.prepare(`
      SELECT i.*, b.booking_number, b.booking_date, b.start_time, b.end_time,
             s.name as station_name, s.address as station_address,
             c.name as charger_name, c.connector_type,
             u.name as driver_name, u.email as driver_email, u.phone as driver_phone
      FROM invoices i
      JOIN bookings b ON i.booking_id = b.id
      JOIN stations s ON b.station_id = s.id
      JOIN chargers c ON b.charger_id = c.id
      JOIN users u ON i.driver_id = u.id
      WHERE i.id = ?
    `).get(req.params.id);

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Security SE-5: Driver can only view own invoices
    if (req.user.role === 'driver' && invoice.driver_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to view this invoice' });
    }

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoice details' });
  }
});

// Pay.Refund.Request: Request refund within 7 days stating reason
router.post('/refunds/request', authenticateToken, requireRole('driver'), (req, res) => {
  try {
    const { invoiceId, reason } = req.body;

    if (!invoiceId || !reason) {
      return res.status(400).json({ error: 'Invoice ID and reason for refund are required' });
    }

    const invoice = db.prepare(`
      SELECT i.*, b.station_id, b.created_at as booking_created_at 
      FROM invoices i
      JOIN bookings b ON i.booking_id = b.id
      WHERE i.id = ? AND i.driver_id = ?
    `).get(invoiceId, req.user.id);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.status === 'refunded') {
      return res.status(400).json({ error: 'This invoice has already been refunded' });
    }

    // 7-day cutoff verification (Pay.Refund.Request)
    const issuedDate = new Date(invoice.issued_at);
    const now = new Date();
    const diffDays = (now - issuedDate) / (1000 * 3600 * 24);
    if (diffDays > 7) {
      return res.status(400).json({ error: 'Refunds can only be requested within 7 days of the completed session' });
    }

    // Check if duplicate pending request exists
    const existingReq = db.prepare('SELECT id FROM refund_requests WHERE invoice_id = ? AND status = "pending"').get(invoiceId);
    if (existingReq) {
      return res.status(400).json({ error: 'A refund request is already pending review for this invoice' });
    }

    const refundId = 'REF-' + uuidv4().substring(0, 8).toUpperCase();
    db.prepare(`
      INSERT INTO refund_requests (id, booking_id, invoice_id, driver_id, station_id, reason, amount, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      refundId,
      invoice.booking_id,
      invoiceId,
      req.user.id,
      invoice.station_id,
      reason,
      invoice.total_cost,
      now.toISOString()
    );

    // Update invoice status to disputed
    db.prepare('UPDATE invoices SET status = "disputed" WHERE id = ?').run(invoiceId);

    broadcastEvent('NEW_REFUND_REQUEST', {
      refundId,
      invoiceId,
      stationId: invoice.station_id,
      amount: invoice.total_cost,
      reason
    });

    logAudit({
      userId: req.user.id,
      userName: req.user.name,
      userRole: 'driver',
      action: 'REFUND_REQUESTED',
      targetType: 'refund',
      targetId: refundId,
      details: `Requested refund of ₹${invoice.total_cost} for invoice ${invoiceId}. Reason: ${reason}`
    });

    res.status(201).json({
      message: 'Refund request submitted to Station Operator for review.',
      refundId
    });
  } catch (err) {
    console.error('Refund request error:', err);
    res.status(500).json({ error: 'Failed to submit refund request' });
  }
});

// Pay.Refund.Review: Operator or Admin lists refund requests
router.get('/refunds', authenticateToken, (req, res) => {
  try {
    let query = `
      SELECT r.*, i.energy_delivered_kwh, i.duration_mins,
             b.booking_number, s.name as station_name,
             u.name as driver_name, u.email as driver_email
      FROM refund_requests r
      JOIN invoices i ON r.invoice_id = i.id
      JOIN bookings b ON r.booking_id = b.id
      JOIN stations s ON r.station_id = s.id
      JOIN users u ON r.driver_id = u.id
    `;
    const params = [];

    if (req.user.role === 'operator') {
      query += ' WHERE s.operator_id = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'driver') {
      query += ' WHERE r.driver_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY r.created_at DESC';

    const refunds = db.prepare(query).all(...params);
    res.json(refunds);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch refund requests' });
  }
});

// Pay.Refund.Process: Operator or Admin approves or rejects refund
router.post('/refunds/:id/review', authenticateToken, requireRole('operator', 'admin'), (req, res) => {
  try {
    const refundId = req.params.id;
    const { action, operatorNotes } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Action must be approved or rejected' });
    }

    const refund = db.prepare(`
      SELECT r.*, s.operator_id 
      FROM refund_requests r
      JOIN stations s ON r.station_id = s.id
      WHERE r.id = ?
    `).get(refundId);

    if (!refund) return res.status(404).json({ error: 'Refund request not found' });

    if (req.user.role !== 'admin' && refund.operator_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to review refund for this station' });
    }

    if (refund.status !== 'pending') {
      return res.status(400).json({ error: `Refund request is already ${refund.status}` });
    }

    const now = new Date().toISOString();

    const reviewTx = db.transaction(() => {
      // 1. Update refund request
      db.prepare(`
        UPDATE refund_requests
        SET status = ?, operator_notes = ?, reviewed_at = ?
        WHERE id = ?
      `).run(action, operatorNotes || null, now, refundId);

      if (action === 'approved') {
        // Pay.Refund.Process: Issue refund through payment gateway & update invoice
        db.prepare(`
          UPDATE invoices
          SET status = 'refunded'
          WHERE id = ?
        `).run(refund.invoice_id);

        db.prepare(`
          UPDATE payments
          SET status = 'refunded', refunded_amount = amount
          WHERE booking_id = ?
        `).run(refund.booking_id);
      } else {
        // Rejected: restore invoice status to paid
        db.prepare(`
          UPDATE invoices
          SET status = 'paid'
          WHERE id = ?
        `).run(refund.invoice_id);
      }
    });

    reviewTx();

    broadcastEvent('REFUND_STATUS_UPDATED', {
      refundId,
      status: action,
      driverId: refund.driver_id,
      amount: refund.amount
    });

    logAudit({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: action === 'approved' ? 'REFUND_APPROVED' : 'REFUND_REJECTED',
      targetType: 'refund',
      targetId: refundId,
      details: `${action.toUpperCase()} refund of ₹${refund.amount}. Notes: ${operatorNotes || 'None'}`
    });

    res.json({
      message: action === 'approved' 
        ? 'Refund approved! Payment Gateway refunded the amount to original payment method.' 
        : 'Refund request rejected.',
      status: action
    });
  } catch (err) {
    console.error('Refund review error:', err);
    res.status(500).json({ error: 'Failed to review refund request' });
  }
});

module.exports = router;
