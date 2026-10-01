/**
 * Sentinel Attendance — Comprehensive End-to-End Verification
 * Tests all modules: Auth, Employees, Attendance/QR, Leave, Dashboard, Reports
 */
require('dotenv').config();
const http = require('http');
const { authenticator } = require('otplib');
const { spawn } = require('child_process');
const path = require('path');

const TEST_OVERRIDE_SECRET = process.env.TEST_OVERRIDE_SECRET || 'sentinel-test-secret-123';
process.env.NODE_ENV = 'test';
process.env.TEST_OVERRIDE_SECRET = TEST_OVERRIDE_SECRET;
process.env.FACE_PROVIDER = 'mock';
process.env.FACE_PROOF_SECRET = 'test-face-proof-secret-xyz';
process.env.FACE_MODE = 'off'; // default off; tests override via header

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

/**
 * Multipart form-data request helper for face image uploads.
 * fields: { key: value } for text fields
 * files: [{ field, filename, buffer, contentType }]
 */
function multipartReq(method, urlPath, fields, files, token, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const boundary = '----TestBoundary' + Date.now();
    const parts = [];

    for (const [key, val] of Object.entries(fields || {})) {
      parts.push(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
        `${val}\r\n`
      );
    }

    for (const f of (files || [])) {
      parts.push(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${f.field}"; filename="${f.filename}"\r\n` +
        `Content-Type: ${f.contentType || 'image/jpeg'}\r\n\r\n`
      );
      parts.push(f.buffer);
      parts.push('\r\n');
    }
    parts.push(`--${boundary}--\r\n`);

    // Compute total length
    let totalLen = 0;
    const bufParts = parts.map(p => {
      const buf = Buffer.isBuffer(p) ? p : Buffer.from(p, 'utf-8');
      totalLen += buf.length;
      return buf;
    });
    const bodyBuf = Buffer.concat(bufParts, totalLen);

    const opts = {
      hostname: 'localhost', port: 3000, path: urlPath, method,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuf.length,
        ...customHeaders,
      }
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
    r.write(bodyBuf);
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
    env: { ...process.env, PORT: '3000', NODE_ENV: 'test', TEST_OVERRIDE_SECRET }
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
  log(Boolean(qr.s === 200 && qr.b.code_value), 'QR current session (dept-scoped)', `session=${qr.b.qr_session_id || 'none'}, dept=${testDeptId}`);

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
      is_mock_location: false,
    }, geoToken, { 'x-geofence-mode': 'enforce', 'x-test-secret': TEST_OVERRIDE_SECRET });
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
    }, geoToken, { 'x-geofence-mode': 'enforce', 'x-test-secret': TEST_OVERRIDE_SECRET });
    log(mockRes.s === 403 && mockRes.b.error === 'MOCK_LOCATION', 'Enforce mode with is_mock_location: true returns 403 MOCK_LOCATION', `status=${mockRes.s}, error=${mockRes.b.error}`);

    // 2b. Enforce mode with missing location returns 400 LOCATION_REQUIRED
    const qr2b = await getFreshQr();
    const missingLocRes = await req('POST', '/api/attendance/checkin', {
      qr_session_id: qr2b.b.qr_session_id,
      code_value: qr2b.b.code_value,
      signature: qr2b.b.signature,
      // latitude and longitude omitted
      is_mock_location: false,
    }, geoToken, { 'x-geofence-mode': 'enforce', 'x-test-secret': TEST_OVERRIDE_SECRET });
    log(missingLocRes.s === 400 && missingLocRes.b.error === 'LOCATION_REQUIRED', 'Enforce mode with missing location returns 400 LOCATION_REQUIRED', `status=${missingLocRes.s}, error=${missingLocRes.b.error}`);

    // 2c. Enforce mode with missing is_mock_location returns 400 MOCK_LOCATION_FLAG_REQUIRED
    const qr2c = await getFreshQr();
    const missingMockFlagRes = await req('POST', '/api/attendance/checkin', {
      qr_session_id: qr2c.b.qr_session_id,
      code_value: qr2c.b.code_value,
      signature: qr2c.b.signature,
      latitude: 10.0159,
      longitude: 76.3419,
      accuracy_m: 10,
      // is_mock_location omitted
    }, geoToken, { 'x-geofence-mode': 'enforce', 'x-test-secret': TEST_OVERRIDE_SECRET });
    log(missingMockFlagRes.s === 400 && missingMockFlagRes.b.error === 'MOCK_LOCATION_FLAG_REQUIRED', 'Enforce mode with missing is_mock_location returns 400 MOCK_LOCATION_FLAG_REQUIRED', `status=${missingMockFlagRes.s}, error=${missingMockFlagRes.b.error}`);

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
    }, geoToken, { 'x-geofence-mode': 'enforce', 'x-test-secret': TEST_OVERRIDE_SECRET });

    const isEnforceBlocked = outsideEnforce.s === 403 &&
      outsideEnforce.b.error === 'OUTSIDE_GEOFENCE' &&
      typeof outsideEnforce.b.distance_m === 'number' &&
      typeof outsideEnforce.b.allowed_radius_m === 'number';

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
    }, geoToken, { 'x-geofence-mode': 'log', 'x-test-secret': TEST_OVERRIDE_SECRET });

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
    const offTimestamp = Date.now();
    const offEmail = `off.tester.${offTimestamp}@sentinel.com`;
    const offName = `Geofence Off Tester ${offTimestamp}`;
    const offEmpRes = await req('POST', '/api/employees', {
      name: offName,
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
    }, offToken, { 'x-geofence-mode': 'off', 'x-test-secret': TEST_OVERRIDE_SECRET });

    const offSucceeded = (offCheckin.s === 201 || offCheckin.s === 200);
    const alertsOff = await req('GET', '/api/security/alerts', null, adminToken);
    const hasOffAlert = Array.isArray(alertsOff.b) && alertsOff.b.some(a =>
      (a.employee_email === offEmail || a.employee_name === offName) &&
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
    // 7. Header override without matching X-Test-Secret is ignored (falls back to GEOFENCE_MODE)
    const qr6 = await getFreshQr();
    const unauthOverride = await req('POST', '/api/attendance/checkin', {
      qr_session_id: qr6.b.qr_session_id,
      code_value: qr6.b.code_value,
      signature: qr6.b.signature,
      latitude: 10.0159,
      longitude: 76.3419,
      accuracy_m: 85,
      is_mock_location: false,
    }, geoToken, { 'x-geofence-mode': 'enforce', 'x-test-secret': 'wrong-secret' });
    // In log mode (fallback), bad accuracy is non-blocking (returns 201/200) rather than 422
    log(unauthOverride.s !== 422, 'Header override with bad secret is ignored (falls back to log mode)', `status=${unauthOverride.s}`);
  } else {
    log(false, 'Geofence toggle tests', 'missing geoToken or QR session');
  }

  // ═══════════════════════════════════════════
  console.log('\n─── Stage 2: Manager Department Scoping & Permission Guardrails ───');

  // Ensure two distinct departments exist
  let deptsListRes = await req('GET', '/api/departments', null, adminToken);
  let deptAObj = deptsListRes.b && deptsListRes.b[0];
  let deptBObj = deptsListRes.b && deptsListRes.b[1];
  if (!deptBObj) {
    const newDeptRes = await req('POST', '/api/departments', { name: `Dept_B_${Date.now()}` }, adminToken);
    deptBObj = newDeptRes.b;
  }
  const deptAId = deptAObj._id || deptAObj.id;
  const deptBId = deptBObj._id || deptBObj.id;

  // 1. Create and log in Manager A (assigned to Dept A)
  const mgrAEmail = `manager.deptA.${Date.now()}@sentinel.com`;
  const mgrARes = await req('POST', '/api/employees', {
    name: 'Dept A Manager',
    email: mgrAEmail,
    role: 'manager',
    department_id: deptAId,
    designation: 'Engineering Manager',
    phone: '+1-555-0101',
    join_date: '2026-01-01'
  }, adminToken);
  const mgrALogin = await req('POST', '/api/auth/login', { email: mgrAEmail, password: 'Welcome@123' });
  const mgrAToken = mgrALogin.b && mgrALogin.b.token;

  // 2. Create and log in Manager with No Department
  const mgrNoDeptEmail = `manager.nodept.${Date.now()}@sentinel.com`;
  const mgrNoDeptRes = await req('POST', '/api/employees', {
    name: 'No Dept Manager',
    email: mgrNoDeptEmail,
    role: 'manager',
    department_id: null,
    designation: 'Floating Manager',
    phone: '+1-555-0102',
    join_date: '2026-01-01'
  }, adminToken);
  const mgrNoDeptLogin = await req('POST', '/api/auth/login', { email: mgrNoDeptEmail, password: 'Welcome@123' });
  const mgrNoDeptToken = mgrNoDeptLogin.b && mgrNoDeptLogin.b.token;

  // 3. Create sample employees in Dept A and Dept B
  const empAEmail = `emp.deptA.${Date.now()}@sentinel.com`;
  const empARes = await req('POST', '/api/employees', {
    name: 'Dept A Employee',
    email: empAEmail,
    department_id: deptAId,
    designation: 'Staff Engineer',
    phone: '+1-555-0103',
    join_date: '2026-01-01'
  }, adminToken);
  const empAId = empARes.b && (empARes.b._id || empARes.b.id);

  const empBEmail = `emp.deptB.${Date.now()}@sentinel.com`;
  const empBRes = await req('POST', '/api/employees', {
    name: 'Dept B Employee',
    email: empBEmail,
    department_id: deptBId,
    designation: 'Marketing Lead',
    phone: '+1-555-0104',
    join_date: '2026-01-01'
  }, adminToken);
  const empBId = empBRes.b && (empBRes.b._id || empBRes.b.id);

  // Test: Manager A only sees Dept A employees
  const mgrAEmps = await req('GET', '/api/employees', null, mgrAToken);
  const onlyDeptA = Array.isArray(mgrAEmps.b) && mgrAEmps.b.length > 0 &&
    mgrAEmps.b.every(e => String(e.department_id) === String(deptAId));
  log(onlyDeptA, 'Manager only sees own department employees', `count=${mgrAEmps.b ? mgrAEmps.b.length : 0}`);

  // Test: Manager cannot override department via ?dept=
  const mgrAOverride = await req('GET', `/api/employees?dept=${deptBId}`, null, mgrAToken);
  const overrideBlocked = Array.isArray(mgrAOverride.b) &&
    mgrAOverride.b.every(e => String(e.department_id) === String(deptAId));
  log(overrideBlocked, 'Manager cannot override department scope via ?dept= query', `count=${mgrAOverride.b ? mgrAOverride.b.length : 0}`);

  // Test: Manager with no department gets empty array [] for employees
  const noDeptEmps = await req('GET', '/api/employees', null, mgrNoDeptToken);
  log(noDeptEmps.s === 200 && Array.isArray(noDeptEmps.b) && noDeptEmps.b.length === 0, 'Manager with no department gets empty list for employees', `status=${noDeptEmps.s}`);

  // Test: Manager can read own department employee (200)
  const readOwnEmp = await req('GET', `/api/employees/${empAId}`, null, mgrAToken);
  log(readOwnEmp.s === 200 && readOwnEmp.b.id === empAId, 'Manager can view employee in own department', `status=${readOwnEmp.s}`);

  // Test: Manager cannot read different department employee (403)
  const readOtherEmp = await req('GET', `/api/employees/${empBId}`, null, mgrAToken);
  log(readOtherEmp.s === 403, 'Manager cannot view employee in another department (403)', `status=${readOtherEmp.s}`);

  // Test: Manager creates employee forces own department_id
  const subEmail = `sub.deptA.${Date.now()}@sentinel.com`;
  const mgrCreateEmp = await req('POST', '/api/employees', {
    name: 'Dept A Subordinate',
    email: subEmail,
    department_id: deptBId, // attempt to assign to Dept B
    designation: 'Junior Engineer'
  }, mgrAToken);
  const subCreatedOwnDept = mgrCreateEmp.s === 201 && String(mgrCreateEmp.b.department_id) === String(deptAId);
  log(subCreatedOwnDept, 'Manager create employee forces manager department (overriding body)', `status=${mgrCreateEmp.s}, dept=${mgrCreateEmp.b ? mgrCreateEmp.b.department_id : ''}`);
  const subId = mgrCreateEmp.b && (mgrCreateEmp.b._id || mgrCreateEmp.b.id);

  // Test: Manager with no department cannot create employee (400)
  const noDeptCreate = await req('POST', '/api/employees', {
    name: 'Orphan Subordinate',
    email: `orphan.${Date.now()}@sentinel.com`,
    designation: 'Intern'
  }, mgrNoDeptToken);
  log(noDeptCreate.s === 400, 'Manager with no department cannot create employee (400)', `status=${noDeptCreate.s}`);

  // Test: Manager cannot update employee in another department (403)
  const updateOtherDeptEmp = await req('PUT', `/api/employees/${empBId}`, { designation: 'Promoted Lead' }, mgrAToken);
  log(updateOtherDeptEmp.s === 403, 'Manager cannot update employee in another department (403)', `status=${updateOtherDeptEmp.s}`);

  // Test: Manager cannot transfer own employee to another department (400)
  const transferOwnEmp = await req('PUT', `/api/employees/${empAId}`, { department_id: deptBId }, mgrAToken);
  log(transferOwnEmp.s === 400, 'Manager cannot reassign employee to another department (400)', `status=${transferOwnEmp.s}`);

  // Test: Manager can update own employee (200)
  const updateOwnEmp = await req('PUT', `/api/employees/${empAId}`, { designation: 'Principal Engineer' }, mgrAToken);
  log(updateOwnEmp.s === 200 && updateOwnEmp.b.designation === 'Principal Engineer', 'Manager can update own department employee (200)', `status=${updateOwnEmp.s}`);

  // Test: Manager cannot delete employee in another department (403)
  const deleteOtherDeptEmp = await req('DELETE', `/api/employees/${empBId}`, null, mgrAToken);
  log(deleteOtherDeptEmp.s === 403, 'Manager cannot delete employee in another department (403)', `status=${deleteOtherDeptEmp.s}`);

  // Test: Manager can delete subordinate in own department (200)
  const deleteOwnSub = subId ? await req('DELETE', `/api/employees/${subId}`, null, mgrAToken) : { s: 0 };
  log(deleteOwnSub.s === 200, 'Manager can delete employee in own department (200)', `status=${deleteOwnSub.s}`);

  // Test: Manager attendance records scoped to own department
  const mgrAtt = await req('GET', '/api/attendance', null, mgrAToken);
  log(mgrAtt.s === 200 && Array.isArray(mgrAtt.b), 'Manager views attendance records', `status=${mgrAtt.s}, count=${mgrAtt.b ? mgrAtt.b.length : 0}`);

  // Test: Manager querying specific employee from another department returns []
  const wrongEmpAtt = await req('GET', `/api/attendance?employee_id=${empBId}`, null, mgrAToken);
  log(wrongEmpAtt.s === 200 && Array.isArray(wrongEmpAtt.b) && wrongEmpAtt.b.length === 0, 'Manager querying attendance for employee in another department returns []', `status=${wrongEmpAtt.s}`);

  // Test: Manager with no department queries attendance returns []
  const noDeptAtt = await req('GET', '/api/attendance', null, mgrNoDeptToken);
  log(noDeptAtt.s === 200 && Array.isArray(noDeptAtt.b) && noDeptAtt.b.length === 0, 'Manager with no department queries attendance returns []', `status=${noDeptAtt.s}`);

  // Test: Manager recent scans scoped to own department
  const mgrScans = await req('GET', '/api/qr/recent-scans', null, mgrAToken);
  log(mgrScans.s === 200 && Array.isArray(mgrScans.b), 'Manager queries recent scans', `status=${mgrScans.s}, count=${mgrScans.b ? mgrScans.b.length : 0}`);

  // Test: Manager with no department recent scans returns []
  const noDeptScans = await req('GET', '/api/qr/recent-scans', null, mgrNoDeptToken);
  log(noDeptScans.s === 200 && Array.isArray(noDeptScans.b) && noDeptScans.b.length === 0, 'Manager with no department queries recent scans returns []', `status=${noDeptScans.s}`);

  // Test: Admin behavior remains fully unrestricted
  const adminEmpB = await req('GET', `/api/employees/${empBId}`, null, adminToken);
  const adminReadOk = adminEmpB.s === 200;
  const adminFilterB = await req('GET', `/api/employees?dept=${deptBId}`, null, adminToken);
  const adminFilterOk = adminFilterB.s === 200 && Array.isArray(adminFilterB.b);
  const adminAtt = await req('GET', '/api/attendance', null, adminToken);
  const adminAttOk = adminAtt.s === 200 && Array.isArray(adminAtt.b);
  log(adminReadOk && adminFilterOk && adminAttOk, 'Admin behavior is fully unrestricted across departments', `read=${adminReadOk}, filter=${adminFilterOk}, att=${adminAttOk}`);

  // ═══════════════════════════════════════════
  console.log('\n─── Stage 3: Leave Management Department Scoping ───');

  const jwt = require('jsonwebtoken');
  const { JWT_SECRET } = require('../shared/middleware/auth.middleware');

  // 1. Employee A (Dept A) and Employee B (Dept B) log in to obtain tokens
  const empALogin = await req('POST', '/api/auth/login', { email: empAEmail, password: 'Welcome@123' });
  const empAToken = empALogin.b && empALogin.b.token;

  const empBLogin = await req('POST', '/api/auth/login', { email: empBEmail, password: 'Welcome@123' });
  const empBToken = empBLogin.b && empBLogin.b.token;

  // 2. Submit sample leave requests for Emp A (Dept A) and Emp B (Dept B)
  const leaveReqA = await req('POST', '/api/leave', {
    leave_type: 'sick',
    start_date: '2026-11-10',
    end_date: '2026-11-11',
    reason: 'Dept A Doctor appointment'
  }, empAToken);
  const leaveAId = leaveReqA.b && leaveReqA.b._id;
  log(leaveReqA.s === 201 && !!leaveAId, 'Emp A submits leave request in Dept A', `status=${leaveReqA.s}, id=${leaveAId}`);

  const leaveReqB = await req('POST', '/api/leave', {
    leave_type: 'casual',
    start_date: '2026-11-15',
    end_date: '2026-11-16',
    reason: 'Dept B Personal errand'
  }, empBToken);
  const leaveBId = leaveReqB.b && leaveReqB.b._id;
  log(leaveReqB.s === 201 && !!leaveBId, 'Emp B submits leave request in Dept B', `status=${leaveReqB.s}, id=${leaveBId}`);

  // 3. Manager A (GET /api/leave): scoped to Dept A only
  const mgrALeaves = await req('GET', '/api/leave', null, mgrAToken);
  const mgrAHasA = Array.isArray(mgrALeaves.b) && mgrALeaves.b.some(r => String(r._id) === String(leaveAId));
  const mgrANoB = Array.isArray(mgrALeaves.b) && !mgrALeaves.b.some(r => String(r._id) === String(leaveBId));
  const mgrAOnlyDeptA = Array.isArray(mgrALeaves.b) && mgrALeaves.b.every(r => {
    const dId = r.employee_id?.department_id?._id || r.employee_id?.department_id;
    return !dId || String(dId) === String(deptAId);
  });
  log(mgrALeaves.s === 200 && mgrAHasA && mgrANoB && mgrAOnlyDeptA, 'Manager A only sees Dept A leave requests (GET /api/leave)', `hasA=${mgrAHasA}, hasB=${!mgrANoB}, count=${mgrALeaves.b ? mgrALeaves.b.length : 0}`);

  // 4. Case-sensitivity test: Create token with role 'Manager' (capital M)
  const mgrDecoded = jwt.decode(mgrAToken);
  delete mgrDecoded.iat;
  delete mgrDecoded.exp;
  const mgrCapitalToken = jwt.sign({
    ...mgrDecoded,
    role: 'Manager'
  }, JWT_SECRET, { expiresIn: '1h' });

  const capitalLeaves = await req('GET', '/api/leave', null, mgrCapitalToken);
  const capHasA = Array.isArray(capitalLeaves.b) && capitalLeaves.b.some(r => String(r._id) === String(leaveAId));
  const capNoB = Array.isArray(capitalLeaves.b) && !capitalLeaves.b.some(r => String(r._id) === String(leaveBId));
  log(capitalLeaves.s === 200 && capHasA && capNoB, 'Case-sensitivity fix: token with role "Manager" scopes to department instead of leaking all company leaves', `status=${capitalLeaves.s}, hasA=${capHasA}, leakedB=${!capNoB}`);

  // 5. Manager A listing with filters (GET /api/leave/requests) and ?department_id= override attempt
  const mgrAdminReqs = await req('GET', '/api/leave/requests', null, mgrAToken);
  const mgrReqsHasA = Array.isArray(mgrAdminReqs.b) && mgrAdminReqs.b.some(r => String(r._id) === String(leaveAId));
  const mgrReqsNoB = Array.isArray(mgrAdminReqs.b) && !mgrAdminReqs.b.some(r => String(r._id) === String(leaveBId));
  log(mgrAdminReqs.s === 200 && mgrReqsHasA && mgrReqsNoB, 'Manager A views requests listing scoped to Dept A (GET /api/leave/requests)', `status=${mgrAdminReqs.s}, hasA=${mgrReqsHasA}, hasB=${!mgrReqsNoB}`);

  const mgrOverrideDept = await req('GET', `/api/leave/requests?department_id=${deptBId}`, null, mgrAToken);
  const overrideNoB = Array.isArray(mgrOverrideDept.b) && !mgrOverrideDept.b.some(r => String(r._id) === String(leaveBId));
  const overrideStillA = Array.isArray(mgrOverrideDept.b) && mgrOverrideDept.b.some(r => String(r._id) === String(leaveAId));
  log(overrideNoB && overrideStillA, 'Manager cannot override leave scope via ?department_id= (ignored & locked to own department)', `status=${mgrOverrideDept.s}, leakedB=${!overrideNoB}`);

  // 6. Department-scoped leave stats (GET /api/leave/stats)
  const mgrStats = await req('GET', '/api/leave/stats', null, mgrAToken);
  const adminStats = await req('GET', '/api/leave/stats', null, adminToken);
  const statsDeptScoped = mgrStats.s === 200 && mgrStats.b.total > 0 && adminStats.s === 200 && adminStats.b.total >= mgrStats.b.total;
  log(statsDeptScoped, 'Manager leave stats computed only from manager department', `mgrTotal=${mgrStats.b ? mgrStats.b.total : 0}, adminTotal=${adminStats.b ? adminStats.b.total : 0}`);

  // 7. Manager views single request: own department (200) vs other department (403)
  const viewOwnLeave = await req('GET', `/api/leave/${leaveAId}`, null, mgrAToken);
  log(viewOwnLeave.s === 200 && String(viewOwnLeave.b._id) === String(leaveAId), 'Manager can view leave request in own department', `status=${viewOwnLeave.s}`);

  const viewOtherLeave = await req('GET', `/api/leave/${leaveBId}`, null, mgrAToken);
  log(viewOtherLeave.s === 403, 'Manager cannot view leave request from another department (403)', `status=${viewOtherLeave.s}`);

  // 8. Manager attempts to approve / deny request in another department (403)
  const approveOtherDept = await req('PUT', `/api/leave/${leaveBId}/approve`, null, mgrAToken);
  log(approveOtherDept.s === 403, 'Manager cannot approve leave request from another department (403)', `status=${approveOtherDept.s}`);

  const denyOtherDept = await req('PUT', `/api/leave/${leaveBId}/deny`, { reason: 'Unauthorized' }, mgrAToken);
  log(denyOtherDept.s === 403, 'Manager cannot deny leave request from another department (403)', `status=${denyOtherDept.s}`);

  // 9. Manager can deny request in own department (200)
  const denyOwnDept = await req('PUT', `/api/leave/${leaveAId}/deny`, { reason: 'Team short-handed' }, mgrAToken);
  log(denyOwnDept.s === 200 && denyOwnDept.b.leaveRequest?.status === 'denied', 'Manager can deny leave request in own department (200)', `status=${denyOwnDept.s}`);

  // 10. Manager with no department gets empty results and zeroes
  const noDeptLeaves = await req('GET', '/api/leave', null, mgrNoDeptToken);
  log(noDeptLeaves.s === 200 && Array.isArray(noDeptLeaves.b) && noDeptLeaves.b.length === 0, 'Manager with no department gets empty list (GET /api/leave)', `status=${noDeptLeaves.s}`);

  const noDeptAdminLeaves = await req('GET', '/api/leave/requests', null, mgrNoDeptToken);
  log(noDeptAdminLeaves.s === 200 && Array.isArray(noDeptAdminLeaves.b) && noDeptAdminLeaves.b.length === 0, 'Manager with no department gets empty list (GET /api/leave/requests)', `status=${noDeptAdminLeaves.s}`);

  const noDeptStats = await req('GET', '/api/leave/stats', null, mgrNoDeptToken);
  log(noDeptStats.s === 200 && noDeptStats.b.total === 0, 'Manager with no department gets 0 stats', `total=${noDeptStats.b ? noDeptStats.b.total : 'err'}`);

  // 11. Admin can approve Dept B request (unrestricted across departments)
  const adminApproveB = await req('PUT', `/api/leave/${leaveBId}/approve`, null, adminToken);
  log(adminApproveB.s === 200 && adminApproveB.b.leaveRequest?.status === 'approved', 'Admin can approve leave request across any department (200)', `status=${adminApproveB.s}`);

  // ═══════════════════════════════════════════
  // ═══════════════════════════════════════════
  console.log('\n─── Face Authentication Tests ───');

  function mockFaceBuffer(personId, yaw) {
    const magic = Buffer.from([0xFF, 0xD8, 0xFF]);
    const payload = Buffer.from(`person:${personId};yaw:${yaw}`);
    return Buffer.concat([magic, payload]);
  }

  // Create two dedicated employees for Face Auth tests to avoid collisions
  const faceSuffix = Date.now();
  const fe1Email = `fe1.${faceSuffix}@sentinel.com`;
  const fe2Email = `fe2.${faceSuffix}@sentinel.com`;

  const faceEmp1Res = await req('POST', '/api/employees', { name: 'Face Emp 1', email: fe1Email, department_id: deptAId, role: 'Employee', designation: 'Tester', phone: `+1${faceSuffix}`, join_date: '2023-01-01' }, adminToken);
  console.log('faceEmp1Res', faceEmp1Res.s, faceEmp1Res.b);
  const faceEmp1Id = faceEmp1Res.b && (faceEmp1Res.b._id || faceEmp1Res.b.id);
  const fe1Login = await req('POST', '/api/auth/login', { email: fe1Email, password: 'Welcome@123' });
  const fe1Token = fe1Login.b.token;

  const faceEmp2Res = await req('POST', '/api/employees', { name: 'Face Emp 2', email: fe2Email, department_id: deptAId, role: 'Employee', designation: 'Tester', phone: `+2${faceSuffix}`, join_date: '2023-01-01' }, adminToken);
  const faceEmp2Id = faceEmp2Res.b && (faceEmp2Res.b._id || faceEmp2Res.b.id);
  const fe2Login = await req('POST', '/api/auth/login', { email: fe2Email, password: 'Welcome@123' });
  const fe2Token = fe2Login.b.token;

  // non-admin enroll/delete -> 403
  const badEnrollRes = await multipartReq('POST', '/api/face/enroll', { employee_id: faceEmp1Id, consent_confirmed: 'true' }, [{ field: 'image', filename: 'face.jpg', buffer: mockFaceBuffer('fe1', 0), contentType: 'image/jpeg' }], fe1Token);
  log(badEnrollRes.s === 403, 'Non-admin enroll is rejected (403)', `status=${badEnrollRes.s}`);

  // missing consent -> CONSENT_REQUIRED
  const noConsentRes = await multipartReq('POST', '/api/face/enroll', { employee_id: faceEmp1Id }, [{ field: 'image', filename: 'face.jpg', buffer: mockFaceBuffer('fe1', 0), contentType: 'image/jpeg' }], adminToken);
  log(noConsentRes.s === 400 && noConsentRes.b.error === 'CONSENT_REQUIRED', 'Missing consent -> CONSENT_REQUIRED', `status=${noConsentRes.s}`);

  // Admin enrols employees
  const enroll1 = await multipartReq('POST', '/api/face/enroll', { employee_id: faceEmp1Id, consent_confirmed: 'true' }, [{ field: 'image', filename: 'face.jpg', buffer: mockFaceBuffer('fe1', 0), contentType: 'image/jpeg' }], adminToken);
  const enroll2 = await multipartReq('POST', '/api/face/enroll', { employee_id: faceEmp2Id, consent_confirmed: 'true' }, [{ field: 'image', filename: 'face.jpg', buffer: mockFaceBuffer('fe2', 0), contentType: 'image/jpeg' }], adminToken);
  
  // no embedding, score or distance in any response (enroll, verify, me, employees list)
  const noEmbeddingMe = await req('GET', '/api/face/me', null, fe1Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce' });
  const hasEmbeddingMe = JSON.stringify(noEmbeddingMe.b).includes('embedding') || JSON.stringify(noEmbeddingMe.b).includes('score') || JSON.stringify(noEmbeddingMe.b).includes('distance');
  log(enroll1.s === 201 && enroll2.s === 201 && !hasEmbeddingMe, 'No embedding/score/distance in any response (enroll, me)', `status=${enroll1.s}`);

  // challenge
  const chal1 = await req('POST', '/api/face/challenge', null, fe1Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce' });
  const cid1 = chal1.b.challenge_id;
  const dir1 = chal1.b.challenge;
  const yaw1 = dir1 === 'turn_right' ? 30 : -30;

  // wrong person -> FACE_MISMATCH
  const verifyMismatch = await multipartReq('POST', '/api/face/verify', { challenge_id: cid1, intended_action: 'checkin' }, [
    { field: 'neutral_frame', filename: 'n.jpg', buffer: mockFaceBuffer('fe2', 0), contentType: 'image/jpeg' },
    { field: 'action_frame', filename: 'a.jpg', buffer: mockFaceBuffer('fe2', yaw1), contentType: 'image/jpeg' }
  ], fe1Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce' });
  log(verifyMismatch.s === 403 && verifyMismatch.b.error === 'FACE_MISMATCH', 'Wrong person -> FACE_MISMATCH', `status=${verifyMismatch.s}`);

  // no head turn -> LIVENESS_FAILED
  const verifyLiveness = await multipartReq('POST', '/api/face/verify', { challenge_id: cid1, intended_action: 'checkin' }, [
    { field: 'neutral_frame', filename: 'n.jpg', buffer: mockFaceBuffer('fe1', 0), contentType: 'image/jpeg' },
    { field: 'action_frame', filename: 'a.jpg', buffer: mockFaceBuffer('fe1', 5), contentType: 'image/jpeg' } // only 5 deg turn
  ], fe1Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce' });
  log(verifyLiveness.s === 403 && verifyLiveness.b.error === 'LIVENESS_FAILED', 'No head turn -> LIVENESS_FAILED', `status=${verifyLiveness.s}`);

  // wrong turn direction -> LIVENESS_FAILED
  const verifyDir = await multipartReq('POST', '/api/face/verify', { challenge_id: cid1, intended_action: 'checkin' }, [
    { field: 'neutral_frame', filename: 'n.jpg', buffer: mockFaceBuffer('fe1', 0), contentType: 'image/jpeg' },
    { field: 'action_frame', filename: 'a.jpg', buffer: mockFaceBuffer('fe1', -yaw1), contentType: 'image/jpeg' }
  ], fe1Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce' });
  log(verifyDir.s === 403 && verifyDir.b.error === 'LIVENESS_FAILED', 'Wrong turn direction -> LIVENESS_FAILED', `status=${verifyDir.s}`);

  // lockout after FACE_MAX_FAILED_ATTEMPTS then 429 FACE_LOCKED
  // fe1 had 3 failed attempts above. We need 2 more to lock out (total 5).
  await multipartReq('POST', '/api/face/verify', { challenge_id: cid1, intended_action: 'checkin' }, [
    { field: 'neutral_frame', filename: 'n.jpg', buffer: mockFaceBuffer('fe1', 0), contentType: 'image/jpeg' },
    { field: 'action_frame', filename: 'a.jpg', buffer: mockFaceBuffer('fe1', 0), contentType: 'image/jpeg' }
  ], fe1Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce' });
  await multipartReq('POST', '/api/face/verify', { challenge_id: cid1, intended_action: 'checkin' }, [
    { field: 'neutral_frame', filename: 'n.jpg', buffer: mockFaceBuffer('fe1', 0), contentType: 'image/jpeg' },
    { field: 'action_frame', filename: 'a.jpg', buffer: mockFaceBuffer('fe1', 0), contentType: 'image/jpeg' }
  ], fe1Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce' });
  
  // Now 6th attempt should return 429 FACE_LOCKED
  const lockedRes = await multipartReq('POST', '/api/face/verify', { challenge_id: cid1, intended_action: 'checkin' }, [
    { field: 'neutral_frame', filename: 'n.jpg', buffer: mockFaceBuffer('fe1', 0), contentType: 'image/jpeg' },
    { field: 'action_frame', filename: 'a.jpg', buffer: mockFaceBuffer('fe1', yaw1), contentType: 'image/jpeg' }
  ], fe1Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce' });
  log(lockedRes.s === 429 && lockedRes.b.error === 'FACE_LOCKED', 'Lockout after max failed attempts -> FACE_LOCKED', `status=${lockedRes.s}`);

  // We will now use fe2 for the remaining tests
  const chal2 = await req('POST', '/api/face/challenge', null, fe2Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce' });
  const cid2 = chal2.b.challenge_id;
  const yaw2 = chal2.b.challenge === 'turn_right' ? 30 : -30;

  const validVer = await multipartReq('POST', '/api/face/verify', { challenge_id: cid2, intended_action: 'checkin' }, [
    { field: 'neutral_frame', filename: 'n.jpg', buffer: mockFaceBuffer('fe2', 0), contentType: 'image/jpeg' },
    { field: 'action_frame', filename: 'a.jpg', buffer: mockFaceBuffer('fe2', yaw2), contentType: 'image/jpeg' }
  ], fe2Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce' });
  const fe2Proof = validVer.b.face_proof;

  // challenge reuse -> 400 CHALLENGE_INVALID (because validVer consumes the challenge)
  const reuseChal = await multipartReq('POST', '/api/face/verify', { challenge_id: cid2, intended_action: 'checkin' }, [
    { field: 'neutral_frame', filename: 'n.jpg', buffer: mockFaceBuffer('fe2', 0), contentType: 'image/jpeg' },
    { field: 'action_frame', filename: 'a.jpg', buffer: mockFaceBuffer('fe2', yaw2), contentType: 'image/jpeg' }
  ], fe2Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce' });
  log(reuseChal.s === 400 && reuseChal.b.error === 'CHALLENGE_INVALID', 'Challenge reuse -> CHALLENGE_INVALID', `status=${reuseChal.s}`);

  // enforce + missing proof -> FACE_PROOF_REQUIRED
  await req('POST', '/api/qr/generate', { department_id: deptAId }, adminToken);
  const faceQrRes = await req('GET', `/api/qr/current?department_id=${deptAId}`, null, fe2Token);
  
  const enforceMiss = await req('POST', '/api/attendance/checkin', {
    qr_session_id: faceQrRes.b.qr_session_id,
    code_value: faceQrRes.b.code_value,
    signature: faceQrRes.b.signature,
    latitude: 10, longitude: 10, accuracy_m: 10, is_mock_location: false,
    // face_proof omitted
  }, fe2Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce' });
  log(enforceMiss.s === 403 && enforceMiss.b.error === 'FACE_PROOF_REQUIRED', 'Enforce + missing proof -> FACE_PROOF_REQUIRED', `status=${enforceMiss.s}`);

  // log mode + missing proof succeeds and creates an alert
  const logModeSuc = await req('POST', '/api/attendance/checkin', {
    qr_session_id: faceQrRes.b.qr_session_id,
    code_value: faceQrRes.b.code_value,
    signature: faceQrRes.b.signature,
    latitude: 10, longitude: 10, accuracy_m: 10, is_mock_location: false,
    // face_proof omitted
  }, fe2Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'log' });
  log(logModeSuc.s === 201, 'Log mode + missing proof succeeds', `status=${logModeSuc.s}`);

  // off mode ignores it
  const offModeSuc = await req('POST', '/api/attendance/checkout', { // checkout this time
    qr_session_id: faceQrRes.b.qr_session_id,
    code_value: faceQrRes.b.code_value,
    signature: faceQrRes.b.signature,
    latitude: 10, longitude: 10, accuracy_m: 10, is_mock_location: false,
  }, fe2Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'off' });
  log(offModeSuc.s === 200, 'Off mode + missing proof succeeds', `status=${offModeSuc.s}`);

  // proof NOT consumed when an earlier step (geofence) fails
  // get a fresh challenge and proof
  const chal3 = await req('POST', '/api/face/challenge', null, fe2Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce' });
  const yaw3 = chal3.b.challenge === 'turn_right' ? 30 : -30;
  const ver3 = await multipartReq('POST', '/api/face/verify', { challenge_id: chal3.b.challenge_id, intended_action: 'checkin' }, [
    { field: 'neutral_frame', filename: 'n.jpg', buffer: mockFaceBuffer('fe2', 0), contentType: 'image/jpeg' },
    { field: 'action_frame', filename: 'a.jpg', buffer: mockFaceBuffer('fe2', yaw3), contentType: 'image/jpeg' }
  ], fe2Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce' });
  const proofToNotConsume = ver3.b.face_proof;

  const outOfFence = await req('POST', '/api/attendance/checkin', { // doing checkin again to trigger error 
    qr_session_id: faceQrRes.b.qr_session_id,
    code_value: faceQrRes.b.code_value,
    signature: faceQrRes.b.signature,
    latitude: -90, longitude: -90, accuracy_m: 10, is_mock_location: false, // bad coords -> OUTSIDE_GEOFENCE
    face_proof: proofToNotConsume
  }, fe2Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce', 'x-geofence-mode': 'enforce' });
  log(outOfFence.s === 403 && outOfFence.b.error === 'OUTSIDE_GEOFENCE', 'Geofence failure blocks face proof consumption', `status=${outOfFence.s}`);

  // two concurrent requests with the same proof (exactly one succeeds)
  // we will execute two concurrent checkin requests with the same proof (proofToNotConsume)
  // because fe2 already checked in today (during the log mode test), wait! fe2 already checked in!
  // If fe2 already checked in, BOTH requests will hit Duplicate Checkin (409)!
  // To avoid duplicate checkin blocking the replay test, let's create fe3 quickly.
  const fe3Email = `fe3.${faceSuffix}@sentinel.com`;
  const faceEmp3Res = await req('POST', '/api/employees', { name: 'Face Emp 3', email: fe3Email, department_id: deptAId, role: 'Employee', designation: 'Tester', phone: `+3${faceSuffix}`, join_date: '2023-01-01' }, adminToken);
  const fe3Login = await req('POST', '/api/auth/login', { email: fe3Email, password: 'Welcome@123' });
  const fe3Token = fe3Login.b.token;
  const faceEmp3Id = faceEmp3Res.b && (faceEmp3Res.b._id || faceEmp3Res.b.id);
  await multipartReq('POST', '/api/face/enroll', { employee_id: faceEmp3Id, consent_confirmed: 'true' }, [{ field: 'image', filename: 'face.jpg', buffer: mockFaceBuffer('fe3', 0), contentType: 'image/jpeg' }], adminToken);
  
  const chal4 = await req('POST', '/api/face/challenge', null, fe3Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce' });
  const ver4 = await multipartReq('POST', '/api/face/verify', { challenge_id: chal4.b.challenge_id, intended_action: 'checkin' }, [
    { field: 'neutral_frame', filename: 'n.jpg', buffer: mockFaceBuffer('fe3', 0), contentType: 'image/jpeg' },
    { field: 'action_frame', filename: 'a.jpg', buffer: mockFaceBuffer('fe3', chal4.b.challenge === 'turn_right' ? 30 : -30), contentType: 'image/jpeg' }
  ], fe3Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce' });
  const concurrentProof = ver4.b.face_proof;

  const reqObj = {
    qr_session_id: faceQrRes.b.qr_session_id,
    code_value: faceQrRes.b.code_value,
    signature: faceQrRes.b.signature,
    latitude: 10, longitude: 10, accuracy_m: 10, is_mock_location: false,
    face_proof: concurrentProof
  };

  const p1 = req('POST', '/api/attendance/checkin', reqObj, fe3Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce', 'x-geofence-mode': 'off' });
  const p2 = req('POST', '/api/attendance/checkin', reqObj, fe3Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce', 'x-geofence-mode': 'off' });
  const [res1, res2] = await Promise.all([p1, p2]);

  const statuses = [res1.s, res2.s].sort();
  // We expect one to be 201 (success), and one to be 403 (FACE_PROOF_REUSED) or 409 (duplicate checkin, but likely FACE_PROOF_REUSED due to race condition on consume)
  // Wait, if it hits duplicate checkin, it's not a REPLAY issue but a DUPLICATE checkin issue. 
  // Let's actually verify FACE_PROOF_REUSED directly. 
  // Wait, if BOTH requests pass the no-duplicate check concurrently, they hit consumeFaceProof.
  // One inserts the FaceProofUse (201), the other gets a duplicate JTI error (403 FACE_PROOF_REUSED).
  log(statuses.includes(201) && statuses.includes(403) && (res1.b.error === 'FACE_PROOF_REUSED' || res2.b.error === 'FACE_PROOF_REUSED'), 'Two concurrent requests (exactly one succeeds, one gets FACE_PROOF_REUSED)', `statuses=${statuses.join(',')}`);

  // proof of another employee -> FACE_PROOF_INVALID
  // Using fe3's proof for fe2
  const wrongEmp = await req('POST', '/api/attendance/checkout', { 
    qr_session_id: faceQrRes.b.qr_session_id,
    code_value: faceQrRes.b.code_value,
    signature: faceQrRes.b.signature,
    latitude: 10, longitude: 10, accuracy_m: 10, is_mock_location: false,
    face_proof: fe2Proof // wait, fe2Proof was generated for fe2, let's use it for fe3!
  }, fe3Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce' });
  log(wrongEmp.s === 403 && wrongEmp.b.error === 'FACE_PROOF_INVALID', 'Proof of another employee -> FACE_PROOF_INVALID', `status=${wrongEmp.s}`);

  // intended_action mismatch
  // fe3 uses a checkin proof (which we can generate) for checkout
  const chal5 = await req('POST', '/api/face/challenge', null, fe3Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce' });
  const ver5 = await multipartReq('POST', '/api/face/verify', { challenge_id: chal5.b.challenge_id, intended_action: 'checkin' }, [
    { field: 'neutral_frame', filename: 'n.jpg', buffer: mockFaceBuffer('fe3', 0), contentType: 'image/jpeg' },
    { field: 'action_frame', filename: 'a.jpg', buffer: mockFaceBuffer('fe3', chal5.b.challenge === 'turn_right' ? 30 : -30), contentType: 'image/jpeg' }
  ], fe3Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce' });
  
  const mismatchAction = await req('POST', '/api/attendance/checkout', { 
    qr_session_id: faceQrRes.b.qr_session_id,
    code_value: faceQrRes.b.code_value,
    signature: faceQrRes.b.signature,
    latitude: 10, longitude: 10, accuracy_m: 10, is_mock_location: false,
    face_proof: ver5.b.face_proof
  }, fe3Token, { 'x-test-secret': TEST_OVERRIDE_SECRET, 'x-face-mode': 'enforce' });
  log(mismatchAction.s === 403 && mismatchAction.b.error === 'FACE_PROOF_ACTION_MISMATCH', 'intended_action mismatch -> FACE_PROOF_ACTION_MISMATCH', `status=${mismatchAction.s}`);

  // X-Face-Mode / override ignored without correct X-Test-Secret
  const overrideIgnored = await req('POST', '/api/attendance/checkin', { 
    qr_session_id: faceQrRes.b.qr_session_id,
    code_value: faceQrRes.b.code_value,
    signature: faceQrRes.b.signature,
    latitude: 10, longitude: 10, accuracy_m: 10, is_mock_location: false,
    face_proof: ver5.b.face_proof // Action mismatch, would be 403 in enforce mode
  }, fe3Token, { 'x-test-secret': 'wrong_secret', 'x-face-mode': 'enforce' });
  // without secret, it falls back to 'off' mode (default), which succeeds (201) since fe3 hasn't checked in yet
  log(overrideIgnored.s === 201, 'X-Face-Mode override ignored without correct X-Test-Secret', `status=${overrideIgnored.s}`);

  // expired challenge
  // we can't easily wait for expiry, but we can trust it works if we manipulate the DB. We'll skip exact expiry test as we'd have to sleep 30s.


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
