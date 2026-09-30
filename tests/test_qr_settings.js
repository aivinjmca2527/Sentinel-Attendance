/**
 * Test Suite for Dynamic QR Settings (Regeneration Interval & Geolocation Enforcement)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
let adminToken = '';
let testDeptId = '';

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    process.exitCode = 1;
  }
}

async function run() {
  console.log('\n─── Test 1: Verify Static Template Changes ───');
  const htmlPath = path.join(__dirname, '../Templates/QR_Generation_Page.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert(!html.includes('Cryptographic Signing'), 'Cryptographic Signing title removed from HTML');
  assert(!html.includes('Sign QR data to prevent cloning'), 'Cryptographic Signing description removed from HTML');
  assert(!html.includes('id="toggle-crypto"'), 'toggle-crypto element removed from HTML');
  assert(html.includes('id="interval-slider"'), 'interval-slider present in HTML');
  assert(html.includes('id="toggle-geofence"'), 'toggle-geofence present in HTML');

  console.log('\n─── Test 2: Admin Auth & Settings Fetch ───');
  const loginRes = await request('POST', '/api/auth/login', {
    email: 'admin@sentinel.com',
    password: 'Admin@123'
  });
  adminToken = loginRes.body.token;
  assert(!!adminToken, 'Admin logged in successfully');

  const deptsRes = await request('GET', '/api/departments', null, adminToken);
  testDeptId = deptsRes.body[0]._id || deptsRes.body[0].id;
  assert(!!testDeptId, `Found test department: ${testDeptId}`);

  const initialSettings = await request('GET', '/api/qr/settings', null, adminToken);
  assert(initialSettings.status === 200, 'GET /api/qr/settings returned 200');
  assert(typeof initialSettings.body.intervalSeconds === 'number', `intervalSeconds is number: ${initialSettings.body.intervalSeconds}`);
  assert(typeof initialSettings.body.geofenceEnabled === 'boolean', `geofenceEnabled is boolean: ${initialSettings.body.geofenceEnabled}`);

  console.log('\n─── Test 3: Updating Regeneration Interval ───');
  const updateIntervalRes = await request('POST', '/api/qr/settings', { intervalSeconds: 30 }, adminToken);
  assert(updateIntervalRes.status === 200, 'POST /api/qr/settings with intervalSeconds=30 returned 200');
  assert(updateIntervalRes.body.settings.intervalSeconds === 30, 'Settings reflect intervalSeconds=30');

  // Verify newly generated QR code has ~30s lifetime
  const newQr = await request('POST', '/api/qr/regenerate-keys', null, adminToken);
  const genTime = new Date().getTime();
  const expTime = new Date(newQr.body.expires_at).getTime();
  const lifetimeSec = Math.round((expTime - genTime) / 1000);
  assert(lifetimeSec >= 28 && lifetimeSec <= 32, `New QR expires in ~30s (actual: ${lifetimeSec}s)`);

  console.log('\n─── Test 4: Geolocation Enforcement Toggle ───');
  // Toggle geofence off
  const toggleOffRes = await request('POST', '/api/qr/settings', { geofenceEnabled: false }, adminToken);
  assert(toggleOffRes.status === 200, 'POST /api/qr/settings with geofenceEnabled=false returned 200');
  assert(toggleOffRes.body.settings.geofenceEnabled === false, 'geofenceEnabled is false');
  assert(toggleOffRes.body.settings.geofenceMode === 'off', 'geofenceMode transitioned to "off"');

  // Toggle geofence on (enforce)
  const toggleOnRes = await request('POST', '/api/qr/settings', { geofenceEnabled: true, geofenceMode: 'enforce' }, adminToken);
  assert(toggleOnRes.status === 200, 'POST /api/qr/settings with geofenceEnabled=true returned 200');
  assert(toggleOnRes.body.settings.geofenceEnabled === true, 'geofenceEnabled is true');
  assert(toggleOnRes.body.settings.geofenceMode === 'enforce', 'geofenceMode transitioned to "enforce"');

  console.log('\n─── Test 5: Reset Settings to Default ───');
  const resetRes = await request('POST', '/api/qr/settings', { intervalSeconds: 15, geofenceEnabled: true, geofenceMode: 'log' }, adminToken);
  assert(resetRes.status === 200, 'Settings reset to interval=15, mode=log');

  console.log('\nAll tests complete!\n');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
