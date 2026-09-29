/**
 * Leave Management — API Integration Test Script
 * ================================================
 * Seeds test data (department, users, employees) in MongoDB, then tests:
 *  1. POST /api/leave (submit as employee)
 *  2. POST /api/leave with overlapping dates (expect 400)
 *  3. GET /api/leave as employee (own only)
 *  4. GET /api/leave as manager (same department)
 *  5. GET /api/leave as admin (all)
 *  6. PUT /api/leave/:id/approve as wrong-department manager (expect 403)
 *  7. PUT /api/leave/:id/approve as same-department manager (expect 200)
 *  8. Verify Attendance records have status 'on-leave'
 *  9. PUT /api/leave/:id/deny (submit another, then deny)
 *
 * Usage:
 *   1. Make sure .env has MONGO_URI set to your Atlas cluster
 *   2. Start the server: npm run dev
 *   3. In another terminal: node test_leave.js
 *
 * This script cleans up its own test data on exit.
 */

const BASE = process.env.API_BASE || 'http://localhost:5000';

async function req(method, path, body, headers = {}) {
  const url = BASE + path;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  const data = await resp.json().catch(() => null);
  return { status: resp.status, data };
}

// ── Test State ───────────────────────────────────────────────────
// We'll seed data directly via mongoose, then test via HTTP
const mongoose  = require('mongoose');
const User       = require('./shared/models/User');
const Employee   = require('./shared/models/Employee');
const Department = require('./shared/models/Department');
const LeaveRequest = require('./shared/models/LeaveRequest');
const Attendance   = require('./shared/models/Attendance');

require('dotenv').config();

let dept1, dept2;
let empUser, mgrUser, mgrUser2, adminUser;
let empRecord, mgrRecord, mgr2Record, adminRecord;

async function seed() {
  console.log('🌱 Seeding test data...');

  // Two departments
  dept1 = await Department.create({ name: 'TEST_Engineering' });
  dept2 = await Department.create({ name: 'TEST_Marketing' });

  // Users
  empUser   = await User.create({ name: 'Test Employee',  email: 'test_emp@test.com',    password_hash: 'x', role: 'employee' });
  mgrUser   = await User.create({ name: 'Test Manager',   email: 'test_mgr@test.com',    password_hash: 'x', role: 'manager' });
  mgrUser2  = await User.create({ name: 'Test Manager2',  email: 'test_mgr2@test.com',   password_hash: 'x', role: 'manager' });
  adminUser = await User.create({ name: 'Test Admin',     email: 'test_admin@test.com',   password_hash: 'x', role: 'admin' });

  // Employees — emp + mgr in dept1, mgr2 in dept2
  empRecord   = await Employee.create({ user_id: empUser._id,   department_id: dept1._id, designation: 'Engineer',  date_of_joining: new Date() });
  mgrRecord   = await Employee.create({ user_id: mgrUser._id,   department_id: dept1._id, designation: 'TechLead',  date_of_joining: new Date() });
  mgr2Record  = await Employee.create({ user_id: mgrUser2._id,  department_id: dept2._id, designation: 'MktgLead',  date_of_joining: new Date() });
  adminRecord = await Employee.create({ user_id: adminUser._id, department_id: dept1._id, designation: 'SysAdmin',  date_of_joining: new Date() });

  console.log('   dept1:', dept1._id.toString());
  console.log('   dept2:', dept2._id.toString());
  console.log('   employee:', empUser._id.toString(), '→ emp record:', empRecord._id.toString());
  console.log('   manager (dept1):', mgrUser._id.toString(), '→ emp record:', mgrRecord._id.toString());
  console.log('   manager (dept2):', mgrUser2._id.toString(), '→ emp record:', mgr2Record._id.toString());
  console.log('   admin:', adminUser._id.toString(), '→ emp record:', adminRecord._id.toString());
}

function empHeaders() {
  return { 'x-user-id': empUser._id.toString(), 'x-user-role': 'employee', 'x-employee-id': empRecord._id.toString() };
}
function mgrHeaders() {
  return { 'x-user-id': mgrUser._id.toString(), 'x-user-role': 'manager', 'x-employee-id': mgrRecord._id.toString() };
}
function mgr2Headers() {
  return { 'x-user-id': mgrUser2._id.toString(), 'x-user-role': 'manager', 'x-employee-id': mgr2Record._id.toString() };
}
function adminHeaders() {
  return { 'x-user-id': adminUser._id.toString(), 'x-user-role': 'admin', 'x-employee-id': adminRecord._id.toString() };
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  const empIds = [empRecord._id, mgrRecord._id, mgr2Record._id, adminRecord._id];
  await LeaveRequest.deleteMany({ employee_id: { $in: empIds } });
  await Attendance.deleteMany({ employee_id: { $in: empIds } });
  await Employee.deleteMany({ _id: { $in: empIds } });
  await User.deleteMany({ _id: { $in: [empUser._id, mgrUser._id, mgrUser2._id, adminUser._id] } });
  await Department.deleteMany({ _id: { $in: [dept1._id, dept2._id] } });
  console.log('   Done.');
}

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

async function runTests() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.\n');

  await seed();

  console.log('\n━━━ TEST 1: Submit leave request as employee ━━━');
  const t1 = await req('POST', '/api/leave', {
    leave_type: 'sick',
    start_date: '2026-09-15',
    end_date:   '2026-09-17',
    reason:     'Not feeling well',
  }, empHeaders());
  assert(t1.status === 201, 'Status 201 created');
  assert(t1.data && t1.data.status === 'pending', 'status is pending');
  assert(t1.data && t1.data.employee_id.toString() === empRecord._id.toString(), 'employee_id matches');
  const leaveId1 = t1.data ? t1.data._id : null;

  console.log('\n━━━ TEST 2: Overlap check (same dates) ━━━');
  const t2 = await req('POST', '/api/leave', {
    leave_type: 'casual',
    start_date: '2026-09-16',
    end_date:   '2026-09-18',
  }, empHeaders());
  assert(t2.status === 400, 'Status 400 for overlap');
  assert(t2.data && t2.data.error && t2.data.error.includes('overlap'), 'Error mentions overlap');

  console.log('\n━━━ TEST 3: GET as employee (own only) ━━━');
  const t3 = await req('GET', '/api/leave', null, empHeaders());
  assert(t3.status === 200, 'Status 200');
  assert(Array.isArray(t3.data), 'Response is array');
  assert(t3.data.length >= 1, 'At least 1 result');
  assert(t3.data.every(r => r.employee_id && r.employee_id._id === empRecord._id.toString()), 'All results belong to employee');

  console.log('\n━━━ TEST 4: GET as manager (same department) ━━━');
  const t4 = await req('GET', '/api/leave', null, mgrHeaders());
  assert(t4.status === 200, 'Status 200');
  assert(t4.data.length >= 1, 'At least 1 result (employee is in same dept)');

  console.log('\n━━━ TEST 5: GET as admin ━━━');
  const t5 = await req('GET', '/api/leave', null, adminHeaders());
  assert(t5.status === 200, 'Status 200');
  assert(t5.data.length >= 1, 'At least 1 result');

  console.log('\n━━━ TEST 6: Approve as WRONG-dept manager → 403 ━━━');
  const t6 = await req('PUT', '/api/leave/' + leaveId1 + '/approve', null, mgr2Headers());
  assert(t6.status === 403, 'Status 403 for wrong department');

  console.log('\n━━━ TEST 7: Approve as SAME-dept manager → 200 ━━━');
  const t7 = await req('PUT', '/api/leave/' + leaveId1 + '/approve', null, mgrHeaders());
  assert(t7.status === 200, 'Status 200 approved');
  assert(t7.data && t7.data.leaveRequest && t7.data.leaveRequest.status === 'approved', 'status is approved');
  assert(t7.data && t7.data.attendance_dates_written === 3, '3 attendance records written (Sep 15-17)');

  console.log('\n━━━ TEST 8: Verify Attendance has on-leave ━━━');
  const attendances = await Attendance.find({
    employee_id: empRecord._id,
    status: 'on-leave',
  }).lean();
  assert(attendances.length === 3, '3 Attendance records with on-leave status');

  console.log('\n━━━ TEST 9: Submit + Deny ━━━');
  const t9a = await req('POST', '/api/leave', {
    leave_type: 'earned',
    start_date: '2026-10-01',
    end_date:   '2026-10-03',
    reason:     'Vacation',
  }, empHeaders());
  assert(t9a.status === 201, 'Status 201 created');
  const leaveId2 = t9a.data ? t9a.data._id : null;

  const t9b = await req('PUT', '/api/leave/' + leaveId2 + '/deny', { reason: 'Short staffed' }, mgrHeaders());
  assert(t9b.status === 200, 'Status 200 denied');
  assert(t9b.data && t9b.data.leaveRequest && t9b.data.leaveRequest.status === 'denied', 'status is denied');
  assert(t9b.data && t9b.data.leaveRequest && t9b.data.leaveRequest.denial_reason === 'Short staffed', 'denial_reason saved');

  // Verify no Attendance written for denied request
  const noAttendance = await Attendance.find({
    employee_id: empRecord._id,
    date: { $gte: new Date('2026-10-01'), $lte: new Date('2026-10-03') },
  }).lean();
  assert(noAttendance.length === 0, 'No attendance records for denied leave');

  // ── Summary ─────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(50)}\n`);

  await cleanup();
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(async (err) => {
  console.error('Test error:', err);
  try { await cleanup(); } catch (_) {}
  await mongoose.disconnect();
  process.exit(1);
});
