const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { broadcastEvent, logAudit } = require('../utils');

// Check charger slot availability for date and time interval
function isChargerSlotAvailable(chargerId, date, startTime, endTime, excludeBookingId = null) {
  let query = `
    SELECT count(*) as count FROM bookings
    WHERE charger_id = ?
      AND booking_date = ?
      AND status IN ('confirmed', 'in-progress')
      AND (
        (start_time <= ? AND end_time > ?) OR
        (start_time < ? AND end_time >= ?) OR
        (start_time >= ? AND end_time <= ?)
      )
  `;
  const params = [chargerId, date, startTime, startTime, endTime, endTime, startTime, endTime];

  if (excludeBookingId) {
    query += ' AND id != ?';
    params.push(excludeBookingId);
  }

  const result = db.prepare(query).get(...params);
  return result.count === 0;
}

// Book.Date.Cutoff calculation: Check if date & start time is at least 15 minutes in future
function checkBookingCutoff(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  const slotDate = new Date(year, month - 1, day, hours, minutes);
  const now = new Date();

  const diffMs = slotDate.getTime() - now.getTime();
  const diffMinutes = diffMs / (60 * 1000);

  return {
    isPastOrImmediate: diffMinutes < 15,
    diffMinutes
  };
}

// Book.Charger.Select & None: Check availability for slot or suggest alternatives
router.post('/check-availability', authenticateToken, (req, res) => {
  try {
    const { stationId, connectorType, date, startTime, endTime } = req.body;

    if (!stationId || !date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Station, date, and time window are required' });
    }

    // Cutoff check (Book.Date.Cutoff)
    const cutoff = checkBookingCutoff(date, startTime);
    if (cutoff.isPastOrImmediate) {
      // Suggest next available 15-minute slot at least 20 mins from now
      const nextTime = new Date(Date.now() + 20 * 60 * 1000);
      nextTime.setMinutes(Math.ceil(nextTime.getMinutes() / 15) * 15, 0, 0);
      const suggestedTime = `${String(nextTime.getHours()).padStart(2, '0')}:${String(nextTime.getMinutes()).padStart(2, '0')}`;

      return res.status(400).json({
        error: 'Booking must be requested at least 15 minutes before the time window.',
        suggestedNextTime: suggestedTime
      });
    }

    // Find compatible chargers
    let chargerQuery = 'SELECT * FROM chargers WHERE station_id = ? AND status != "faulted" AND status != "out of service"';
    const params = [stationId];

    if (connectorType) {
      chargerQuery += ' AND connector_type = ?';
      params.push(connectorType);
    }

    const chargers = db.prepare(chargerQuery).all(...params);

    const availableChargers = [];
    for (const chg of chargers) {
      if (isChargerSlotAvailable(chg.id, date, startTime, endTime)) {
        availableChargers.push(chg);
      }
    }

    if (availableChargers.length === 0) {
      // Book.Charger.None: offer alternatives
      const otherStations = db.prepare(`
        SELECT s.id, s.name, s.address, s.latitude, s.longitude
        FROM stations s
        WHERE s.id != ? AND s.approval_status = 'approved'
        LIMIT 3
      `).all(stationId);

      return res.status(200).json({
        available: false,
        message: 'No compatible chargers available for this specific time window at this station.',
        alternativeStations: otherStations
      });
    }

    res.json({
      available: true,
      chargers: availableChargers
    });
  } catch (err) {
    console.error('Availability check error:', err);
    res.status(500).json({ error: 'Failed to verify slot availability' });
  }
});

// Book.Done: Create booking with atomic transaction & payment hold
router.post('/', authenticateToken, (req, res) => {
  const {
    stationId,
    chargerId,
    vehicleId,
    bookingDate,
    startTime,
    endTime,
    estimatedDurationMins = 30,
    targetBatteryPercent = 80,
    paymentMethodId
  } = req.body;

  if (!stationId || !chargerId || !bookingDate || !startTime || !endTime) {
    return res.status(400).json({ error: 'Station, charger, date, and time window are required' });
  }

  // 1. Cutoff check
  const cutoff = checkBookingCutoff(bookingDate, startTime);
  if (cutoff.isPastOrImmediate) {
    return res.status(400).json({ error: 'Booking cannot be made less than 15 minutes before the requested time window.' });
  }

  // 2. Availability check
  if (!isChargerSlotAvailable(chargerId, bookingDate, startTime, endTime)) {
    return res.status(400).json({ error: 'The requested charger is already booked for this time window. Please select another slot or charger.' });
  }

  // 3. Charger details & cost estimation (BR-12)
  const charger = db.prepare('SELECT * FROM chargers WHERE id = ?').get(chargerId);
  const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(stationId);
  if (!charger || !station) {
    return res.status(404).json({ error: 'Station or charger not found' });
  }

  // Calculate estimated cost
  let estimatedCost = 0;
  if (charger.pricing_type === 'per_kwh') {
    // estimate kWh = (power_rating * duration / 60) * 0.85
    const estKwh = Math.min((charger.power_rating * (estimatedDurationMins / 60)) * 0.85, 60);
    estimatedCost = Math.round(estKwh * charger.price_rate * 100) / 100;
  } else {
    estimatedCost = Math.round(estimatedDurationMins * charger.price_rate * 100) / 100;
  }
  if (estimatedCost < 100) estimatedCost = 150; // base floor

  // Run atomic transaction (Book.Done & Book.Done.Failure rollback)
  const bookingTx = db.transaction(() => {
    // Next sequential integer booking number
    const maxNumRow = db.prepare('SELECT MAX(booking_number) as maxNum FROM bookings').get();
    const nextBookingNumber = (maxNumRow.maxNum || 1000) + 1;

    const bookingId = 'BK-' + nextBookingNumber;
    const now = new Date().toISOString();
    const paymentId = 'PAY-' + uuidv4().substring(0, 8).toUpperCase();
    const holdId = 'HOLD-' + uuidv4().substring(0, 8).toUpperCase();
    const gatewayTxnId = 'gtw_auth_' + uuidv4().substring(0, 10);

    // Insert booking (status: confirmed)
    db.prepare(`
      INSERT INTO bookings (
        id, booking_number, driver_id, charger_id, station_id, vehicle_id,
        booking_date, start_time, end_time, estimated_duration_mins, target_battery_percent,
        estimated_cost, status, payment_hold_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)
    `).run(
      bookingId,
      nextBookingNumber,
      req.user.id,
      chargerId,
      stationId,
      vehicleId || null,
      bookingDate,
      startTime,
      endTime,
      estimatedDurationMins,
      targetBatteryPercent,
      estimatedCost,
      holdId,
      now,
      now
    );

    // Book.Pay.Hold: record pre-authorized payment
    db.prepare(`
      INSERT INTO payments (id, booking_id, driver_id, amount, method_type, status, gateway_transaction_id, hold_amount, created_at)
      VALUES (?, ?, ?, ?, ?, 'authorized', ?, ?, ?)
    `).run(
      paymentId,
      bookingId,
      req.user.id,
      estimatedCost,
      'credit card',
      gatewayTxnId,
      estimatedCost,
      now
    );

    // Mark charger reserved if immediately today
    const today = new Date().toISOString().split('T')[0];
    if (bookingDate === today) {
      db.prepare(`
        UPDATE chargers SET status = 'reserved', current_booking_id = ? WHERE id = ? AND status = 'available'
      `).run(bookingId, chargerId);
    }

    return {
      bookingId,
      bookingNumber: nextBookingNumber,
      estimatedCost,
      holdId
    };
  });

  try {
    const result = bookingTx();

    // Broadcast live event to Operator Dashboard (CI-3)
    broadcastEvent('NEW_BOOKING', {
      bookingId: result.bookingId,
      bookingNumber: result.bookingNumber,
      stationId,
      chargerId,
      stationName: station.name,
      driverName: req.user.name,
      time: `${bookingDate} ${startTime} - ${endTime}`,
      estimatedCost: result.estimatedCost
    });

    logAudit({
      userId: req.user.id,
      userName: req.user.name,
      userRole: 'driver',
      action: 'BOOKING_CONFIRMED',
      targetType: 'booking',
      targetId: result.bookingId,
      details: `Booking #${result.bookingNumber} confirmed at ${station.name}. Auth hold: ₹${result.estimatedCost}`
    });

    res.status(201).json({
      message: 'Booking confirmed successfully!',
      bookingId: result.bookingId,
      bookingNumber: result.bookingNumber,
      status: 'confirmed',
      stationName: station.name,
      chargerName: charger.name,
      bookingDate,
      timeWindow: `${startTime} - ${endTime}`,
      estimatedCost: result.estimatedCost,
      holdId: result.holdId
    });
  } catch (err) {
    console.error('Book.Done transaction failed:', err);
    res.status(500).json({ error: 'Failed to complete booking. Payment hold rolled back.' });
  }
});

// Book.Cancel (BR-9): Cancel a confirmed booking before charging session starts
router.post('/:id/cancel', authenticateToken, (req, res) => {
  try {
    const bookingId = req.params.id;
    const { reason = 'Driver cancelled voluntarily' } = req.body;

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (req.user.role === 'driver' && booking.driver_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to cancel this booking' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: `Cannot cancel booking with status "${booking.status}". Only confirmed bookings can be cancelled.` });
    }

    const cancelTx = db.transaction(() => {
      const now = new Date().toISOString();

      // Update booking to canceled
      db.prepare(`
        UPDATE bookings 
        SET status = 'canceled', cancellation_reason = ?, updated_at = ?
        WHERE id = ?
      `).run(reason, now, bookingId);

      // Release charger
      db.prepare(`
        UPDATE chargers 
        SET status = 'available', current_booking_id = NULL
        WHERE id = ? AND current_booking_id = ?
      `).run(booking.charger_id, bookingId);

      // Release payment hold (Book.Cancel.Refund / SI-2.3)
      db.prepare(`
        UPDATE payments
        SET status = 'refunded', refunded_amount = hold_amount
        WHERE booking_id = ?
      `).run(bookingId);

      return true;
    });

    cancelTx();

    broadcastEvent('BOOKING_CANCELED', {
      bookingId,
      chargerId: booking.charger_id,
      stationId: booking.station_id,
      reason
    });

    logAudit({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'BOOKING_CANCELED',
      targetType: 'booking',
      targetId: bookingId,
      details: `Booking #${booking.booking_number} canceled. Payment hold released in full.`
    });

    res.json({
      message: 'Booking successfully canceled. Pre-authorization payment hold has been fully released.',
      bookingId,
      status: 'canceled'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// Book.NoShow (BR-10): Trigger no-show fee & release charger
router.post('/:id/no-show', authenticateToken, requireRole('operator', 'admin'), (req, res) => {
  try {
    const bookingId = req.params.id;
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'Only confirmed bookings can be marked as No-Show' });
    }

    const noShowFee = 150.0; // standard no-show fee per BR-10
    const now = new Date().toISOString();

    const noShowTx = db.transaction(() => {
      db.prepare(`
        UPDATE bookings 
        SET status = 'no-show', final_cost = ?, updated_at = ?
        WHERE id = ?
      `).run(noShowFee, now, bookingId);

      db.prepare(`
        UPDATE chargers 
        SET status = 'available', current_booking_id = NULL
        WHERE id = ? AND current_booking_id = ?
      `).run(booking.charger_id, bookingId);

      // Capture partial no-show fee
      db.prepare(`
        UPDATE payments
        SET status = 'captured', captured_amount = ?, captured_at = ?
        WHERE booking_id = ?
      `).run(noShowFee, now, bookingId);

      // Generate invoice for no-show fee
      const invId = 'INV-' + uuidv4().substring(0, 8).toUpperCase();
      db.prepare(`
        INSERT INTO invoices (id, booking_id, driver_id, energy_delivered_kwh, duration_mins, unit_price, pricing_model, subtotal, taxes, total_cost, status, issued_at)
        VALUES (?, ?, ?, 0, 0, ?, 'No-Show Fee', ?, 0, ?, 'paid', ?)
      `).run(invId, bookingId, booking.driver_id, noShowFee, noShowFee, noShowFee, now);
    });

    noShowTx();

    broadcastEvent('BOOKING_NO_SHOW', { bookingId, chargerId: booking.charger_id });

    res.json({ message: 'Booking marked as No-Show. Charger released and fee processed.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process no-show' });
  }
});

// Start Charging Session (Driver or Charger triggers start: Confirmed -> In-Progress)
router.post('/:id/start-charging', authenticateToken, (req, res) => {
  try {
    const bookingId = req.params.id;
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: `Cannot start session. Booking status is ${booking.status}` });
    }

    const now = new Date().toISOString();

    db.prepare(`UPDATE bookings SET status = 'in-progress', updated_at = ? WHERE id = ?`).run(now, bookingId);
    db.prepare(`UPDATE chargers SET status = 'charging', current_booking_id = ? WHERE id = ?`).run(bookingId, booking.charger_id);

    // Status history
    const histId = 'HST-' + uuidv4().substring(0, 6).toUpperCase();
    db.prepare(`
      INSERT INTO charger_status_history (id, charger_id, previous_status, new_status, changed_by, reason, timestamp)
      VALUES (?, ?, 'reserved', 'charging', ?, 'Charging session started', ?)
    `).run(histId, booking.charger_id, req.user.name, now);

    broadcastEvent('CHARGING_STARTED', { bookingId, chargerId: booking.charger_id });

    res.json({ message: 'Charging session started successfully! Live telemetry active.', status: 'in-progress' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start charging session' });
  }
});

// Stop Charging Session & Finalize Payment & Invoice (In-Progress -> Completed)
router.post('/:id/stop-charging', authenticateToken, (req, res) => {
  try {
    const bookingId = req.params.id;
    const { energyDeliveredKwh, durationMins } = req.body;

    const booking = db.prepare('SELECT b.*, c.pricing_type, c.price_rate, c.idle_fee FROM bookings b JOIN chargers c ON b.charger_id = c.id WHERE b.id = ?').get(bookingId);

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status !== 'in-progress') {
      return res.status(400).json({ error: `Cannot stop session. Current status is ${booking.status}` });
    }

    const kwh = energyDeliveredKwh ? parseFloat(energyDeliveredKwh) : 28.5;
    const mins = durationMins ? parseInt(durationMins) : 38;

    // Calculate final cost (Pay.Session.Calculate per BR-12)
    let finalCost = 0;
    let pricingModelStr = '';
    if (booking.pricing_type === 'per_kwh') {
      finalCost = Math.round(kwh * booking.price_rate * 100) / 100;
      pricingModelStr = `₹${booking.price_rate.toFixed(2)} / kWh`;
    } else {
      finalCost = Math.round(mins * booking.price_rate * 100) / 100;
      pricingModelStr = `₹${booking.price_rate.toFixed(2)} / min`;
    }

    const now = new Date().toISOString();
    const invoiceId = 'INV-' + uuidv4().substring(0, 8).toUpperCase();

    const completeTx = db.transaction(() => {
      // 1. Update booking
      db.prepare(`
        UPDATE bookings 
        SET status = 'completed', final_cost = ?, energy_delivered_kwh = ?, updated_at = ?
        WHERE id = ?
      `).run(finalCost, kwh, now, bookingId);

      // 2. Free charger
      db.prepare(`
        UPDATE chargers 
        SET status = 'available', current_booking_id = NULL
        WHERE id = ?
      `).run(booking.charger_id);

      // 3. Capture payment (Pay.Session.Capture & Pay.Session.Adjust)
      db.prepare(`
        UPDATE payments
        SET status = 'captured', amount = ?, captured_amount = ?, captured_at = ?
        WHERE booking_id = ?
      `).run(finalCost, finalCost, now, bookingId);

      // 4. Generate invoice (Pay.Invoice.Generate)
      db.prepare(`
        INSERT INTO invoices (id, booking_id, driver_id, energy_delivered_kwh, duration_mins, unit_price, pricing_model, subtotal, taxes, total_cost, status, issued_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'paid', ?)
      `).run(invoiceId, bookingId, booking.driver_id, kwh, mins, booking.price_rate, pricingModelStr, finalCost, finalCost, now);

      // 5. Charger status history
      const histId = 'HST-' + uuidv4().substring(0, 6).toUpperCase();
      db.prepare(`
        INSERT INTO charger_status_history (id, charger_id, previous_status, new_status, changed_by, reason, timestamp)
        VALUES (?, ?, 'charging', 'available', ?, 'Session ended. Payment captured.', ?)
      `).run(histId, booking.charger_id, req.user.name, now);
    });

    completeTx();

    broadcastEvent('CHARGING_COMPLETED', {
      bookingId,
      chargerId: booking.charger_id,
      finalCost,
      energyDeliveredKwh: kwh,
      invoiceId
    });

    logAudit({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'PAYMENT_CAPTURED',
      targetType: 'invoice',
      targetId: invoiceId,
      details: `Charging session #${booking.booking_number} completed. Captured ₹${finalCost} for ${kwh} kWh.`
    });

    res.json({
      message: 'Charging session completed! Payment captured and invoice issued.',
      bookingId,
      finalCost,
      energyDeliveredKwh: kwh,
      invoiceId,
      status: 'completed'
    });
  } catch (err) {
    console.error('Stop charging error:', err);
    res.status(500).json({ error: 'Failed to complete charging session' });
  }
});

// Book.Previous.Period: View bookings from previous 12 months
router.get('/history', authenticateToken, (req, res) => {
  try {
    const twelveMonthsAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();

    let query = `
      SELECT b.*, s.name as station_name, s.address as station_address,
             c.name as charger_name, c.connector_type, c.power_rating,
             i.id as invoice_id, i.total_cost as invoice_total
      FROM bookings b
      JOIN stations s ON b.station_id = s.id
      JOIN chargers c ON b.charger_id = c.id
      LEFT JOIN invoices i ON b.id = i.booking_id
      WHERE b.created_at >= ?
    `;
    const params = [twelveMonthsAgo];

    if (req.user.role === 'driver') {
      query += ' AND b.driver_id = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'operator') {
      query += ' AND s.operator_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY b.created_at DESC';

    const bookings = db.prepare(query).all(...params);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch booking history' });
  }
});

// Book.Previous.Reorder: Pre-fill and validate rebooking from previous session
router.get('/:id/reorder-details', authenticateToken, (req, res) => {
  try {
    const booking = db.prepare(`
      SELECT b.*, s.name as station_name, s.approval_status as station_status,
             c.name as charger_name, c.status as charger_status, c.price_rate, c.pricing_type
      FROM bookings b
      JOIN stations s ON b.station_id = s.id
      JOIN chargers c ON b.charger_id = c.id
      WHERE b.id = ? AND b.driver_id = ?
    `).get(req.params.id, req.user.id);

    if (!booking) return res.status(404).json({ error: 'Previous booking not found' });

    res.json({
      stationId: booking.station_id,
      stationName: booking.station_name,
      chargerId: booking.charger_id,
      chargerName: booking.charger_name,
      vehicleId: booking.vehicle_id,
      estimatedDurationMins: booking.estimated_duration_mins,
      targetBatteryPercent: booking.target_battery_percent,
      isStationApproved: booking.station_status === 'approved',
      isChargerActive: booking.charger_status !== 'out of service' && booking.charger_status !== 'faulted'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reorder details' });
  }
});

module.exports = router;
