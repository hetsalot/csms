const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { optionalToken, authenticateToken, requireRole } = require('../middleware/auth');
const { calculateDistance, broadcastEvent, logAudit } = require('../utils');

// Locate.Search & filter stations (Public / Driver)
router.get('/', optionalToken, (req, res) => {
  try {
    const {
      lat,
      lng,
      radius = 15, // default radius in km (can be overridden up to 100km)
      connector, // e.g. CCS2, CHAdeMO, Type 2, GB/T
      speed, // slow, fast, rapid
      availableOnly = 'false',
      searchQuery
    } = req.query;

    const userLat = lat ? parseFloat(lat) : 19.0657; // Default to central coordinates (BKC Mumbai)
    const userLng = lng ? parseFloat(lng) : 72.8686;
    const searchRadius = parseFloat(radius);
    const filterAvailable = availableOnly === 'true';

    // Fetch approved stations
    let stations = db.prepare(`
      SELECT s.*, u.name as operator_name, u.organization_name
      FROM stations s
      JOIN users u ON s.operator_id = u.id
      WHERE s.approval_status = 'approved'
    `).all();

    // Map stations with their chargers, availability, distance, and min price
    const enrichedStations = stations.map(station => {
      let chargers = db.prepare(`
        SELECT * FROM chargers 
        WHERE station_id = ?
      `).all(station.id);

      // SI-1.3: Do not display "Faulted" chargers in driver view if looking for usable chargers
      const activeChargers = chargers.filter(c => c.status !== 'faulted');

      // Calculate distance using Haversine
      const distanceKm = calculateDistance(userLat, userLng, station.latitude, station.longitude);

      // Starting price calculation
      let minPrice = Infinity;
      chargers.forEach(c => {
        if (c.price_rate < minPrice) minPrice = c.price_rate;
      });
      if (minPrice === Infinity) minPrice = 0;

      const availableCount = chargers.filter(c => c.status === 'available').length;
      const totalChargers = chargers.length;

      let amenitiesList = [];
      try {
        amenitiesList = JSON.parse(station.amenities || '[]');
      } catch (e) {
        amenitiesList = [];
      }

      return {
        ...station,
        distanceKm,
        minPrice,
        availableCount,
        totalChargers,
        amenities: amenitiesList,
        chargers
      };
    });

    // Apply filters
    let filtered = enrichedStations.filter(s => {
      // Radius filter
      if (s.distanceKm > searchRadius) return false;

      // Text query match (name or address)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = s.name.toLowerCase().includes(query);
        const matchAddr = s.address.toLowerCase().includes(query);
        if (!matchName && !matchAddr) return false;
      }

      // Filter by availability (at least 1 available charger)
      if (filterAvailable && s.availableCount === 0) return false;

      // Filter by connector type
      if (connector) {
        const hasConnector = s.chargers.some(c => c.connector_type.toLowerCase() === connector.toLowerCase());
        if (!hasConnector) return false;
      }

      // Filter by speed category
      if (speed) {
        const hasSpeed = s.chargers.some(c => c.speed_category.toLowerCase() === speed.toLowerCase());
        if (!hasSpeed) return false;
      }

      return true;
    });

    // Sort by distance ascending
    filtered.sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({
      total: filtered.length,
      userLocation: { lat: userLat, lng: userLng },
      radiusKm: searchRadius,
      stations: filtered
    });
  } catch (err) {
    console.error('Error searching stations:', err);
    res.status(500).json({ error: 'Failed to search charging stations' });
  }
});

// Locate.Details.View - Single station details
router.get('/:id', optionalToken, (req, res) => {
  try {
    const station = db.prepare(`
      SELECT s.*, u.name as operator_name, u.organization_name
      FROM stations s
      JOIN users u ON s.operator_id = u.id
      WHERE s.id = ?
    `).get(req.params.id);

    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    const chargers = db.prepare(`
      SELECT * FROM chargers WHERE station_id = ? ORDER BY power_rating DESC
    `).all(station.id);

    let amenitiesList = [];
    try {
      amenitiesList = JSON.parse(station.amenities || '[]');
    } catch (e) {
      amenitiesList = [];
    }

    res.json({
      ...station,
      amenities: amenitiesList,
      chargers
    });
  } catch (err) {
    console.error('Error fetching station details:', err);
    res.status(500).json({ error: 'Failed to fetch station details' });
  }
});

// Station Operator: My Stations & Live Chargers
router.get('/operator/my-stations', authenticateToken, requireRole('operator', 'admin'), (req, res) => {
  try {
    let query = 'SELECT * FROM stations';
    const params = [];
    if (req.user.role === 'operator') {
      query += ' WHERE operator_id = ?';
      params.push(req.user.id);
    }
    query += ' ORDER BY created_at DESC';

    const stations = db.prepare(query).all(...params);

    const enriched = stations.map(stn => {
      const chargers = db.prepare('SELECT * FROM chargers WHERE station_id = ?').all(stn.id);
      return {
        ...stn,
        amenities: JSON.parse(stn.amenities || '[]'),
        chargers
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch operator stations' });
  }
});

// Station.Create
router.post('/', authenticateToken, requireRole('operator', 'admin'), (req, res) => {
  try {
    const { name, address, latitude, longitude, operatingHours, amenities } = req.body;

    if (!name || !address || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Station name, address, latitude, and longitude are required' });
    }

    const id = 'STN-' + uuidv4().substring(0, 6).toUpperCase();
    const now = new Date().toISOString();
    const approvalStatus = req.user.role === 'admin' ? 'approved' : 'pending approval';

    db.prepare(`
      INSERT INTO stations (id, operator_id, name, address, latitude, longitude, operating_hours, approval_status, amenities, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.user.id,
      name,
      address,
      parseFloat(latitude),
      parseFloat(longitude),
      operatingHours || '24/7',
      approvalStatus,
      JSON.stringify(amenities || ['Wi-Fi', 'Restroom']),
      now
    );

    logAudit({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'STATION_CREATED',
      targetType: 'station',
      targetId: id,
      details: `Station "${name}" created with status ${approvalStatus}`
    });

    res.status(201).json({
      message: approvalStatus === 'pending approval' 
        ? 'Station created! It will appear to drivers once approved by the System Administrator.' 
        : 'Station created and approved!',
      stationId: id
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create station' });
  }
});

// Station.Update
router.put('/:id', authenticateToken, requireRole('operator', 'admin'), (req, res) => {
  try {
    const stationId = req.params.id;
    const { name, address, latitude, longitude, operatingHours, amenities } = req.body;

    const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(stationId);
    if (!station) return res.status(404).json({ error: 'Station not found' });

    if (req.user.role !== 'admin' && station.operator_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to update this station' });
    }

    db.prepare(`
      UPDATE stations 
      SET name = COALESCE(?, name),
          address = COALESCE(?, address),
          latitude = COALESCE(?, latitude),
          longitude = COALESCE(?, longitude),
          operating_hours = COALESCE(?, operating_hours),
          amenities = COALESCE(?, amenities)
      WHERE id = ?
    `).run(
      name || null,
      address || null,
      latitude !== undefined && latitude !== '' ? parseFloat(latitude) : null,
      longitude !== undefined && longitude !== '' ? parseFloat(longitude) : null,
      operatingHours || null,
      amenities ? (typeof amenities === 'string' ? amenities : JSON.stringify(amenities)) : null,
      stationId
    );

    logAudit({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'STATION_UPDATED',
      targetType: 'station',
      targetId: stationId,
      details: `Station "${name || station.name}" updated`
    });

    broadcastEvent('STATION_UPDATED', { stationId });

    res.json({ message: 'Station updated successfully' });
  } catch (err) {
    console.error('Update station error:', err);
    res.status(500).json({ error: 'Failed to update station' });
  }
});

// Station.Charger.Add
router.post('/:id/chargers', authenticateToken, requireRole('operator', 'admin'), (req, res) => {
  try {
    const stationId = req.params.id;
    const { name, connectorType, powerRating, pricingType, priceRate, idleFee } = req.body;

    if (!connectorType || !powerRating || !priceRate) {
      return res.status(400).json({ error: 'Connector type, power rating, and price rate are required' });
    }

    const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(stationId);
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    if (req.user.role !== 'admin' && station.operator_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to add chargers to this station' });
    }

    const rating = parseFloat(powerRating);
    let speedCategory = 'slow';
    if (rating >= 50) {
      speedCategory = 'rapid';
    } else if (rating >= 22) {
      speedCategory = 'fast';
    }

    const chargerId = 'CHG-' + uuidv4().substring(0, 6).toUpperCase();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO chargers (id, station_id, name, connector_type, power_rating, speed_category, status, pricing_type, price_rate, idle_fee, last_heartbeat, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?, ?)
    `).run(
      chargerId,
      stationId,
      name || `${connectorType} Charger (${rating}kW)`,
      connectorType,
      rating,
      speedCategory,
      pricingType || 'per_kwh',
      parseFloat(priceRate),
      parseFloat(idleFee || 0.0),
      now,
      now
    );

    broadcastEvent('CHARGER_ADDED', { stationId, chargerId });

    res.status(201).json({ message: 'Charger added successfully', chargerId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add charger' });
  }
});

// Station.Edit & Station.Edit.ActiveBooking
router.put('/chargers/:id', authenticateToken, requireRole('operator', 'admin'), (req, res) => {
  try {
    const chargerId = req.params.id;
    const { priceRate, pricingType, idleFee, status } = req.body;

    const charger = db.prepare('SELECT c.*, s.operator_id FROM chargers c JOIN stations s ON c.station_id = s.id WHERE c.id = ?').get(chargerId);
    if (!charger) {
      return res.status(404).json({ error: 'Charger not found' });
    }

    if (req.user.role !== 'admin' && charger.operator_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to edit this charger' });
    }

    // Check future bookings warning
    const futureBookings = db.prepare(`
      SELECT count(*) as count FROM bookings 
      WHERE charger_id = ? AND status IN ('confirmed', 'in-progress')
    `).get(chargerId);

    const prevStatus = charger.status;
    const newStatus = status || prevStatus;

    db.prepare(`
      UPDATE chargers 
      SET price_rate = COALESCE(?, price_rate),
          pricing_type = COALESCE(?, pricing_type),
          idle_fee = COALESCE(?, idle_fee),
          status = COALESCE(?, status)
      WHERE id = ?
    `).run(
      priceRate !== undefined ? parseFloat(priceRate) : null,
      pricingType || null,
      idleFee !== undefined ? parseFloat(idleFee) : null,
      status || null,
      chargerId
    );

    // If status changed, log to history (Monitor.History)
    if (status && status !== prevStatus) {
      const historyId = 'HST-' + uuidv4().substring(0, 6).toUpperCase();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO charger_status_history (id, charger_id, previous_status, new_status, changed_by, reason, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(historyId, chargerId, prevStatus, newStatus, req.user.name, 'Manual update by operator', now);

      broadcastEvent('CHARGER_STATUS_CHANGED', { chargerId, previousStatus: prevStatus, newStatus });
    }

    res.json({
      message: 'Charger updated successfully',
      futureBookingsCount: futureBookings.count,
      warning: futureBookings.count > 0 ? `Note: Charger has ${futureBookings.count} active or future booking(s). Existing bookings retain their quoted price.` : null
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update charger' });
  }
});

// Station.Charger.Delete
router.delete('/chargers/:id', authenticateToken, requireRole('operator', 'admin'), (req, res) => {
  try {
    const chargerId = req.params.id;
    const charger = db.prepare('SELECT c.*, s.operator_id, s.name as station_name FROM chargers c JOIN stations s ON c.station_id = s.id WHERE c.id = ?').get(chargerId);
    if (!charger) return res.status(404).json({ error: 'Charger not found' });

    if (req.user.role !== 'admin' && charger.operator_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to delete this charger' });
    }

    const activeBookings = db.prepare(`
      SELECT count(*) as count FROM bookings 
      WHERE charger_id = ? AND status IN ('confirmed', 'in-progress')
    `).get(chargerId);

    if (activeBookings.count > 0) {
      return res.status(400).json({
        error: `Cannot delete charger: There are ${activeBookings.count} active or confirmed future booking(s).`
      });
    }

    db.prepare('DELETE FROM chargers WHERE id = ?').run(chargerId);
    broadcastEvent('CHARGER_DELETED', { chargerId, stationId: charger.station_id });

    logAudit({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'CHARGER_DELETED',
      targetType: 'charger',
      targetId: chargerId,
      details: `Charger "${charger.name}" removed from ${charger.station_name}`
    });

    res.json({ message: 'Charger deleted successfully' });
  } catch (err) {
    console.error('Delete charger error:', err);
    res.status(500).json({ error: 'Failed to delete charger' });
  }
});

// Station.Delete
router.delete('/:id', authenticateToken, requireRole('operator', 'admin'), (req, res) => {
  try {
    const stationId = req.params.id;
    const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(stationId);
    if (!station) return res.status(404).json({ error: 'Station not found' });

    if (req.user.role !== 'admin' && station.operator_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if station has active or future bookings (Station.Delete)
    const activeBookings = db.prepare(`
      SELECT count(*) as count FROM bookings 
      WHERE station_id = ? AND status IN ('confirmed', 'in-progress')
    `).get(stationId);

    if (activeBookings.count > 0) {
      return res.status(400).json({
        error: `Cannot delete station: There are ${activeBookings.count} active or confirmed future booking(s). Cancel them first.`
      });
    }

    db.prepare('DELETE FROM stations WHERE id = ?').run(stationId);
    broadcastEvent('STATION_DELETED', { stationId });

    res.json({ message: 'Station deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete station' });
  }
});

// Monitor.History - 90-day status history log
router.get('/chargers/:id/history', authenticateToken, (req, res) => {
  try {
    const chargerId = req.params.id;
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();

    const history = db.prepare(`
      SELECT * FROM charger_status_history
      WHERE charger_id = ? AND timestamp >= ?
      ORDER BY timestamp DESC
    `).all(chargerId, ninetyDaysAgo);

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch status history' });
  }
});

module.exports = router;
