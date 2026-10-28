-- =====================================================================
-- VoltFlow CSMS - Complete Supabase PostgreSQL Schema & Migrations
-- Compatible with Supabase SQL Editor (Run all in 1 click)
-- =====================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS public.users (
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Vehicles Table
CREATE TABLE IF NOT EXISTS public.vehicles (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  connector_type TEXT NOT NULL CHECK(connector_type IN ('CCS2', 'CHAdeMO', 'Type 2', 'GB/T')),
  battery_capacity NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Payment Methods Table
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('credit card', 'debit card', 'digital wallet')),
  provider TEXT NOT NULL,
  masked_number TEXT NOT NULL,
  token TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Stations Table
CREATE TABLE IF NOT EXISTS public.stations (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL REFERENCES public.users(id),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  operating_hours TEXT NOT NULL DEFAULT '24/7',
  approval_status TEXT NOT NULL DEFAULT 'pending approval' CHECK(approval_status IN ('pending approval', 'approved', 'rejected', 'suspended')),
  amenities TEXT DEFAULT '["Wi-Fi", "Restroom", "Cafe"]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Chargers Table
CREATE TABLE IF NOT EXISTS public.chargers (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  connector_type TEXT NOT NULL CHECK(connector_type IN ('CCS2', 'CHAdeMO', 'Type 2', 'GB/T')),
  power_rating NUMERIC NOT NULL,
  speed_category TEXT NOT NULL CHECK(speed_category IN ('slow', 'fast', 'rapid')),
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'reserved', 'charging', 'faulted', 'out of service')),
  pricing_type TEXT NOT NULL DEFAULT 'per_kwh' CHECK(pricing_type IN ('per_kwh', 'per_minute')),
  price_rate NUMERIC NOT NULL,
  idle_fee NUMERIC DEFAULT 0.0,
  last_heartbeat TIMESTAMPTZ,
  current_booking_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY,
  booking_number INTEGER UNIQUE NOT NULL,
  driver_id TEXT NOT NULL REFERENCES public.users(id),
  charger_id TEXT NOT NULL REFERENCES public.chargers(id),
  station_id TEXT NOT NULL REFERENCES public.stations(id),
  vehicle_id TEXT REFERENCES public.vehicles(id),
  booking_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  estimated_duration_mins INTEGER NOT NULL,
  target_battery_percent INTEGER,
  estimated_cost NUMERIC NOT NULL,
  final_cost NUMERIC,
  energy_delivered_kwh NUMERIC DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('incomplete', 'confirmed', 'in-progress', 'completed', 'canceled', 'no-show')),
  payment_hold_id TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
  id TEXT PRIMARY KEY,
  booking_id TEXT UNIQUE NOT NULL REFERENCES public.bookings(id),
  driver_id TEXT NOT NULL REFERENCES public.users(id),
  amount NUMERIC NOT NULL,
  method_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('authorized', 'captured', 'failed', 'refunded')),
  gateway_transaction_id TEXT NOT NULL,
  hold_amount NUMERIC NOT NULL,
  captured_amount NUMERIC,
  refunded_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  captured_at TIMESTAMPTZ
);

-- 8. Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY,
  booking_id TEXT UNIQUE NOT NULL REFERENCES public.bookings(id),
  driver_id TEXT NOT NULL REFERENCES public.users(id),
  energy_delivered_kwh NUMERIC NOT NULL,
  duration_mins INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  pricing_model TEXT NOT NULL,
  subtotal NUMERIC NOT NULL,
  taxes NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid' CHECK(status IN ('paid', 'refunded', 'disputed')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Refund Requests Table
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES public.bookings(id),
  invoice_id TEXT NOT NULL REFERENCES public.invoices(id),
  driver_id TEXT NOT NULL REFERENCES public.users(id),
  station_id TEXT NOT NULL REFERENCES public.stations(id),
  reason TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  operator_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- 10. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details TEXT,
  ip_address TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Charger Status History Table
CREATE TABLE IF NOT EXISTS public.charger_status_history (
  id TEXT PRIMARY KEY,
  charger_id TEXT NOT NULL REFERENCES public.chargers(id),
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT,
  reason TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stations_operator ON public.stations(operator_id);
CREATE INDEX IF NOT EXISTS idx_chargers_station ON public.chargers(station_id);
CREATE INDEX IF NOT EXISTS idx_bookings_driver ON public.bookings(driver_id);
CREATE INDEX IF NOT EXISTS idx_bookings_charger ON public.bookings(charger_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON public.audit_logs(timestamp);

-- Enable Row Level Security (RLS) but allow service role and full authenticated access
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chargers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charger_status_history ENABLE ROW LEVEL SECURITY;

-- Public read policies for standard discovery
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read stations') THEN
    CREATE POLICY "Allow public read stations" ON public.stations FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read chargers') THEN
    CREATE POLICY "Allow public read chargers" ON public.chargers FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow service role all users') THEN
    CREATE POLICY "Allow service role all users" ON public.users FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow service role all stations') THEN
    CREATE POLICY "Allow service role all stations" ON public.stations FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow service role all chargers') THEN
    CREATE POLICY "Allow service role all chargers" ON public.chargers FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow service role all bookings') THEN
    CREATE POLICY "Allow service role all bookings" ON public.bookings FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow service role all payments') THEN
    CREATE POLICY "Allow service role all payments" ON public.payments FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow service role all invoices') THEN
    CREATE POLICY "Allow service role all invoices" ON public.invoices FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow service role all refunds') THEN
    CREATE POLICY "Allow service role all refunds" ON public.refund_requests FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow service role all vehicles') THEN
    CREATE POLICY "Allow service role all vehicles" ON public.vehicles FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow service role all payment_methods') THEN
    CREATE POLICY "Allow service role all payment_methods" ON public.payment_methods FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow service role all audit_logs') THEN
    CREATE POLICY "Allow service role all audit_logs" ON public.audit_logs FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow service role all status_history') THEN
    CREATE POLICY "Allow service role all status_history" ON public.charger_status_history FOR ALL USING (true);
  END IF;
END $$;
