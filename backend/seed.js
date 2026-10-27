const bcrypt = require('bcryptjs');
const { db } = require('./database');

function seedDatabase() {
  const existingUsers = db.prepare('SELECT count(*) as count FROM users').get();
  if (existingUsers.count > 0) {
    console.log('Database already contains data, skipping full seed.');
    return;
  }

  console.log('Seeding database with SRS mock data...');
  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('Admin@123', salt);
  const operatorHash = bcrypt.hashSync('Operator@123', salt);
  const driverHash = bcrypt.hashSync('Driver@123', salt);

  const now = new Date().toISOString();

  // 1. Seed Users
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, role, status, is_verified, verification_code, organization_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('USR-ADMIN-1', 'System Administrator', 'admin@evcharge.com', '+91 9820011223', adminHash, 'admin', 'active', 1, '123456', 'EV Platform HQ', now);
  insertUser.run('USR-OP-1', 'VoltCharge Networks', 'operator@chargehub.com', '+91 9820099887', operatorHash, 'operator', 'active', 1, '123456', 'VoltCharge Pvt Ltd', now);
  insertUser.run('USR-OP-2', 'GreenPower Mobility', 'greenpower@ev.org', '+91 9820055443', operatorHash, 'operator', 'pending_approval', 1, '123456', 'GreenPower CleanTech', now);
  insertUser.run('USR-DRV-1', 'Alex Rivera', 'driver@evtravel.com', '+91 9811122334', driverHash, 'driver', 'active', 1, '123456', null, now);
  insertUser.run('USR-DRV-2', 'Siddh Sakariya', 'siddh@example.com', '+91 9822233445', driverHash, 'driver', 'active', 1, '123456', null, now);
  insertUser.run('USR-DRV-3', 'Het Salot', 'het@example.com', '+91 9833344556', driverHash, 'driver', 'active', 1, '123456', null, now);

  // 2. Seed Vehicles for Drivers
  const insertVehicle = db.prepare(`
    INSERT INTO vehicles (id, driver_id, make, model, connector_type, battery_capacity, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertVehicle.run('VEH-101', 'USR-DRV-1', 'Tesla', 'Model 3 Long Range', 'CCS2', 75.0, now);
  insertVehicle.run('VEH-102', 'USR-DRV-1', 'Hyundai', 'Ioniq 5', 'CCS2', 72.6, now);
  insertVehicle.run('VEH-103', 'USR-DRV-2', 'Tata', 'Nexon EV Max', 'CCS2', 40.5, now);
  insertVehicle.run('VEH-104', 'USR-DRV-3', 'MG', 'ZS EV', 'Type 2', 50.3, now);
  insertVehicle.run('VEH-105', 'USR-DRV-3', 'Mahindra', 'XUV400', 'GB/T', 39.4, now);

  // 3. Seed Payment Methods
  const insertPaymentMethod = db.prepare(`
    INSERT INTO payment_methods (id, driver_id, type, provider, masked_number, token, is_default, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPaymentMethod.run('PM-201', 'USR-DRV-1', 'credit card', 'HDFC Visa Signature', '•••• •••• •••• 4242', 'tok_hdfc_visa_4242', 1, now);
  insertPaymentMethod.run('PM-202', 'USR-DRV-1', 'digital wallet', 'Google Pay UPI', 'alex@okhdfcbank', 'tok_gpay_upi_alex', 0, now);
  insertPaymentMethod.run('PM-203', 'USR-DRV-2', 'debit card', 'ICICI Mastercard', '•••• •••• •••• 8899', 'tok_icici_mc_8899', 1, now);
  insertPaymentMethod.run('PM-204', 'USR-DRV-3', 'credit card', 'Axis Bank Rupay', '•••• •••• •••• 1234', 'tok_axis_rupay_1234', 1, now);

  // 4. Seed Stations
  const insertStation = db.prepare(`
    INSERT INTO stations (id, operator_id, name, address, latitude, longitude, operating_hours, approval_status, amenities, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertStation.run(
    'STN-BKC-01',
    'USR-OP-1',
    'VoltCharge SuperHub - BKC',
    'G Block, Bandra Kurla Complex, Mumbai, Maharashtra 400051',
    19.0657,
    72.8686,
    '24/7',
    'approved',
    JSON.stringify(['High-Speed Wi-Fi', 'Restroom', 'Café Coffee Day', 'Convenience Store', 'EV Lounge']),
    now
  );

  insertStation.run(
    'STN-POWAI-02',
    'USR-OP-1',
    'EcoCharge Station - Powai Tech Park',
    'Central Avenue, Hiranandani Gardens, Powai, Mumbai 400076',
    19.1176,
    72.9060,
    '06:00 - 23:00',
    'approved',
    JSON.stringify(['Wi-Fi', 'Restroom', 'Covered Canopy', 'Security Guard']),
    now
  );

  insertStation.run(
    'STN-BANDRA-03',
    'USR-OP-1',
    'ElectraDrive Gateway - Bandra West',
    'Near Turner Road, Linking Road, Bandra West, Mumbai 400050',
    19.0596,
    72.8295,
    '24/7',
    'approved',
    JSON.stringify(['Restroom', 'Coffee Kiosk', 'Wheelchair Accessible']),
    now
  );

  insertStation.run(
    'STN-VASHI-04',
    'USR-OP-1',
    'GreenGrid Hub - Navi Mumbai Vashi',
    'Palm Beach Galleria, Sector 17, Vashi, Navi Mumbai 400703',
    19.0771,
    72.9986,
    '24/7',
    'approved',
    JSON.stringify(['Food Court', 'Restroom', 'Shopping Mall Parking']),
    now
  );

  insertStation.run(
    'STN-ANDHERI-05',
    'USR-OP-2',
    'Apex FastCharge - Andheri East (Pending)',
    'MIDC Central Road, Andheri East, Mumbai 400093',
    19.1136,
    72.8697,
    '07:00 - 22:00',
    'pending approval',
    JSON.stringify(['Restroom', 'Snack Bar']),
    now
  );

  // 5. Seed Chargers
  const insertCharger = db.prepare(`
    INSERT INTO chargers (id, station_id, name, connector_type, power_rating, speed_category, status, pricing_type, price_rate, idle_fee, last_heartbeat, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // BKC Chargers
  insertCharger.run('CHG-BKC-101', 'STN-BKC-01', 'Bay 1 - DC Ultra Fast 150kW', 'CCS2', 150.0, 'rapid', 'available', 'per_kwh', 19.50, 4.0, now, now);
  insertCharger.run('CHG-BKC-102', 'STN-BKC-01', 'Bay 2 - DC Fast 60kW', 'CCS2', 60.0, 'fast', 'charging', 'per_kwh', 17.50, 3.0, now, now);
  insertCharger.run('CHG-BKC-103', 'STN-BKC-01', 'Bay 3 - CHAdeMO Fast 50kW', 'CHAdeMO', 50.0, 'fast', 'available', 'per_kwh', 17.00, 3.0, now, now);
  insertCharger.run('CHG-BKC-104', 'STN-BKC-01', 'Bay 4 - AC Dual 22kW', 'Type 2', 22.0, 'fast', 'reserved', 'per_minute', 2.20, 2.0, now, now);
  insertCharger.run('CHG-BKC-105', 'STN-BKC-01', 'Bay 5 - Bharat DC001 15kW', 'GB/T', 15.0, 'slow', 'available', 'per_kwh', 14.50, 2.0, now, now);

  // Powai Chargers
  insertCharger.run('CHG-POW-201', 'STN-POWAI-02', 'Bay 1 - DC Hyper 120kW', 'CCS2', 120.0, 'rapid', 'available', 'per_kwh', 18.00, 3.5, now, now);
  insertCharger.run('CHG-POW-202', 'STN-POWAI-02', 'Bay 2 - AC Fast 22kW', 'Type 2', 22.0, 'fast', 'available', 'per_minute', 2.00, 2.0, now, now);
  insertCharger.run('CHG-POW-203', 'STN-POWAI-02', 'Bay 3 - DC Rapid 50kW', 'CHAdeMO', 50.0, 'fast', 'faulted', 'per_kwh', 16.50, 2.5, now, now);

  // Bandra Chargers
  insertCharger.run('CHG-BAN-301', 'STN-BANDRA-03', 'Bay 1 - Supercharger 150kW', 'CCS2', 150.0, 'rapid', 'available', 'per_kwh', 20.00, 4.0, now, now);
  insertCharger.run('CHG-BAN-302', 'STN-BANDRA-03', 'Bay 2 - Smart AC 11kW', 'Type 2', 11.0, 'slow', 'available', 'per_minute', 1.80, 1.5, now, now);

  // Vashi Chargers
  insertCharger.run('CHG-VAS-401', 'STN-VASHI-04', 'Bay 1 - DC Fast 60kW', 'CCS2', 60.0, 'fast', 'available', 'per_kwh', 16.00, 2.5, now, now);
  insertCharger.run('CHG-VAS-402', 'STN-VASHI-04', 'Bay 2 - GB/T Fast 30kW', 'GB/T', 30.0, 'fast', 'out of service', 'per_kwh', 15.00, 2.0, now, now);

  // Andheri Chargers
  insertCharger.run('CHG-AND-501', 'STN-ANDHERI-05', 'Bay 1 - DC 50kW', 'CCS2', 50.0, 'fast', 'available', 'per_kwh', 17.00, 3.0, now, now);

  // 6. Seed Sample Bookings (historical and active)
  const insertBooking = db.prepare(`
    INSERT INTO bookings (
      id, booking_number, driver_id, charger_id, station_id, vehicle_id,
      booking_date, start_time, end_time, estimated_duration_mins, target_battery_percent,
      estimated_cost, final_cost, energy_delivered_kwh, status, payment_hold_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Past completed booking
  const pastDate = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().split('T')[0];
  insertBooking.run(
    'BK-1001',
    1001,
    'USR-DRV-1',
    'CHG-BKC-101',
    'STN-BKC-01',
    'VEH-101',
    pastDate,
    '14:00',
    '14:45',
    45,
    80,
    585.00,
    592.80,
    30.4,
    'completed',
    'HOLD-1001',
    new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    new Date(Date.now() - 2 * 24 * 3600 * 1000 + 45 * 60 * 1000).toISOString()
  );

  // Active confirmed booking for today
  const todayDate = new Date().toISOString().split('T')[0];
  insertBooking.run(
    'BK-1002',
    1002,
    'USR-DRV-1',
    'CHG-BKC-104',
    'STN-BKC-01',
    'VEH-101',
    todayDate,
    '17:00',
    '17:30',
    30,
    85,
    390.00,
    null,
    0,
    'confirmed',
    'HOLD-1002',
    now,
    now
  );

  // 7. Seed Payments & Invoices for completed booking
  const insertPayment = db.prepare(`
    INSERT INTO payments (id, booking_id, driver_id, amount, method_type, status, gateway_transaction_id, hold_amount, captured_amount, created_at, captured_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPayment.run(
    'PAY-5001',
    'BK-1001',
    'USR-DRV-1',
    592.80,
    'credit card',
    'captured',
    'txn_pg_live_994821',
    585.00,
    592.80,
    new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    new Date(Date.now() - 2 * 24 * 3600 * 1000 + 45 * 60 * 1000).toISOString()
  );

  const insertInvoice = db.prepare(`
    INSERT INTO invoices (id, booking_id, driver_id, energy_delivered_kwh, duration_mins, unit_price, pricing_model, subtotal, taxes, total_cost, status, issued_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertInvoice.run(
    'INV-9001',
    'BK-1001',
    'USR-DRV-1',
    30.4,
    45,
    19.50,
    '₹19.50 / kWh',
    592.80,
    0.0,
    592.80,
    'paid',
    new Date(Date.now() - 2 * 24 * 3600 * 1000 + 45 * 60 * 1000).toISOString()
  );

  // 8. Seed Audit Logs
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, user_id, user_name, user_role, action, target_type, target_id, details, ip_address, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertAudit.run('LOG-001', 'USR-ADMIN-1', 'System Administrator', 'admin', 'SYSTEM_INITIALIZED', 'system', 'CORE', 'System initialized with initial configurations and base seed', '127.0.0.1', now);
  insertAudit.run('LOG-002', 'USR-ADMIN-1', 'System Administrator', 'admin', 'STATION_APPROVED', 'station', 'STN-BKC-01', 'Approved VoltCharge SuperHub - BKC after safety inspection', '127.0.0.1', now);
  insertAudit.run('LOG-003', 'USR-OP-1', 'VoltCharge Networks', 'operator', 'PRICING_UPDATED', 'charger', 'CHG-BKC-101', 'Updated DC Ultra Fast rate to ₹19.50/kWh', '192.168.1.10', now);

  // 9. Seed Status History
  const insertHistory = db.prepare(`
    INSERT INTO charger_status_history (id, charger_id, previous_status, new_status, changed_by, reason, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertHistory.run('HST-001', 'CHG-BKC-102', 'available', 'charging', 'CP-BKC-02', 'OCPP Transaction Started via RemoteStartTransaction', now);
  insertHistory.run('HST-002', 'CHG-POW-203', 'available', 'faulted', 'CP-POW-03', 'OCPP Fault Notification: High Ground Impedance Detected', now);

  console.log('Database seeding complete successfully!');
}

seedDatabase();

module.exports = { seedDatabase };
