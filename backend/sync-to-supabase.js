/**
 * VoltFlow CSMS - Sync Local SQLite Database to Supabase PostgreSQL
 * 
 * Usage:
 *   node sync-to-supabase.js
 * 
 * Requires in backend/.env:
 *   SUPABASE_URL=https://your-project.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
 */

require('dotenv').config();
const { db } = require('./database');
const { supabase, isSupabaseConfigured } = require('./supabaseClient');

async function syncTable(tableName, rows) {
  if (!rows || rows.length === 0) {
    console.log(`[Sync] Table "${tableName}": 0 rows (skipped)`);
    return;
  }

  console.log(`[Sync] Table "${tableName}": uploading ${rows.length} records...`);
  const { error } = await supabase.from(tableName).upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error(`[Sync] ❌ Error syncing ${tableName}:`, error.message);
  } else {
    console.log(`[Sync] ✅ Successfully synced ${rows.length} rows to "${tableName}"`);
  }
}

async function runSync() {
  if (!isSupabaseConfigured()) {
    console.error('❌ Supabase is not configured! Please provide SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) in backend/.env');
    process.exit(1);
  }

  console.log('========================================================');
  console.log(' VoltFlow CSMS - Syncing Local SQLite Data to Supabase');
  console.log('========================================================');

  try {
    // 1. Users
    const users = db.prepare('SELECT * FROM users').all();
    await syncTable('users', users);

    // 2. Vehicles
    const vehicles = db.prepare('SELECT * FROM vehicles').all();
    await syncTable('vehicles', vehicles);

    // 3. Payment Methods
    const paymentMethods = db.prepare('SELECT * FROM payment_methods').all();
    await syncTable('payment_methods', paymentMethods);

    // 4. Stations
    const stations = db.prepare('SELECT * FROM stations').all();
    await syncTable('stations', stations);

    // 5. Chargers
    const chargers = db.prepare('SELECT * FROM chargers').all();
    await syncTable('chargers', chargers);

    // 6. Bookings
    const bookings = db.prepare('SELECT * FROM bookings').all();
    await syncTable('bookings', bookings);

    // 7. Payments
    const payments = db.prepare('SELECT * FROM payments').all();
    await syncTable('payments', payments);

    // 8. Invoices
    const invoices = db.prepare('SELECT * FROM invoices').all();
    await syncTable('invoices', invoices);

    // 9. Refund Requests
    const refunds = db.prepare('SELECT * FROM refund_requests').all();
    await syncTable('refund_requests', refunds);

    // 10. Audit Logs
    const auditLogs = db.prepare('SELECT * FROM audit_logs').all();
    await syncTable('audit_logs', auditLogs);

    // 11. Charger Status History
    const statusHistory = db.prepare('SELECT * FROM charger_status_history').all();
    await syncTable('charger_status_history', statusHistory);

    console.log('========================================================');
    console.log('🎉 Sync Complete! Supabase now mirrors your local database.');
    console.log('========================================================');
  } catch (err) {
    console.error('Sync failed with unexpected error:', err);
    process.exit(1);
  }
}

runSync();
