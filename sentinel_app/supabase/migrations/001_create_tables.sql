-- ══════════════════════════════════════════════════════════════════════
-- Sentinel Attendance — Database Migration
-- Run this SQL in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. Employees Table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  employee_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  department TEXT NOT NULL,
  designation TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 2. Attendance Table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'absent',
  working_hours DECIMAL(4,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- ── 3. Leave Requests Table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 4. Leave Balance Table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_balance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  total_days INT NOT NULL DEFAULT 0,
  used_days INT NOT NULL DEFAULT 0,
  year INT NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  UNIQUE(employee_id, leave_type, year)
);

-- ══════════════════════════════════════════════════════════════════════
-- Row Level Security (RLS)
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balance ENABLE ROW LEVEL SECURITY;

-- ── Employees Policies ────────────────────────────────────────────────

-- Users can read their own employee profile.
CREATE POLICY "Users can view own employee data"
  ON employees FOR SELECT
  USING (auth.uid() = auth_user_id);

-- Users can insert their own employee profile during registration.
CREATE POLICY "Users can insert own employee data"
  ON employees FOR INSERT
  WITH CHECK (auth.uid() = auth_user_id);

-- ── Attendance Policies ───────────────────────────────────────────────

-- Users can view their own attendance records.
CREATE POLICY "Users can view own attendance"
  ON attendance FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE auth_user_id = auth.uid()
    )
  );

-- ── Leave Requests Policies ──────────────────────────────────────────

-- Users can view their own leave requests.
CREATE POLICY "Users can view own leave requests"
  ON leave_requests FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE auth_user_id = auth.uid()
    )
  );

-- ── Leave Balance Policies ───────────────────────────────────────────

-- Users can view their own leave balance.
CREATE POLICY "Users can view own leave balance"
  ON leave_balance FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE auth_user_id = auth.uid()
    )
  );
