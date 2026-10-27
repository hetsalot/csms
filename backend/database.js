const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'csms.db');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for high concurrency
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('driver', 'operator', 'admin')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'pending_approval', 'deactivated')),
      is_verified INTEGER DEFAULT 0,
      verification_code TEXT,
      organization_name TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      driver_id TEXT NOT NULL,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      connector_type TEXT NOT NULL CHECK(connector_type IN ('CCS2', 'CHAdeMO', 'Type 2', 'GB/T')),
      battery_capacity REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY,
      driver_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('credit card', 'debit card', 'digital wallet')),
      provider TEXT NOT NULL,
      masked_number TEXT NOT NULL,
      token TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stations (
      id TEXT PRIMARY KEY,
      operator_id TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      operating_hours TEXT NOT NULL DEFAULT '24/7',
      approval_status TEXT NOT NULL DEFAULT 'pending approval' CHECK(approval_status IN ('pending approval', 'approved', 'rejected', 'suspended')),
      amenities TEXT DEFAULT '["Wi-Fi", "Restroom", "Cafe"]',
      created_at TEXT NOT NULL,
      FOREIGN KEY (operator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS chargers (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      name TEXT NOT NULL,
      connector_type TEXT NOT NULL CHECK(connector_type IN ('CCS2', 'CHAdeMO', 'Type 2', 'GB/T')),
      power_rating REAL NOT NULL,
      speed_category TEXT NOT NULL CHECK(speed_category IN ('slow', 'fast', 'rapid')),
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'reserved', 'charging', 'faulted', 'out of service')),
      pricing_type TEXT NOT NULL DEFAULT 'per_kwh' CHECK(pricing_type IN ('per_kwh', 'per_minute')),
      price_rate REAL NOT NULL,
      idle_fee REAL DEFAULT 0.0,
      last_heartbeat TEXT,
      current_booking_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      booking_number INTEGER UNIQUE NOT NULL,
      driver_id TEXT NOT NULL,
      charger_id TEXT NOT NULL,
      station_id TEXT NOT NULL,
      vehicle_id TEXT,
      booking_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      estimated_duration_mins INTEGER NOT NULL,
      target_battery_percent INTEGER,
      estimated_cost REAL NOT NULL,
      final_cost REAL,
      energy_delivered_kwh REAL DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('incomplete', 'confirmed', 'in-progress', 'completed', 'canceled', 'no-show')),
      payment_hold_id TEXT,
      cancellation_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (driver_id) REFERENCES users(id),
      FOREIGN KEY (charger_id) REFERENCES chargers(id),
      FOREIGN KEY (station_id) REFERENCES stations(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      booking_id TEXT UNIQUE NOT NULL,
      driver_id TEXT NOT NULL,
      amount REAL NOT NULL,
      method_type TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('authorized', 'captured', 'failed', 'refunded')),
      gateway_transaction_id TEXT NOT NULL,
      hold_amount REAL NOT NULL,
      captured_amount REAL,
      refunded_amount REAL DEFAULT 0,
      created_at TEXT NOT NULL,
      captured_at TEXT,
      FOREIGN KEY (booking_id) REFERENCES bookings(id),
      FOREIGN KEY (driver_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      booking_id TEXT UNIQUE NOT NULL,
      driver_id TEXT NOT NULL,
      energy_delivered_kwh REAL NOT NULL,
      duration_mins INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      pricing_model TEXT NOT NULL,
      subtotal REAL NOT NULL,
      taxes REAL NOT NULL,
      total_cost REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'paid' CHECK(status IN ('paid', 'refunded', 'disputed')),
      issued_at TEXT NOT NULL,
      FOREIGN KEY (booking_id) REFERENCES bookings(id),
      FOREIGN KEY (driver_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS refund_requests (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      invoice_id TEXT NOT NULL,
      driver_id TEXT NOT NULL,
      station_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      operator_notes TEXT,
      created_at TEXT NOT NULL,
      reviewed_at TEXT,
      FOREIGN KEY (booking_id) REFERENCES bookings(id),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id),
      FOREIGN KEY (driver_id) REFERENCES users(id),
      FOREIGN KEY (station_id) REFERENCES stations(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      user_role TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details TEXT,
      ip_address TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS charger_status_history (
      id TEXT PRIMARY KEY,
      charger_id TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT NOT NULL,
      changed_by TEXT,
      reason TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (charger_id) REFERENCES chargers(id)
    );

    CREATE INDEX IF NOT EXISTS idx_stations_operator ON stations(operator_id);
    CREATE INDEX IF NOT EXISTS idx_chargers_station ON chargers(station_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_driver ON bookings(driver_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_charger ON bookings(charger_id);
    CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(timestamp);
  `);
}

initSchema();

module.exports = {
  db,
  initSchema
};
