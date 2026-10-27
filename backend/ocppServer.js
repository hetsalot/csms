const { WebSocketServer, WebSocket } = require('ws');
const { v4: uuidv4 } = require('uuid');
const { db } = require('./database');
const { broadcastEvent, logAudit } = require('./utils');

class OcppServer {
  constructor() {
    this.wss = null;
    this.chargePointSockets = new Map(); // chargerId -> WebSocket
    this.watchdogInterval = null;
    this.activeSimulations = new Map(); // bookingId -> Interval
  }

  initialize(server) {
    this.wss = new WebSocketServer({ server, path: '/ocpp/v201' });

    this.wss.on('connection', (ws, req) => {
      let registeredChargerId = null;

      ws.on('message', (message) => {
        try {
          const payload = JSON.parse(message.toString());
          this.handleOcppMessage(ws, payload, (chargerId) => {
            registeredChargerId = chargerId;
            this.chargePointSockets.set(chargerId, ws);
          });
        } catch (err) {
          console.error('OCPP parse error:', err);
        }
      });

      ws.on('close', () => {
        if (registeredChargerId) {
          this.chargePointSockets.delete(registeredChargerId);
        }
      });
    });

    // Start 15-second watchdog to check for heartbeat timeouts (Monitor.Status.Timeout, default 90s)
    this.startWatchdogTimer(90);
  }

  handleOcppMessage(ws, msg, setChargerId) {
    const { action, chargerId, data } = msg;
    if (!chargerId) return;
    setChargerId(chargerId);

    const now = new Date().toISOString();

    switch (action) {
      case 'BootNotification':
        db.prepare('UPDATE chargers SET last_heartbeat = ? WHERE id = ?').run(now, chargerId);
        ws.send(JSON.stringify({ action: 'BootNotificationResponse', status: 'Accepted', interval: 60 }));
        break;

      case 'Heartbeat':
        db.prepare('UPDATE chargers SET last_heartbeat = ? WHERE id = ?').run(now, chargerId);
        ws.send(JSON.stringify({ action: 'HeartbeatResponse', currentTime: now }));
        break;

      case 'StatusNotification': {
        const { connectorStatus, errorCode, info } = data || {};
        const validStatuses = ['available', 'reserved', 'charging', 'faulted', 'out of service'];
        const normalized = (connectorStatus || '').toLowerCase();
        const newStatus = validStatuses.includes(normalized) ? normalized : 'available';

        const prevCharger = db.prepare('SELECT status, current_booking_id FROM chargers WHERE id = ?').get(chargerId);
        const prevStatus = prevCharger ? prevCharger.status : 'available';

        db.prepare('UPDATE chargers SET status = ?, last_heartbeat = ? WHERE id = ?').run(newStatus, now, chargerId);

        // Record in history log
        const histId = 'HST-' + uuidv4().substring(0, 6).toUpperCase();
        db.prepare(`
          INSERT INTO charger_status_history (id, charger_id, previous_status, new_status, changed_by, reason, timestamp)
          VALUES (?, ?, ?, ?, 'OCPP_CP_CONTROLLER', ?, ?)
        `).run(histId, chargerId, prevStatus, newStatus, errorCode || 'Status reported via OCPP', now);

        // Safety Requirement SF-2: Notify operator if fault reported during active session
        if (newStatus === 'faulted') {
          broadcastEvent('CHARGER_FAULT_ALERT', {
            chargerId,
            errorCode: errorCode || 'GroundFault',
            info: info || 'Hardware fault reported by Charge Point Controller',
            activeBookingId: prevCharger ? prevCharger.current_booking_id : null
          });
        }

        broadcastEvent('CHARGER_STATUS_CHANGED', { chargerId, previousStatus: prevStatus, newStatus, errorCode });
        ws.send(JSON.stringify({ action: 'StatusNotificationResponse' }));
        break;
      }

      case 'MeterValues': {
        const { energyDeliveredKwh, socPercent, powerKw } = data || {};
        broadcastEvent('METER_VALUES_STREAM', {
          chargerId,
          energyDeliveredKwh,
          socPercent,
          powerKw,
          timestamp: now
        });
        ws.send(JSON.stringify({ action: 'MeterValuesResponse' }));
        break;
      }
    }
  }

  // Monitor.Status.Timeout: Check chargers whose heartbeat is older than timeoutSeconds
  startWatchdogTimer(timeoutSeconds = 90) {
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);

    this.watchdogInterval = setInterval(() => {
      try {
        const threshold = new Date(Date.now() - timeoutSeconds * 1000).toISOString();
        const expiredChargers = db.prepare(`
          SELECT id, station_id, status FROM chargers
          WHERE status NOT IN ('out of service', 'faulted')
            AND (last_heartbeat < ? OR last_heartbeat IS NULL)
        `).all(threshold);

        for (const chg of expiredChargers) {
          const now = new Date().toISOString();
          db.prepare('UPDATE chargers SET status = "out of service" WHERE id = ?').run(chg.id);

          const histId = 'HST-' + uuidv4().substring(0, 6).toUpperCase();
          db.prepare(`
            INSERT INTO charger_status_history (id, charger_id, previous_status, new_status, changed_by, reason, timestamp)
            VALUES (?, ?, ?, 'out of service', 'WATCHDOG_HEARTBEAT_TIMEOUT', 'No heartbeat received in 90 seconds', ?)
          `).run(histId, chg.id, chg.status, now);

          broadcastEvent('CHARGER_STATUS_CHANGED', {
            chargerId: chg.id,
            previousStatus: chg.status,
            newStatus: 'out of service',
            reason: 'Heartbeat timeout'
          });

          broadcastEvent('OPERATOR_NOTIFICATION', {
            title: 'Charger Out of Service (Heartbeat Timeout)',
            message: `Charger ${chg.id} at station ${chg.station_id} lost heartbeat for over 90 seconds.`,
            level: 'warning'
          });
        }
      } catch (e) {
        console.error('Watchdog timer check error:', e);
      }
    }, 15000);
  }

  // Safety Requirement SF-1: CSMS will NOT issue RemoteStartTransaction if Faulted or Out of Service
  remoteStartTransaction(chargerId, bookingId) {
    const charger = db.prepare('SELECT status FROM chargers WHERE id = ?').get(chargerId);
    if (!charger) throw new Error('Charger not found');

    if (charger.status === 'faulted' || charger.status === 'out of service') {
      throw new Error(`Safety Violation (SF-1): Cannot issue RemoteStartTransaction to a charger reported as "${charger.status}"`);
    }

    const socket = this.chargePointSockets.get(chargerId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        action: 'RemoteStartTransaction',
        chargerId,
        bookingId,
        timestamp: new Date().toISOString()
      }));
    }
  }

  remoteStopTransaction(chargerId, bookingId) {
    const socket = this.chargePointSockets.get(chargerId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        action: 'RemoteStopTransaction',
        chargerId,
        bookingId,
        timestamp: new Date().toISOString()
      }));
    }
  }

  // Simulator helper: simulates progressive meter updates and state for demo
  startTelemetrySimulation(bookingId, chargerId, targetSoc = 80, onTick, onComplete) {
    if (this.activeSimulations.has(bookingId)) {
      clearInterval(this.activeSimulations.get(bookingId));
    }

    let soc = 20;
    let kwh = 0.5;
    const charger = db.prepare('SELECT power_rating FROM chargers WHERE id = ?').get(chargerId);
    const powerKw = charger ? charger.power_rating : 50;

    const interval = setInterval(() => {
      soc += Math.min(5, targetSoc - soc);
      kwh += Math.round((powerKw * 0.05) * 10) / 10;

      const meterData = {
        bookingId,
        chargerId,
        socPercent: soc,
        energyDeliveredKwh: Math.round(kwh * 10) / 10,
        powerKw,
        voltage: 400 + Math.floor(Math.random() * 10),
        current: Math.round((powerKw * 1000 / 400) * 10) / 10,
        temperatureC: 38 + Math.floor(Math.random() * 4)
      };

      broadcastEvent('METER_VALUES_STREAM', meterData);
      if (onTick) onTick(meterData);

      if (soc >= targetSoc) {
        clearInterval(interval);
        this.activeSimulations.delete(bookingId);
        if (onComplete) onComplete(meterData);
      }
    }, 2000); // 2 second ticks

    this.activeSimulations.set(bookingId, interval);
  }

  stopTelemetrySimulation(bookingId) {
    if (this.activeSimulations.has(bookingId)) {
      clearInterval(this.activeSimulations.get(bookingId));
      this.activeSimulations.delete(bookingId);
    }
  }
}

const ocppServer = new OcppServer();

module.exports = {
  ocppServer
};
