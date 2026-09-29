/**
 * Sentinel Attendance — Comprehensive End-to-End Verification
 * Tests all modules: Auth, Employees, Attendance/QR, Leave, Dashboard, Reports
 */
const http = require('http');
const { authenticator } = require('otplib');
const { spawn } = require('child_process');
const path = require('path');

let passed = 0, failed = 0, skipped = 0;
let spawnedServer = null;

function req(method, path, body, token, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3000, path, method,
      headers: { 'Content-Type': 'application/json', ...customHeaders }
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

async function ensureServerRunning() {
  try {
    const h = await req('GET', '/api/health');
    if (h.s === 200) return;
  } catch (e) {
    // Server not running yet
  }

  console.log('[Test Suite] Launching Sentinel server for E2E tests...');
  spawnedServer = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    stdio: 'ignore',
    env: { ...process.env, PORT: '3000' }
  });

  const start = Date.now();
  while (Date.now() - start < 15000) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const h = await req('GET', '/api/health');
      if (h.s === 200) {
        console.log('[Test Suite] Sentinel server is healthy and ready.\n');
        return;
      }
    } catch (e) {}
  }
  throw new Error('Sentinel server failed to start within 15 seconds.');
}

function log(ok, label, detail) {
  if (ok === true) { passed++; console.log(`  ✅ ${label}${detail ? ' — ' + detail : ''}`); }
  else if (ok === false) { failed++; console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`); }
  else { skipped++; console.log(`  ⏭️  ${label}${detail ? ' — ' + detail : ''}`); }
}

async function run() {
  await ensureServerRunning();

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

  // QR now requires department_id
  const testDeptId = depts.b && depts.b[0] ? (depts.b[0]._id || depts.b[0].id) : null;
  const qr = testDeptId
    ? await req('GET', `/api/qr/current?department_id=${testDeptId}`, null, adminToken)
    : { s: 0, b: {} };
  log(qr.s === 200 && qr.b.code_value, 'QR current session (dept-scoped)', `session=${qr.b.qr_session_id || 'none'}, dept=${testDeptId}`);

  // QR without department_id should fail
  const qrNoDept = await req('GET', '/api/qr/current', null, adminToken);
  log(qrNoDept.s === 400, 'QR rejects missing department_id', `status=${qrNoDept.s}`);

  // Login as the new test employee (default password Welcome@123)
  const testLogin = await req('POST', '/api/auth/login', { email: testEmail, password: 'Welcome@123' });
  log(testLogin.s === 200, 'Test employee login', `status=${testLogin.s}, hasToken=${!!testLogin.b.token}`);
  const testToken = testLogin.b.token;

  if (testToken && qr.b.code_value) {
    const checkin = await req('POST', '/api/attendance/checkin', {
      qr_session_id: qr.b.qr_session_id,
      code_value: qr.b.code_value,
      signature: qr.b.signature,
      latitude: 10.0159,   // sample location
      longitude: 76.3419,
    }, testToken);
    log(checkin.s === 201 || checkin.s === 200, 'Check-in via QR', `status=${checkin.s}, msg=${checkin.b.message || checkin.b.error || ''}`);

    // Wait for fresh QR, then check out
    await new Promise(r => setTimeout(r, 6000));
    const qr2 = await req('GET', `/api/qr/current?department_id=${testDeptId}`, null, adminToken);
    if (qr2.b.code_value) {
      const checkout = await req('POST', '/api/attendance/checkout', {
        qr_session_id: qr2.b.qr_session_id,
        code_value: qr2.b.code_value,
        signature: qr2.b.signature,
        latitude: 10.0159,
        longitude: 76.3419,
      }, testToken);
      log(checkout.s === 200, 'Check-out via QR', `status=${checkout.s}, msg=${checkout.b.message || checkout.b.error || ''}`);
    } else {
      log(null, 'Check-out via QR', 'skipped (no fresh QR)');
    }

    // Duplicate check-in should be rejected
    const qr3 = await req('GET', `/api/qr/current?department_id=${testDeptId}`, null, adminToken);
    if (qr3.b.code_value) {
      const dup = await req('POST', '/api/attendance/checkin', {
        qr_session_id: qr3.b.qr_session_id,
        code_value: qr3.b.code_value,
        signature: qr3.b.signature
      }, testToken);
      log(dup.s === 400 || dup.s === 409, 'Duplicate check-in rejected', `status=${dup.s}, msg=${dup.b.error || ''}`);
    }

    // Cross-department QR scan should be rejected (if 2+ departments exist)
    if (depts.b && depts.b.length >= 2) {
      const otherDeptId = depts.b[1]._id || depts.b[1].id;
      const qrOther = await req('GET', `/api/qr/current?department_id=${otherDeptId}`, null, adminToken);
      if (qrOther.b.code_value) {
        const crossDept = await req('POST', '/api/attendance/checkin', {
          qr_session_id: qrOther.b.qr_session_id,
          code_value: qrOther.b.code_value,
          signature: qrOther.b.signature
        }, testToken);
        log(crossDept.s === 403, 'Cross-department QR rejected', `status=${crossDept.s}, msg=${crossDept.b.error || ''}`);
      } else {
        log(null, 'Cross-department QR test', 'skipped (no QR for other dept)');
      }
    } else {
      log(null, 'Cross-department QR test', 'skipped (need 2+ departments)');
    }

    // Verify attendance record exists
    const records = await req('GET', '/api/attendance', null, adminToken);
    log(records.s === 200 && Array.isArray(records.b) && records.b.length > 0, 'Attendance records exist', `${records.b.length} record(s)`);
  } else {
    log(false, 'Check-in/out tests', `testToken=${!!testToken}, qr=${!!qr.b.code_value}`);
  }

  // ═══════════════════════════════════════════
  console.log('\n─── Module 2b: Security Alerts (Aivin) ───');

  const alertStats = await req('GET', '/api/security/alerts/stats', null, adminToken);
  log(alertStats.s === 200 && alertStats.b.total_open != null, 'Alert stats', `total_open=${alertStats.b.total_open}`);

  const alertList = await req('GET', '/api/security/alerts', null, adminToken);
  log(alertList.s === 200 && Array.isArray(alertList.b), 'List security alerts', `${Array.isArray(alertList.b) ? alertList.b.length : 0} alert(s)`);

  // If any alerts exist, test acknowledge + resolve
  if (Array.isArray(alertList.b) && alertList.b.length > 0) {
    const firstAlert = alertList.b[0];
    const ack = await req('PUT', `/api/security/alerts/${firstAlert._id}/acknowledge`, {}, adminToken);
    log(ack.s === 200, 'Acknowledge alert', `status=${ack.s}`);

    const resolve = await req('PUT', `/api/security/alerts/${firstAlert._id}/resolve`, {}, adminToken);
    log(resolve.s === 200, 'Resolve alert', `status=${resolve.s}`);
  } else {
    log(null, 'Acknowledge/resolve alert', 'skipped (no alerts to test)');
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
  // We need to use empToken from Mary Lee's login up at the top
  if (empToken) {
    const denied = await req('GET', '/api/dashboard/summary', null, empToken);
    log(denied.s === 403, 'Dashboard denied for employee', `status=${denied.s}`);
  }

  // ═══════════════════════════════════════════
  console.log('\n─── Module 2c: Geofence Toggle & Accuracy Verification ───');

  // Verify dashboard summary exposes read-only geofence_mode
  const summaryMode = summary.b && summary.b.data && summary.b.data.geofence_mode;
  log(summaryMode === 'log', 'Dashboard summary exposes geofence_mode: log', `mode=${summaryMode}`);

  // Create dedicated employees for geofence mode testing
  const geoEmail = `geo.tester.${Date.now()}@sentinel.com`;
  const geoEmpRes = await req('POST', '/api/employees', {
    name: 'Geofence Enforce Tester',
    email: geoEmail,
    department_id: testDeptId,
    designation: 'Field QA',
    phone: '+1-555-4321',
    join_date: '2026-02-15'
  }, adminToken);
  const geoLogin = await req('POST', '/api/auth/login', { email: geoEmail, password: 'Welcome@123' });
  const geoToken = geoLogin.b.token;
  const geoEmpId = geoEmpRes.b && (geoEmpRes.b._id || geoEmpRes.b.id);

  const getFreshQr = async () => req('GET', `/api/qr/current?department_id=${testDeptId}`, null, adminToken);

  if (geoToken) {
    // 1. Enforce mode with a bad accuracy_m returns 422
    const qr1 = await getFreshQr();
    const badAccRes = await req('POST', '/api/attendance/checkin', {
      qr_session_id: qr1.b.qr_session_id,
      code_value: qr1.b.code_value,
      signature: qr1.b.signature,
      latitude: 10.0159,
      longitude: 76.3419,
      accuracy_m: 85, // greater than default max 50m
    }, geoToken, { 'x-geofence-mode': 'enforce' });
    log(badAccRes.s === 422, 'Enforce mode with a bad accuracy_m returns 422', `status=${badAccRes.s}`);

    // 2. Enforce mode with is_mock_location: true returns 403 MOCK_LOCATION
    const qr2 = await getFreshQr();
    const mockRes = await req('POST', '/api/attendance/checkin', {
      qr_session_id: qr2.b.qr_session_id,
      code_value: qr2.b.code_value,
      signature: qr2.b.signature,
      latitude: 10.0159,
      longitude: 76.3419,
      accuracy_m: 10,
      is_mock_location: true,
    }, geoToken, { 'x-geofence-mode': 'enforce' });
    log(mockRes.s === 403 && mockRes.b.error === 'MOCK_LOCATION', 'Enforce mode with is_mock_location: true returns 403 MOCK_LOCATION', `status=${mockRes.s}, error=${mockRes.b.error}`);

    // 3. Enforce mode: outside-radius check-in returns 403 OUTSIDE_GEOFENCE, no Attendance record is written, SecurityAlert is still created
    const qr3 = await getFreshQr();
    const outsideEnforce = await req('POST', '/api/attendance/checkin', {
      qr_session_id: qr3.b.qr_session_id,
      code_value: qr3.b.code_value,
      signature: qr3.b.signature,
      latitude: 10.0500, // ~3792m away from center (10.0159, 76.3419), well outside 200m limit
      longitude: 76.3419,
      accuracy_m: 15,
      is_mock_location: false,
    }, geoToken, { 'x-geofence-mode': 'enforce' });

    const isEnforceBlocked = outsideEnforce.s === 403 &&
      outsideEnforce.b.error === 'OUTSIDE_GEOFENCE' &&
      typeof outsideEnforce.b.distance_m === 'number' &&
      outsideEnforce.b.allowed_radius_m === 200;

    const attList = await req('GET', `/api/attendance?employee_id=${geoEmpId}`, null, adminToken);
    const noAttWritten = attList.s === 200 && Array.isArray(attList.b) && attList.b.length === 0;

    const alertsEnforce = await req('GET', '/api/security/alerts', null, adminToken);
    const hasEnforceAlert = Array.isArray(alertsEnforce.b) && alertsEnforce.b.some(a =>
      (a.employee_email === geoEmail || a.employee_name === 'Geofence Enforce Tester') &&
      a.alert_type === 'geofence_violation'
    );

    log(isEnforceBlocked && noAttWritten && hasEnforceAlert, 'Enforce mode: outside-radius returns 403 OUTSIDE_GEOFENCE, no Attendance written, SecurityAlert created',
      `status=${outsideEnforce.s}, dist=${outsideEnforce.b.distance_m}m, noAtt=${noAttWritten}, alertCreated=${hasEnforceAlert}`);

    // 4. Log mode: outside-radius check-in succeeds, SecurityAlert created with the correct distance_m
    const qr4 = await getFreshQr();
    const outsideLog = await req('POST', '/api/attendance/checkin', {
      qr_session_id: qr4.b.qr_session_id,
      code_value: qr4.b.code_value,
      signature: qr4.b.signature,
      latitude: 10.0500, // outside radius
      longitude: 76.3419,
      accuracy_m: 22,
      is_mock_location: false,
    }, geoToken, { 'x-geofence-mode': 'log' });

    const logSucceeded = (outsideLog.s === 201 || outsideLog.s === 200);
    const alertsLog = await req('GET', '/api/security/alerts', null, adminToken);
    const logAlert = Array.isArray(alertsLog.b) && alertsLog.b.find(a =>
      (a.employee_email === geoEmail || a.employee_name === 'Geofence Enforce Tester') &&
      a.alert_type === 'geofence_violation' &&
      a.metadata && a.metadata.accuracy_m === 22
    );

    const hasCorrectDist = !!logAlert && typeof logAlert.metadata.distance_m === 'number' && logAlert.metadata.distance_m > 3000;
    log(logSucceeded && hasCorrectDist, 'Log mode: outside-radius check-in succeeds, SecurityAlert created with correct distance_m',
      `status=${outsideLog.s}, dist=${logAlert ? logAlert.metadata.distance_m : 'none'}m`);

    // 5. Off mode: outside-radius check-in succeeds, no SecurityAlert created
    const offEmail = `off.tester.${Date.now()}@sentinel.com`;
    const offEmpRes = await req('POST', '/api/employees', {
      name: 'Geofence Off Tester',
      email: offEmail,
      department_id: testDeptId,
      designation: 'Off QA',
      phone: '+1-555-1111',
      join_date: '2026-02-15'
    }, adminToken);
    const offLogin = await req('POST', '/api/auth/login', { email: offEmail, password: 'Welcome@123' });
    const offToken = offLogin.b.token;
    const offEmpId = offEmpRes.b && (offEmpRes.b._id || offEmpRes.b.id);

    const qr5 = await getFreshQr();
    const offCheckin = await req('POST', '/api/attendance/checkin', {
      qr_session_id: qr5.b.qr_session_id,
      code_value: qr5.b.code_value,
      signature: qr5.b.signature,
      latitude: 10.0500,
      longitude: 76.3419,
      accuracy_m: 99,
      is_mock_location: true,
    }, offToken, { 'x-geofence-mode': 'off' });

    const offSucceeded = (offCheckin.s === 201 || offCheckin.s === 200);
    const alertsOff = await req('GET', '/api/security/alerts', null, adminToken);
    const hasOffAlert = Array.isArray(alertsOff.b) && alertsOff.b.some(a =>
      (a.employee_email === offEmail || a.employee_name === 'Geofence Off Tester') &&
      a.alert_type === 'geofence_violation'
    );
    log(offSucceeded && !hasOffAlert, 'Off mode: outside-radius check-in succeeds, no SecurityAlert created',
      `status=${offCheckin.s}, alertCreated=${hasOffAlert}`);

    // 6. A geofence_violation alert shows up in the reports endpoint output
    const orgReportAfter = await req('GET', '/api/reports/organisation', null, adminToken);
    const inReportData = orgReportAfter.b && Array.isArray(orgReportAfter.b.data) &&
      orgReportAfter.b.data.some(r => r.type === 'geofence_violation' || r.status === 'geofence-violation');
    const inReportSummary = orgReportAfter.b && orgReportAfter.b.summary &&
      typeof orgReportAfter.b.summary.total_geofence_violations === 'number' &&
      orgReportAfter.b.summary.total_geofence_violations > 0;
    log(inReportData && inReportSummary, 'A geofence_violation alert shows up in the reports endpoint output',
      `inData=${inReportData}, totalViolations=${orgReportAfter.b.summary?.total_geofence_violations}`);
  } else {
    log(false, 'Geofence toggle tests', 'missing geoToken or QR session');
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

  if (spawnedServer) {
    spawnedServer.kill();
  }

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  if (spawnedServer) spawnedServer.kill();
  console.error('Test crashed:', err);
  process.exit(1);
});
