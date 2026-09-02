/**
 * Sentinel Attendance — Comprehensive End-to-End Verification
 * Tests all modules: Auth, Employees, Attendance/QR, Leave, Dashboard, Reports
 */
const http = require('http');
const { authenticator } = require('otplib');

let passed = 0, failed = 0, skipped = 0;

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3000, path, method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ s: res.statusCode, b: JSON.parse(d) }); }
        catch { resolve({ s: res.statusCode, b: d }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function log(ok, label, detail) {
  if (ok === true) { passed++; console.log(`  ✅ ${label}${detail ? ' — ' + detail : ''}`); }
  else if (ok === false) { failed++; console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`); }
  else { skipped++; console.log(`  ⏭️  ${label}${detail ? ' — ' + detail : ''}`); }
}

async function run() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   Sentinel EAMS — Full Integration Verification     ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // ═══════════════════════════════════════════
  console.log('─── Module 0: Health ───');
  const h = await req('GET', '/api/health');
  log(h.s === 200 && h.b.status === 'ok', 'Health endpoint', `status=${h.b.status}`);

  // ═══════════════════════════════════════════
  console.log('\n─── Module 1: Authentication (Melbin) ───');

  // Admin login
  const login = await req('POST', '/api/auth/login', { email: 'admin@sentinel.com', password: 'Admin@123' });
  log(login.s === 200, 'Admin login', `status=${login.s}`);

  let adminToken = login.b.token || login.b.tempToken;

  // TOTP setup + verify
  if (login.b.requireTotpSetup) {
    const setup = await req('POST', '/api/auth/totp/setup', {}, adminToken);
    log(setup.s === 200 && setup.b.secret, 'TOTP setup', `secret=${!!setup.b.secret}, qrDataUrl=${!!setup.b.qrDataUrl}`);

    if (setup.b.secret) {
      const code = authenticator.generate(setup.b.secret);
      const verify = await req('POST', '/api/auth/totp/verify', { code }, adminToken);
      if (verify.s === 200 && verify.b.token) {
        adminToken = verify.b.token;
        log(true, 'TOTP verify', 'full auth token received');
      } else {
        log(false, 'TOTP verify', `status=${verify.s}, body=${JSON.stringify(verify.b).substring(0,150)}`);
      }
    }
  } else if (login.b.requireTotp) {
    // Already has TOTP enabled, need to verify
    const user = await req('GET', '/api/auth/me', null, adminToken);
    log(null, 'TOTP already enabled', 'need code from authenticator app');
  }

  // Bad password
  const badLogin = await req('POST', '/api/auth/login', { email: 'admin@sentinel.com', password: 'wrong' });
  log(badLogin.s === 401, 'Reject bad password', `status=${badLogin.s}`);

  // Employee login (seeded user Mary Lee)
  const empLogin = await req('POST', '/api/auth/login', { email: 'mary.lee@sentinel.com', password: 'Mary@123' });
  log(empLogin.s === 200, 'Employee login (Mary Lee)', `status=${empLogin.s}, hasToken=${!!empLogin.b.token}`);
  const empToken = empLogin.b.token;

  // ═══════════════════════════════════════════
  console.log('\n─── Module 1: Employee & Department Management (Melbin) ───');

  const depts = await req('GET', '/api/departments', null, adminToken);
  log(depts.s === 200 && Array.isArray(depts.b), 'List departments', `${Array.isArray(depts.b) ? depts.b.length : 0} found`);

  const emps = await req('GET', '/api/employees', null, adminToken);
  log(emps.s === 200 && Array.isArray(emps.b), 'List employees', `${Array.isArray(emps.b) ? emps.b.length : 0} found`);

  // Create employee (API assigns default password Welcome@123)
  const testEmail = `test.user.${Date.now()}@sentinel.com`;
  const newEmp = await req('POST', '/api/employees', {
    name: 'Test User',
    email: testEmail,
    department_id: depts.b && depts.b[0] ? depts.b[0].id : null,
    designation: 'QA Tester',
    phone: '+1-555-9999',
    join_date: '2026-01-15'
  }, adminToken);
  log(newEmp.s === 201, 'Create employee', `status=${newEmp.s}`);

  // Verify count increased
  const emps2 = await req('GET', '/api/employees', null, adminToken);
  log(emps2.s === 200 && emps2.b.length > emps.b.length, 'Employee count increased', `${emps.b.length} → ${emps2.b.length}`);

  // Unauthenticated access should fail
  const noAuth = await req('GET', '/api/employees');
  log(noAuth.s === 401 || noAuth.s === 403, 'Reject unauthenticated', `status=${noAuth.s}`);

  // ═══════════════════════════════════════════
  console.log('\n─── Module 2: QR & Attendance (Aivin) ───');

  const qr = await req('GET', '/api/qr/current', null, adminToken);
  log(qr.s === 200 && qr.b.code_value, 'QR current session', `session=${qr.b.qr_session_id || 'none'}`);

  // Login as the new test employee (default password Welcome@123)
  const testLogin = await req('POST', '/api/auth/login', { email: testEmail, password: 'Welcome@123' });
  log(testLogin.s === 200, 'Test employee login', `status=${testLogin.s}, hasToken=${!!testLogin.b.token}`);
  const testToken = testLogin.b.token;

  if (testToken && qr.b.code_value) {
    const checkin = await req('POST', '/api/attendance/checkin', {
      qr_session_id: qr.b.qr_session_id,
      code_value: qr.b.code_value,
      signature: qr.b.signature
    }, testToken);
    log(checkin.s === 201 || checkin.s === 200, 'Check-in via QR', `status=${checkin.s}, msg=${checkin.b.message || checkin.b.error || ''}`);

    // Wait for fresh QR, then check out
    await new Promise(r => setTimeout(r, 6000));
    const qr2 = await req('GET', '/api/qr/current', null, adminToken);
    if (qr2.b.code_value) {
      const checkout = await req('POST', '/api/attendance/checkout', {
        qr_session_id: qr2.b.qr_session_id,
        code_value: qr2.b.code_value,
        signature: qr2.b.signature
      }, testToken);
      log(checkout.s === 200, 'Check-out via QR', `status=${checkout.s}, msg=${checkout.b.message || checkout.b.error || ''}`);
    } else {
      log(null, 'Check-out via QR', 'skipped (no fresh QR)');
    }

    // Duplicate check-in should be rejected
    const qr3 = await req('GET', '/api/qr/current', null, adminToken);
    if (qr3.b.code_value) {
      const dup = await req('POST', '/api/attendance/checkin', {
        qr_session_id: qr3.b.qr_session_id,
        code_value: qr3.b.code_value,
        signature: qr3.b.signature
      }, testToken);
      log(dup.s === 400 || dup.s === 409, 'Duplicate check-in rejected', `status=${dup.s}, msg=${dup.b.error || ''}`);
    }

    // Verify attendance record exists
    const records = await req('GET', '/api/attendance', null, adminToken);
    log(records.s === 200 && Array.isArray(records.b) && records.b.length > 0, 'Attendance records exist', `${records.b.length} record(s)`);
  } else {
    log(false, 'Check-in/out tests', `testToken=${!!testToken}, qr=${!!qr.b.code_value}`);
  }

  // ═══════════════════════════════════════════
  console.log('\n─── Module 4: Leave Management (Nandana) ───');

  if (testToken) {
    const balance = await req('GET', '/api/leave/balance', null, testToken);
    log(balance.s === 200, 'Leave balance', `status=${balance.s}`);

    const submitLeave = await req('POST', '/api/leave', {
      leave_type: 'casual',
      start_date: '2026-09-10',
      end_date: '2026-09-11',
      reason: 'E2E test leave request'
    }, testToken);
    log(submitLeave.s === 201 || submitLeave.s === 200, 'Submit leave request', `status=${submitLeave.s}`);

    // Admin lists & approves
    const leaveList = await req('GET', '/api/leave', null, adminToken);
    log(leaveList.s === 200, 'List leave requests (admin)', `status=${leaveList.s}`);

    const leaves = Array.isArray(leaveList.b) ? leaveList.b : (leaveList.b.leaves || []);
    const pendingLeave = leaves.find(l => l.status === 'pending');
    if (pendingLeave) {
      const approve = await req('PUT', `/api/leave/${pendingLeave._id}/approve`, {}, adminToken);
      log(approve.s === 200, 'Approve leave (admin)', `status=${approve.s}, msg=${approve.b.message || approve.b.error || ''}`);
    } else {
      log(null, 'Approve leave', 'no pending leave found');
    }
  } else {
    log(false, 'Leave tests', 'no employee token');
  }

  // ═══════════════════════════════════════════
  console.log('\n─── Module 3: Admin Dashboard & Reports (Amina) ───');

  const summary = await req('GET', '/api/dashboard/summary', null, adminToken);
  log(summary.s === 200, 'Dashboard summary', `status=${summary.s}`);

  const trends = await req('GET', '/api/dashboard/attendance-trends?range=7d', null, adminToken);
  log(trends.s === 200, 'Attendance trends (7d)', `status=${trends.s}`);

  const deptComp = await req('GET', '/api/dashboard/department-comparison', null, adminToken);
  log(deptComp.s === 200, 'Department comparison', `status=${deptComp.s}`);

  const orgReport = await req('GET', '/api/reports/organisation', null, adminToken);
  log(orgReport.s === 200, 'Organisation report', `status=${orgReport.s}`);

  // Role-based access: non-admin denied
  if (empToken) {
    const denied = await req('GET', '/api/dashboard/summary', null, empToken);
    log(denied.s === 403, 'Dashboard denied for employee', `status=${denied.s}`);
  }

  // ═══════════════════════════════════════════
  console.log('\n─── Edge Cases ───');

  const notFound = await req('GET', '/api/nonexistent');
  log(notFound.s === 404, '404 for unknown API route', `status=${notFound.s}`);

  const noBody = await req('POST', '/api/auth/login', {});
  log(noBody.s === 400, 'Reject empty login body', `status=${noBody.s}`);

  // ═══════════════════════════════════════════
  const total = passed + failed + skipped;
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║  Results: ✅ ${String(passed).padStart(2)} passed │ ❌ ${String(failed).padStart(2)} failed │ ⏭️  ${String(skipped).padStart(2)} skipped   ║`);
  console.log(`║  Total:  ${total} tests                                 ║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);

  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('Test crashed:', err); process.exit(1); });
