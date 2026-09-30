/**
 * Sentinel Attendance — Kiosk QR Endpoint & Flow Verification
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const KIOSK_KEY = process.env.KIOSK_DISPLAY_KEY || 'sentinel-kiosk-display-key-test-2026';
process.env.KIOSK_DISPLAY_KEY = KIOSK_KEY;
process.env.NODE_ENV = 'test';

let passed = 0;
let failed = 0;
let spawnedServer = null;

function req(method, reqPath, body, token, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path: reqPath,
      method,
      headers: { 'Content-Type': 'application/json', ...customHeaders },
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    const r = http.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        try {
          resolve({ s: res.statusCode, b: JSON.parse(d), h: res.headers });
        } catch {
          resolve({ s: res.statusCode, b: d, h: res.headers });
        }
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
  } catch (e) {}

  console.log('[Test Suite] Launching Sentinel server for Kiosk tests...');
  spawnedServer = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    stdio: 'ignore',
    env: { ...process.env, PORT: '3000', NODE_ENV: 'test', KIOSK_DISPLAY_KEY: KIOSK_KEY },
  });

  const start = Date.now();
  while (Date.now() - start < 15000) {
    await new Promise((r) => setTimeout(r, 400));
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
  if (ok === true) {
    passed++;
    console.log(`  ✅ ${label}${detail ? ' — ' + detail : ''}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
  }
}

async function run() {
  await ensureServerRunning();

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   Sentinel EAMS — Kiosk Display Key Verification    ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // 1. Health
  const h = await req('GET', '/api/health');
  log(h.s === 200 && h.b.status === 'ok', 'Health Check', `status=${h.b.status}`);

  // 2. Fetch departments to get a valid department_id
  const login = await req('POST', '/api/auth/login', { email: 'admin@sentinel.com', password: 'Admin@123' });
  const adminToken = login.b.token || login.b.tempToken;
  const depts = await req('GET', '/api/departments', null, adminToken);
  const testDeptId = depts.b && depts.b[0] ? (depts.b[0]._id || depts.b[0].id) : null;
  log(Boolean(testDeptId), 'Found test department_id', `id=${testDeptId}`);

  console.log('\n─── Test Suite A: Unauthenticated Kiosk View (Security & Validation) ───');

  // 3. Kiosk view without any kiosk_key -> 401
  const noKey = await req('GET', `/api/qr/kiosk-view?department_id=${testDeptId}`);
  log(
    noKey.s === 401 && noKey.b.error === 'Invalid or missing kiosk display key.',
    'Missing kiosk_key rejected with 401',
    `status=${noKey.s}, error="${noKey.b.error}"`
  );

  // 4. Kiosk view with invalid kiosk_key -> 401 (even if department_id is valid)
  const wrongKey = await req('GET', `/api/qr/kiosk-view?department_id=${testDeptId}&kiosk_key=wrong-secret-key-xyz`);
  log(
    wrongKey.s === 401 && wrongKey.b.error === 'Invalid or missing kiosk display key.',
    'Invalid kiosk_key rejected with 401',
    `status=${wrongKey.s}, error="${wrongKey.b.error}"`
  );

  // 5. Kiosk view with invalid kiosk_key and bogus department_id -> 401 (hides department validity)
  const wrongKeyBogusDept = await req('GET', '/api/qr/kiosk-view?department_id=bogus-non-existent-dept&kiosk_key=bad-key');
  log(
    wrongKeyBogusDept.s === 401 && wrongKeyBogusDept.b.error === 'Invalid or missing kiosk display key.',
    'Invalid key returns 401 without revealing department validity',
    `status=${wrongKeyBogusDept.s}`
  );

  // 6. Kiosk view with valid kiosk_key but missing department_id -> 400
  const missingDept = await req('GET', `/api/qr/kiosk-view?kiosk_key=${KIOSK_KEY}`);
  log(
    missingDept.s === 400 && missingDept.b.error === 'department_id query parameter is required.',
    'Valid key but missing department_id returns 400',
    `status=${missingDept.s}, error="${missingDept.b.error}"`
  );

  // 7. Kiosk view with valid kiosk_key and valid department_id -> 200 OK
  const validKiosk = await req('GET', `/api/qr/kiosk-view?department_id=${testDeptId}&kiosk_key=${KIOSK_KEY}`);
  const hasFields = Boolean(
    validKiosk.s === 200 &&
    validKiosk.b.qr_session_id &&
    validKiosk.b.department_id &&
    validKiosk.b.code_value &&
    validKiosk.b.signature &&
    validKiosk.b.expires_at
  );
  log(
    hasFields,
    'Valid kiosk_key & department_id returns 200 with complete QR session',
    `status=${validKiosk.s}, session=${validKiosk.b.qr_session_id}, code_value_len=${(validKiosk.b.code_value || '').length}`
  );

  // 8. Confirm kiosk_key via x-kiosk-key header also works
  const headerKiosk = await req('GET', `/api/qr/kiosk-view?department_id=${testDeptId}`, null, null, {
    'x-kiosk-key': KIOSK_KEY,
  });
  log(
    headerKiosk.s === 200 && Boolean(headerKiosk.b.code_value),
    'Valid kiosk_key via header (x-kiosk-key) also succeeds',
    `status=${headerKiosk.s}`
  );

  console.log('\n─── Test Suite B: Rate Limiting Pattern Verification ───');
  // 9. Verify rate limit headers exist on kiosk-view endpoint
  const rateLimitHeadersPresent =
    validKiosk.h['ratelimit-limit'] !== undefined ||
    validKiosk.h['x-ratelimit-limit'] !== undefined ||
    validKiosk.h['ratelimit-remaining'] !== undefined;
  log(
    rateLimitHeadersPresent,
    'Rate-limiting standard headers returned on kiosk-view route',
    `limit=${validKiosk.h['ratelimit-limit'] || validKiosk.h['x-ratelimit-limit'] || 'active'}`
  );

  console.log('\n─── Test Suite C: Unchanged Authenticated Endpoints ───');

  // 10. GET /api/qr/current without auth -> 401
  const unauthCurrent = await req('GET', `/api/qr/current?department_id=${testDeptId}`);
  log(unauthCurrent.s === 401, 'GET /api/qr/current still requires JWT auth', `status=${unauthCurrent.s}`);

  // 11. GET /api/qr/current with admin token -> 200 OK
  const authCurrent = await req('GET', `/api/qr/current?department_id=${testDeptId}`, null, adminToken);
  log(
    authCurrent.s === 200 && Boolean(authCurrent.b.code_value),
    'GET /api/qr/current works with admin token',
    `status=${authCurrent.s}, session=${authCurrent.b.qr_session_id}`
  );

  // 12. Underlying logic parity: kiosk-view and current return same active session structure
  log(
    validKiosk.b.department_id === authCurrent.b.department_id,
    'Kiosk view and current route share same underlying department session data',
    `dept=${validKiosk.b.department_id}`
  );

  console.log('\n─── Test Suite D: Static Template Verification ───');

  // 13. Verify QR_Generation_Page.html contains both admin and kiosk components
  const pageRes = await req('GET', '/Templates/QR_Generation_Page.html');
  const htmlContent = String(pageRes.b);
  const hasKioskWrapper = htmlContent.includes('id="kiosk-view-wrapper"');
  const hasAdminWrapper = htmlContent.includes('id="admin-view-wrapper"');
  const hasKioskKeyCheck = htmlContent.includes('kiosk_key');
  const hasKioskViewEndpoint = htmlContent.includes('/api/qr/kiosk-view');
  log(
    pageRes.s === 200 && hasKioskWrapper && hasAdminWrapper && hasKioskKeyCheck && hasKioskViewEndpoint,
    'QR_Generation_Page.html contains dual-mode kiosk and admin architecture',
    `status=${pageRes.s}, kioskWrapper=${hasKioskWrapper}, adminWrapper=${hasAdminWrapper}`
  );

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(`║  Results: ✅ ${passed} passed │ ❌  ${failed} failed │ Total: ${passed + failed} tests ║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('[FATAL]', e);
  process.exit(1);
});
