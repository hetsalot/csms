const bcrypt = require('bcryptjs');
const { db } = require('./database');

function seedDatabase(force = true) {
  if (!force) {
    const existingUsers = db.prepare('SELECT count(*) as count FROM users').get();
    if (existingUsers.count > 0) {
      console.log('Database already contains data, skipping seed.');
      return;
    }
  }

  console.log('Clearing existing data and seeding comprehensive demo data...');

  // Disable FK temporarily for atomic clean-slate reseed
  db.pragma('foreign_keys = OFF');
  db.exec(`
    DELETE FROM charger_status_history;
    DELETE FROM audit_logs;
    DELETE FROM refund_requests;
    DELETE FROM invoices;
    DELETE FROM payments;
    DELETE FROM bookings;
    DELETE FROM chargers;
    DELETE FROM stations;
    DELETE FROM payment_methods;
    DELETE FROM vehicles;
    DELETE FROM users;
  `);
  db.pragma('foreign_keys = ON');

  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('Admin@123', salt);
  const operatorHash = bcrypt.hashSync('Operator@123', salt);
  const driverHash = bcrypt.hashSync('Driver@123', salt);

  const now = new Date().toISOString();
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0];
  const twoDaysAgoStr = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const threeDaysAgoStr = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const fiveDaysAgoStr = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString().split('T')[0];

  // ==========================================
  // 1. SEED USERS ACROSS ALL ROLES & STATES
  // ==========================================
  console.log('1. Seeding demo users...');
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, role, status, is_verified, verification_code, organization_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Admin
  insertUser.run('USR-ADMIN-1', 'System Administrator', 'admin@evcharge.com', '+91 9820011223', adminHash, 'admin', 'active', 1, '123456', 'EV Platform HQ', now);

  // Operators (Approved, Pending Approval, Second Operator)
  insertUser.run('USR-OP-1', 'VoltCharge Networks', 'operator@chargehub.com', '+91 9820099887', operatorHash, 'operator', 'active', 1, '123456', 'VoltCharge Pvt Ltd', now);
  insertUser.run('USR-OP-2', 'GreenPower Mobility', 'greenpower@ev.org', '+91 9820055443', operatorHash, 'operator', 'pending_approval', 1, '123456', 'GreenPower CleanTech', now);
  insertUser.run('USR-OP-3', 'Zenith Hubs', 'zenith@gridtech.in', '+91 9820077665', operatorHash, 'operator', 'active', 1, '123456', 'Zenith Grid Infrastructure', now);

  // Drivers (Active and Deactivated)
  insertUser.run('USR-DRV-1', 'Alex Rivera', 'driver@evtravel.com', '+91 9811122334', driverHash, 'driver', 'active', 1, '123456', null, now);
  insertUser.run('USR-DRV-2', 'Siddh Sakariya', 'siddh@example.com', '+91 9822233445', driverHash, 'driver', 'active', 1, '123456', null, now);
  insertUser.run('USR-DRV-3', 'Het Salot', 'het@example.com', '+91 9833344556', driverHash, 'driver', 'active', 1, '123456', null, now);
  insertUser.run('USR-DRV-4', 'Priya Sharma', 'priya@evtravel.com', '+91 9844455667', driverHash, 'driver', 'active', 1, '123456', null, now);
  insertUser.run('USR-DRV-5', 'Marcus Vance (Deactivated)', 'deactivated@example.com', '+91 9855566778', driverHash, 'driver', 'deactivated', 1, '123456', null, now);

  // ==========================================
  // 2. SEED VEHICLES ACROSS DIVERSE CONNECTORS
  // ==========================================
  console.log('2. Seeding vehicles...');
  const insertVehicle = db.prepare(`
    INSERT INTO vehicles (id, driver_id, make, model, connector_type, battery_capacity, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertVehicle.run('VEH-101', 'USR-DRV-1', 'Tesla', 'Model 3 Long Range', 'CCS2', 75.0, now);
  insertVehicle.run('VEH-102', 'USR-DRV-1', 'Hyundai', 'Ioniq 5 AWD', 'CCS2', 72.6, now);
  insertVehicle.run('VEH-103', 'USR-DRV-1', 'Nissan', 'Leaf e+ (CHAdeMO)', 'CHAdeMO', 62.0, now);

  insertVehicle.run('VEH-201', 'USR-DRV-2', 'Tata', 'Nexon EV Max', 'CCS2', 40.5, now);
  insertVehicle.run('VEH-202', 'USR-DRV-2', 'Tata', 'Punch EV Long Range', 'CCS2', 35.0, now);

  insertVehicle.run('VEH-301', 'USR-DRV-3', 'MG', 'ZS EV Exclusive', 'Type 2', 50.3, now);
  insertVehicle.run('VEH-302', 'USR-DRV-3', 'Mahindra', 'XUV400 EL Pro', 'GB/T', 39.4, now);

  insertVehicle.run('VEH-401', 'USR-DRV-4', 'Kia', 'EV6 GT-Line AWD', 'CCS2', 77.4, now);
  insertVehicle.run('VEH-402', 'USR-DRV-4', 'BMW', 'i4 eDrive40', 'CCS2', 83.9, now);

  // ==========================================
  // 3. SEED PAYMENT METHODS
  // ==========================================
  console.log('3. Seeding payment methods...');
  const insertPaymentMethod = db.prepare(`
    INSERT INTO payment_methods (id, driver_id, type, provider, masked_number, token, is_default, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPaymentMethod.run('PM-101', 'USR-DRV-1', 'credit card', 'HDFC Visa Signature', '•••• •••• •••• 4242', 'tok_hdfc_visa_4242', 1, now);
  insertPaymentMethod.run('PM-102', 'USR-DRV-1', 'digital wallet', 'Google Pay UPI', 'alex@okhdfcbank', 'tok_gpay_upi_alex', 0, now);
  insertPaymentMethod.run('PM-103', 'USR-DRV-1', 'debit card', 'ICICI Coral Debit', '•••• •••• •••• 9081', 'tok_icici_coral_9081', 0, now);

  insertPaymentMethod.run('PM-201', 'USR-DRV-2', 'debit card', 'ICICI Mastercard', '•••• •••• •••• 8899', 'tok_icici_mc_8899', 1, now);
  insertPaymentMethod.run('PM-202', 'USR-DRV-2', 'digital wallet', 'PhonePe UPI', 'siddh@ybl', 'tok_phonepe_siddh', 0, now);

  insertPaymentMethod.run('PM-301', 'USR-DRV-3', 'credit card', 'Axis Bank Rupay', '•••• •••• •••• 1234', 'tok_axis_rupay_1234', 1, now);
  insertPaymentMethod.run('PM-302', 'USR-DRV-3', 'digital wallet', 'Paytm Wallet', 'het@paytm', 'tok_paytm_het', 0, now);

  insertPaymentMethod.run('PM-401', 'USR-DRV-4', 'credit card', 'SBI Prime Amex', '•••• •••• •••• 5566', 'tok_sbi_amex_5566', 1, now);

  // ==========================================
  // 4. SEED CHARGING STATIONS
  // ==========================================
  console.log('4. Seeding stations...');
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
    JSON.stringify(['High-Speed Wi-Fi', 'Restroom', 'Café Coffee Day', 'Convenience Store', 'EV Lounge', '24/7 CCTV']),
    now
  );

  insertStation.run(
    'STN-POWAI-02',
    'USR-OP-1',
    'EcoCharge Hub - Powai Hiranandani',
    'Central Avenue, Hiranandani Gardens, Powai, Mumbai 400076',
    19.1176,
    72.9060,
    '06:00 - 23:00',
    'approved',
    JSON.stringify(['Wi-Fi', 'Restroom', 'Covered Canopy', 'Security Guard', 'Juice Bar']),
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
    JSON.stringify(['Restroom', 'Coffee Kiosk', 'Wheelchair Accessible', 'Tire Air Station']),
    now
  );

  insertStation.run(
    'STN-VASHI-04',
    'USR-OP-1',
    'GreenGrid HyperHub - Navi Mumbai Vashi',
    'Palm Beach Galleria, Sector 17, Vashi, Navi Mumbai 400703',
    19.0771,
    72.9986,
    '24/7',
    'approved',
    JSON.stringify(['Food Court', 'Restroom', 'Shopping Mall Parking', 'Free Wi-Fi']),
    now
  );

  insertStation.run(
    'STN-ANDHERI-05',
    'USR-OP-2',
    'Apex FastCharge - Andheri East (Pending Approval)',
    'MIDC Central Road, Andheri East, Mumbai 400093',
    19.1136,
    72.8697,
    '07:00 - 22:00',
    'pending approval',
    JSON.stringify(['Restroom', 'Snack Bar']),
    now
  );

  insertStation.run(
    'STN-LOWERPAREL-06',
    'USR-OP-3',
    'Zenith Phoenix SpeedHub - Lower Parel',
    'High Street Phoenix, Senapati Bapat Marg, Lower Parel, Mumbai 400013',
    19.0016,
    72.8272,
    '24/7',
    'approved',
    JSON.stringify(['Valet EV Parking', 'EV Drivers Lounge', 'Premium Cafe', 'Ultra-fast Wi-Fi']),
    now
  );

  insertStation.run(
    'STN-THANE-07',
    'USR-OP-1',
    'VoltCharge Express - Thane Viviana',
    'Eastern Express Highway, Service Rd, Thane West, Maharashtra 400606',
    19.2089,
    72.9715,
    '24/7',
    'approved',
    JSON.stringify(['Food Court', 'Restroom', 'Cinépolis Access', '24/7 Security']),
    now
  );

  insertStation.run(
    'STN-AIRPORT-08',
    'USR-OP-1',
    'AeroCharge Terminal Hub - Mumbai Airport T2 (Suspended)',
    'Chhatrapati Shivaji Maharaj International Airport T2, Sahar, Mumbai 400099',
    19.0968,
    72.8744,
    '24/7',
    'suspended',
    JSON.stringify(['Restroom', 'Baggage Wrap', 'Costa Coffee']),
    now
  );

  // ==========================================
  // 5. SEED CHARGERS (ALL CONNECTOR & SPEED TYPES)
  // ==========================================
  console.log('5. Seeding chargers...');
  const insertCharger = db.prepare(`
    INSERT INTO chargers (id, station_id, name, connector_type, power_rating, speed_category, status, pricing_type, price_rate, idle_fee, last_heartbeat, current_booking_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // BKC Chargers (STN-BKC-01)
  insertCharger.run('CHG-BKC-101', 'STN-BKC-01', 'Bay 1 - DC Ultra Fast 150kW', 'CCS2', 150.0, 'rapid', 'available', 'per_kwh', 19.50, 4.0, now, null, now);
  insertCharger.run('CHG-BKC-102', 'STN-BKC-01', 'Bay 2 - DC Fast 60kW', 'CCS2', 60.0, 'fast', 'charging', 'per_kwh', 17.50, 3.0, now, 'BK-1007', now);
  insertCharger.run('CHG-BKC-103', 'STN-BKC-01', 'Bay 3 - CHAdeMO Fast 50kW', 'CHAdeMO', 50.0, 'fast', 'available', 'per_kwh', 17.00, 3.0, now, null, now);
  insertCharger.run('CHG-BKC-104', 'STN-BKC-01', 'Bay 4 - AC Dual 22kW', 'Type 2', 22.0, 'fast', 'reserved', 'per_minute', 2.20, 2.0, now, 'BK-1002', now);
  insertCharger.run('CHG-BKC-105', 'STN-BKC-01', 'Bay 5 - Bharat DC001 15kW', 'GB/T', 15.0, 'slow', 'available', 'per_kwh', 14.50, 2.0, now, null, now);

  // Powai Chargers (STN-POWAI-02)
  insertCharger.run('CHG-POW-201', 'STN-POWAI-02', 'Bay 1 - DC Hyper 120kW', 'CCS2', 120.0, 'rapid', 'available', 'per_kwh', 18.00, 3.5, now, null, now);
  insertCharger.run('CHG-POW-202', 'STN-POWAI-02', 'Bay 2 - AC Fast 22kW', 'Type 2', 22.0, 'fast', 'available', 'per_minute', 2.00, 2.0, now, null, now);
  insertCharger.run('CHG-POW-203', 'STN-POWAI-02', 'Bay 3 - DC Rapid 50kW', 'CHAdeMO', 50.0, 'fast', 'faulted', 'per_kwh', 16.50, 2.5, now, null, now);
  insertCharger.run('CHG-POW-204', 'STN-POWAI-02', 'Bay 4 - Bharat DC 25kW', 'GB/T', 25.0, 'fast', 'available', 'per_kwh', 15.00, 2.0, now, null, now);

  // Bandra Chargers (STN-BANDRA-03)
  insertCharger.run('CHG-BAN-301', 'STN-BANDRA-03', 'Bay 1 - Supercharger 150kW', 'CCS2', 150.0, 'rapid', 'available', 'per_kwh', 20.00, 4.0, now, null, now);
  insertCharger.run('CHG-BAN-302', 'STN-BANDRA-03', 'Bay 2 - Smart AC 11kW', 'Type 2', 11.0, 'slow', 'available', 'per_minute', 1.80, 1.5, now, null, now);
  insertCharger.run('CHG-BAN-303', 'STN-BANDRA-03', 'Bay 3 - Dual CCS2 60kW', 'CCS2', 60.0, 'fast', 'available', 'per_kwh', 18.50, 3.0, now, null, now);

  // Vashi Chargers (STN-VASHI-04)
  insertCharger.run('CHG-VAS-401', 'STN-VASHI-04', 'Bay 1 - DC Fast 60kW', 'CCS2', 60.0, 'fast', 'available', 'per_kwh', 16.00, 2.5, now, null, now);
  insertCharger.run('CHG-VAS-402', 'STN-VASHI-04', 'Bay 2 - GB/T Fast 30kW', 'GB/T', 30.0, 'fast', 'out of service', 'per_kwh', 15.00, 2.0, now, null, now);
  insertCharger.run('CHG-VAS-403', 'STN-VASHI-04', 'Bay 3 - Type 2 Smart 22kW', 'Type 2', 22.0, 'fast', 'available', 'per_minute', 1.90, 2.0, now, null, now);

  // Andheri Chargers (STN-ANDHERI-05 - Pending Station)
  insertCharger.run('CHG-AND-501', 'STN-ANDHERI-05', 'Bay 1 - DC 50kW', 'CCS2', 50.0, 'fast', 'available', 'per_kwh', 17.00, 3.0, now, null, now);
  insertCharger.run('CHG-AND-502', 'STN-ANDHERI-05', 'Bay 2 - AC 22kW', 'Type 2', 22.0, 'fast', 'available', 'per_minute', 2.00, 2.0, now, null, now);

  // Lower Parel Chargers (STN-LOWERPAREL-06 - Zenith)
  insertCharger.run('CHG-LP-601', 'STN-LOWERPAREL-06', 'Bay 1 - Ultra DC 180kW', 'CCS2', 180.0, 'rapid', 'available', 'per_kwh', 21.00, 4.5, now, null, now);
  insertCharger.run('CHG-LP-602', 'STN-LOWERPAREL-06', 'Bay 2 - Ultra DC 120kW', 'CCS2', 120.0, 'rapid', 'available', 'per_kwh', 19.00, 3.5, now, null, now);
  insertCharger.run('CHG-LP-603', 'STN-LOWERPAREL-06', 'Bay 3 - Dual Type 2 22kW', 'Type 2', 22.0, 'fast', 'available', 'per_minute', 2.20, 2.0, now, null, now);

  // Thane Chargers (STN-THANE-07)
  insertCharger.run('CHG-THA-701', 'STN-THANE-07', 'Bay 1 - DC Fast 60kW', 'CCS2', 60.0, 'fast', 'available', 'per_kwh', 17.00, 3.0, now, null, now);
  insertCharger.run('CHG-THA-702', 'STN-THANE-07', 'Bay 2 - Bharat DC 15kW', 'GB/T', 15.0, 'slow', 'available', 'per_kwh', 14.50, 2.0, now, null, now);

  // Airport Chargers (STN-AIRPORT-08 - Suspended)
  insertCharger.run('CHG-AIR-801', 'STN-AIRPORT-08', 'Bay 1 - Rapid DC 100kW', 'CCS2', 100.0, 'rapid', 'out of service', 'per_kwh', 22.00, 5.0, now, null, now);

  // ==========================================
  // 6. SEED BOOKINGS (COMPLETED, CONFIRMED, IN-PROGRESS, CANCELED, NO-SHOW)
  // ==========================================
  console.log('6. Seeding bookings...');
  const insertBooking = db.prepare(`
    INSERT INTO bookings (
      id, booking_number, driver_id, charger_id, station_id, vehicle_id,
      booking_date, start_time, end_time, estimated_duration_mins, target_battery_percent,
      estimated_cost, final_cost, energy_delivered_kwh, status, payment_hold_id, cancellation_reason, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // BK-1001: Completed session (Alex Rivera)
  insertBooking.run(
    'BK-1001', 1001, 'USR-DRV-1', 'CHG-BKC-101', 'STN-BKC-01', 'VEH-101',
    threeDaysAgoStr, '14:00', '14:45', 45, 80, 585.00, 592.80, 30.4, 'completed', 'HOLD-1001',
    null,
    new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    new Date(Date.now() - 3 * 24 * 3600 * 1000 + 45 * 60 * 1000).toISOString()
  );

  // BK-1002: Confirmed reservation for today (Alex Rivera)
  insertBooking.run(
    'BK-1002', 1002, 'USR-DRV-1', 'CHG-BKC-104', 'STN-BKC-01', 'VEH-101',
    todayStr, '17:00', '17:45', 45, 85, 390.00, null, 0, 'confirmed', 'HOLD-1002',
    null,
    now, now
  );

  // BK-1003: Completed session (Siddh Sakariya)
  insertBooking.run(
    'BK-1003', 1003, 'USR-DRV-2', 'CHG-POW-201', 'STN-POWAI-02', 'VEH-201',
    twoDaysAgoStr, '11:00', '11:35', 35, 80, 450.00, 441.00, 24.5, 'completed', 'HOLD-1003',
    null,
    new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    new Date(Date.now() - 2 * 24 * 3600 * 1000 + 35 * 60 * 1000).toISOString()
  );

  // BK-1004: Completed session (Het Salot)
  insertBooking.run(
    'BK-1004', 1004, 'USR-DRV-3', 'CHG-BKC-102', 'STN-BKC-01', 'VEH-301',
    fiveDaysAgoStr, '09:30', '10:00', 30, 75, 350.00, 318.50, 18.2, 'completed', 'HOLD-1004',
    null,
    new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    new Date(Date.now() - 5 * 24 * 3600 * 1000 + 30 * 60 * 1000).toISOString()
  );

  // BK-1005: Completed session (Alex Rivera)
  insertBooking.run(
    'BK-1005', 1005, 'USR-DRV-1', 'CHG-BAN-301', 'STN-BANDRA-03', 'VEH-102',
    twoDaysAgoStr, '16:00', '16:50', 50, 90, 800.00, 820.95, 42.1, 'completed', 'HOLD-1005',
    null,
    new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    new Date(Date.now() - 2 * 24 * 3600 * 1000 + 50 * 60 * 1000).toISOString()
  );

  // BK-1006: Completed session (Priya Sharma)
  insertBooking.run(
    'BK-1006', 1006, 'USR-DRV-4', 'CHG-LP-601', 'STN-LOWERPAREL-06', 'VEH-401',
    yesterdayStr, '13:00', '13:40', 40, 85, 700.00, 716.00, 35.8, 'completed', 'HOLD-1006',
    null,
    new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    new Date(Date.now() - 24 * 3600 * 1000 + 40 * 60 * 1000).toISOString()
  );

  // BK-1007: Active IN-PROGRESS charging session for Alex Rivera right now!
  insertBooking.run(
    'BK-1007', 1007, 'USR-DRV-1', 'CHG-BKC-102', 'STN-BKC-01', 'VEH-101',
    todayStr, '10:30', '11:15', 45, 85, 525.00, null, 14.8, 'in-progress', 'HOLD-1007',
    null,
    new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    now
  );

  // BK-1008: Canceled booking (demonstrating cancellation reason & lifecycle)
  insertBooking.run(
    'BK-1008', 1008, 'USR-DRV-2', 'CHG-POW-201', 'STN-POWAI-02', 'VEH-201',
    yesterdayStr, '18:00', '18:30', 30, 80, 360.00, null, 0, 'canceled', 'HOLD-1008',
    'Driver canceled slot: Route traffic delay, chose alternate fast-charger hub.',
    new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    new Date(Date.now() - 22 * 3600 * 1000).toISOString()
  );

  // BK-1009: No-show booking (demonstrating automated penalty / no-show flag)
  insertBooking.run(
    'BK-1009', 1009, 'USR-DRV-3', 'CHG-BKC-101', 'STN-BKC-01', 'VEH-301',
    yesterdayStr, '15:00', '15:30', 30, 80, 585.00, 100.00, 0, 'no-show', 'HOLD-1009',
    'Driver did not arrive within the 15-minute grace window.',
    new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    new Date(Date.now() - 23 * 3600 * 1000).toISOString()
  );

  // BK-1010: Confirmed future booking for tomorrow (Priya Sharma)
  insertBooking.run(
    'BK-1010', 1010, 'USR-DRV-4', 'CHG-LP-601', 'STN-LOWERPAREL-06', 'VEH-402',
    tomorrowStr, '14:00', '14:45', 45, 80, 750.00, null, 0, 'confirmed', 'HOLD-1010',
    null,
    now, now
  );

  // ==========================================
  // 7. SEED PAYMENTS & INVOICES
  // ==========================================
  console.log('7. Seeding payments and invoices...');
  const insertPayment = db.prepare(`
    INSERT INTO payments (id, booking_id, driver_id, amount, method_type, status, gateway_transaction_id, hold_amount, captured_amount, refunded_amount, created_at, captured_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertInvoice = db.prepare(`
    INSERT INTO invoices (id, booking_id, driver_id, energy_delivered_kwh, duration_mins, unit_price, pricing_model, subtotal, taxes, total_cost, status, issued_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // BK-1001 Payment & Invoice (Disputed - Pending refund request)
  insertPayment.run(
    'PAY-5001', 'BK-1001', 'USR-DRV-1', 592.80, 'credit card', 'captured',
    'txn_pg_live_994821', 585.00, 592.80, 0,
    new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    new Date(Date.now() - 3 * 24 * 3600 * 1000 + 45 * 60 * 1000).toISOString()
  );
  insertInvoice.run(
    'INV-9001', 'BK-1001', 'USR-DRV-1', 30.4, 45, 19.50, '₹19.50 / kWh',
    592.80, 0.0, 592.80, 'disputed',
    new Date(Date.now() - 3 * 24 * 3600 * 1000 + 45 * 60 * 1000).toISOString()
  );

  // BK-1003 Payment & Invoice (Disputed - Pending refund request)
  insertPayment.run(
    'PAY-5003', 'BK-1003', 'USR-DRV-2', 441.00, 'debit card', 'captured',
    'txn_pg_live_443918', 450.00, 441.00, 0,
    new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    new Date(Date.now() - 2 * 24 * 3600 * 1000 + 35 * 60 * 1000).toISOString()
  );
  insertInvoice.run(
    'INV-9002', 'BK-1003', 'USR-DRV-2', 24.5, 35, 18.00, '₹18.00 / kWh',
    441.00, 0.0, 441.00, 'disputed',
    new Date(Date.now() - 2 * 24 * 3600 * 1000 + 35 * 60 * 1000).toISOString()
  );

  // BK-1004 Payment & Invoice (Refunded - Approved refund request)
  insertPayment.run(
    'PAY-5004', 'BK-1004', 'USR-DRV-3', 318.50, 'credit card', 'refunded',
    'txn_pg_live_112094', 350.00, 318.50, 220.00,
    new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    new Date(Date.now() - 5 * 24 * 3600 * 1000 + 30 * 60 * 1000).toISOString()
  );
  insertInvoice.run(
    'INV-9003', 'BK-1004', 'USR-DRV-3', 18.2, 30, 17.50, '₹17.50 / kWh',
    318.50, 0.0, 318.50, 'refunded',
    new Date(Date.now() - 5 * 24 * 3600 * 1000 + 30 * 60 * 1000).toISOString()
  );

  // BK-1005 Payment & Invoice (Paid - Rejected refund claim)
  insertPayment.run(
    'PAY-5005', 'BK-1005', 'USR-DRV-1', 820.95, 'credit card', 'captured',
    'txn_pg_live_883190', 800.00, 820.95, 0,
    new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    new Date(Date.now() - 2 * 24 * 3600 * 1000 + 50 * 60 * 1000).toISOString()
  );
  insertInvoice.run(
    'INV-9004', 'BK-1005', 'USR-DRV-1', 42.1, 50, 19.50, '₹19.50 / kWh',
    820.95, 0.0, 820.95, 'paid',
    new Date(Date.now() - 2 * 24 * 3600 * 1000 + 50 * 60 * 1000).toISOString()
  );

  // BK-1006 Payment & Invoice (Paid - Regular completed session)
  insertPayment.run(
    'PAY-5006', 'BK-1006', 'USR-DRV-4', 716.00, 'credit card', 'captured',
    'txn_pg_live_771924', 700.00, 716.00, 0,
    new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    new Date(Date.now() - 24 * 3600 * 1000 + 40 * 60 * 1000).toISOString()
  );
  insertInvoice.run(
    'INV-9005', 'BK-1006', 'USR-DRV-4', 35.8, 40, 20.00, '₹20.00 / kWh',
    716.00, 0.0, 716.00, 'paid',
    new Date(Date.now() - 24 * 3600 * 1000 + 40 * 60 * 1000).toISOString()
  );

  // ==========================================
  // 8. SEED REFUND REQUESTS (FOR OPERATOR & ADMIN REVIEW)
  // ==========================================
  console.log('8. Seeding refund requests...');
  const insertRefund = db.prepare(`
    INSERT INTO refund_requests (id, booking_id, invoice_id, driver_id, station_id, reason, amount, status, operator_notes, created_at, reviewed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Pending refund 1 (Alex Rivera on BKC Station) -> Ready for Operator to Approve/Reject!
  insertRefund.run(
    'REF-001',
    'BK-1001',
    'INV-9001',
    'USR-DRV-1',
    'STN-BKC-01',
    'Connector dropped communication 4 mins into charging session due to ground fault. Car disconnected, but full hold amount of ₹592.80 was captured.',
    592.80,
    'pending',
    null,
    new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    null
  );

  // Pending refund 2 (Siddh Sakariya on Powai Hub) -> Ready for Operator to Approve/Reject!
  insertRefund.run(
    'REF-002',
    'BK-1003',
    'INV-9002',
    'USR-DRV-2',
    'STN-POWAI-02',
    'Station experienced grid voltage dip; charging speed dropped to 3kW for 20 mins while port remained locked, inflating duration.',
    390.00,
    'pending',
    null,
    new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    null
  );

  // Approved refund (Het Salot on BKC Station)
  insertRefund.run(
    'REF-003',
    'BK-1004',
    'INV-9003',
    'USR-DRV-3',
    'STN-BKC-01',
    'Billing discrepancy: Rate was listed as ₹15.00/kWh in the app, but invoiced at ₹17.50/kWh.',
    220.00,
    'approved',
    'Rate discrepancy verified against OCPP meter stream. Partial refund of ₹220 approved and processed to original card.',
    new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
    new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
  );

  // Rejected refund (Alex Rivera on Bandra West)
  insertRefund.run(
    'REF-004',
    'BK-1005',
    'INV-9004',
    'USR-DRV-1',
    'STN-BANDRA-03',
    'Requesting refund of ₹150 idle fee charged after car finished charging.',
    150.00,
    'rejected',
    'Rejected: Telemetry shows vehicle reached 100% SoC and remained plugged into Bay 1 for 55 minutes past the 15-minute grace period.',
    new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
  );

  // ==========================================
  // 9. SEED AUDIT LOGS
  // ==========================================
  console.log('9. Seeding audit logs...');
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, user_id, user_name, user_role, action, target_type, target_id, details, ip_address, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const auditEvents = [
    { id: 'LOG-001', uid: 'USR-ADMIN-1', name: 'System Administrator', role: 'admin', act: 'SYSTEM_INITIALIZED', tt: 'system', tid: 'CORE', det: 'System core services initialized and calibrated', ip: '127.0.0.1', ts: fiveDaysAgoStr },
    { id: 'LOG-002', uid: 'USR-ADMIN-1', name: 'System Administrator', role: 'admin', act: 'STATION_APPROVED', tt: 'station', tid: 'STN-BKC-01', det: 'Approved VoltCharge SuperHub - BKC after safety compliance check', ip: '127.0.0.1', ts: fiveDaysAgoStr },
    { id: 'LOG-003', uid: 'USR-ADMIN-1', name: 'System Administrator', role: 'admin', act: 'STATION_APPROVED', tt: 'station', tid: 'STN-POWAI-02', det: 'Approved EcoCharge Hub - Powai Hiranandani', ip: '127.0.0.1', ts: fiveDaysAgoStr },
    { id: 'LOG-004', uid: 'USR-ADMIN-1', name: 'System Administrator', role: 'admin', act: 'STATION_APPROVED', tt: 'station', tid: 'STN-BANDRA-03', det: 'Approved ElectraDrive Gateway - Bandra West', ip: '127.0.0.1', ts: fourDaysAgoStr = new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString().split('T')[0] },
    { id: 'LOG-005', uid: 'USR-ADMIN-1', name: 'System Administrator', role: 'admin', act: 'STATION_APPROVED', tt: 'station', tid: 'STN-VASHI-04', det: 'Approved GreenGrid HyperHub - Navi Mumbai Vashi', ip: '127.0.0.1', ts: fourDaysAgoStr },
    { id: 'LOG-006', uid: 'USR-OP-1', name: 'VoltCharge Networks', role: 'operator', act: 'PRICING_UPDATED', tt: 'charger', tid: 'CHG-BKC-101', det: 'Updated DC Ultra Fast tariff to ₹19.50/kWh', ip: '192.168.1.10', ts: threeDaysAgoStr },
    { id: 'LOG-007', uid: 'USR-DRV-1', name: 'Alex Rivera', role: 'driver', act: 'BOOKING_CREATED', tt: 'booking', tid: 'BK-1001', det: 'Booked slot on Bay 1 - DC Ultra Fast 150kW at VoltCharge SuperHub - BKC', ip: '192.168.1.42', ts: threeDaysAgoStr },
    { id: 'LOG-008', uid: 'USR-DRV-1', name: 'Alex Rivera', role: 'driver', act: 'CHARGING_STARTED', tt: 'charger', tid: 'CHG-BKC-101', det: 'OCPP RemoteStartTransaction acknowledged by Bay 1', ip: '192.168.1.42', ts: threeDaysAgoStr },
    { id: 'LOG-009', uid: 'USR-DRV-1', name: 'Alex Rivera', role: 'driver', act: 'PAYMENT_CAPTURED', tt: 'payment', tid: 'PAY-5001', det: 'Captured ₹592.80 via HDFC Visa Signature (tok_hdfc_visa_4242)', ip: '192.168.1.42', ts: threeDaysAgoStr },
    { id: 'LOG-010', uid: 'USR-DRV-1', name: 'Alex Rivera', role: 'driver', act: 'REFUND_REQUESTED', tt: 'refund', tid: 'REF-001', det: 'Submitted refund claim for ₹592.80 (Invoice INV-9001)', ip: '192.168.1.42', ts: twoDaysAgoStr },
    { id: 'LOG-011', uid: 'USR-OP-1', name: 'VoltCharge Networks', role: 'operator', act: 'CHARGER_FAULT_LOGGED', tt: 'charger', tid: 'CHG-POW-203', det: 'OCPP Fault Notification: High Ground Impedance Detected on Bay 3', ip: '192.168.1.15', ts: twoDaysAgoStr },
    { id: 'LOG-012', uid: 'USR-DRV-2', name: 'Siddh Sakariya', role: 'driver', act: 'BOOKING_CANCELED', tt: 'booking', tid: 'BK-1008', det: 'Canceled slot on CHG-POW-201. Pre-authorization hold released.', ip: '192.168.1.55', ts: yesterdayStr },
    { id: 'LOG-013', uid: 'USR-ADMIN-1', name: 'System Administrator', role: 'admin', act: 'STATION_SUSPENDED', tt: 'station', tid: 'STN-AIRPORT-08', det: 'Station suspended pending terminal redevelopment compliance check', ip: '127.0.0.1', ts: yesterdayStr },
    { id: 'LOG-014', uid: 'USR-OP-1', name: 'VoltCharge Networks', role: 'operator', act: 'REFUND_REVIEWED', tt: 'refund', tid: 'REF-003', det: 'Approved refund claim REF-003 for Het Salot (₹220.00)', ip: '192.168.1.10', ts: yesterdayStr },
    { id: 'LOG-015', uid: 'USR-ADMIN-1', name: 'System Administrator', role: 'admin', act: 'USER_DEACTIVATED', tt: 'user', tid: 'USR-DRV-5', det: 'Account Marcus Vance deactivated per safety compliance review', ip: '127.0.0.1', ts: yesterdayStr },
    { id: 'LOG-016', uid: 'USR-DRV-1', name: 'Alex Rivera', role: 'driver', act: 'CHARGING_STARTED', tt: 'charger', tid: 'CHG-BKC-102', det: 'Active session started on Bay 2 - DC Fast 60kW (BK-1007)', ip: '192.168.1.42', ts: now }
  ];

  auditEvents.forEach(e => {
    insertAudit.run(e.id, e.uid, e.name, e.role, e.act, e.tt, e.tid, e.det, e.ip, e.ts);
  });

  // ==========================================
  // 10. SEED CHARGER STATUS HISTORY (90-DAY LOGS)
  // ==========================================
  console.log('10. Seeding charger status history...');
  const insertHistory = db.prepare(`
    INSERT INTO charger_status_history (id, charger_id, previous_status, new_status, changed_by, reason, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertHistory.run('HST-001', 'CHG-BKC-102', 'available', 'charging', 'Alex Rivera', 'OCPP RemoteStartTransaction acknowledged', now);
  insertHistory.run('HST-002', 'CHG-POW-203', 'available', 'faulted', 'Hardware Sensor', 'OCPP Fault Notification: High Ground Impedance Detected', twoDaysAgoStr);
  insertHistory.run('HST-003', 'CHG-BKC-104', 'available', 'reserved', 'System Scheduler', 'Driver reservation confirmed (BK-1002)', now);
  insertHistory.run('HST-004', 'CHG-VAS-402', 'available', 'out of service', 'VoltCharge Networks', 'Scheduled connector maintenance & firmware upgrade v2.4', threeDaysAgoStr);
  insertHistory.run('HST-005', 'CHG-BKC-101', 'charging', 'available', 'System Automated', 'Session completed and payment captured (BK-1001)', threeDaysAgoStr);

  console.log('✅ Entire database seeded successfully with comprehensive, realistic mock data!');
}

seedDatabase(true);

module.exports = { seedDatabase };
