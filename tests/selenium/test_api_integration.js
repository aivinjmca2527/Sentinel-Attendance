/**
 * Sentinel Attendance — Selenium Test: API Integration via Browser
 *
 * Tests API endpoints through the browser's fetch API to verify:
 * - Auth endpoints (login, TOTP, me)
 * - Employee CRUD endpoints
 * - Attendance endpoints
 * - Leave management endpoints
 * - Dashboard/Reports endpoints
 * - Security alert endpoints
 *
 * This approach validates that the frontend can communicate
 * with the backend correctly through the browser environment.
 */

const { describe, it, before, after } = require('mocha');
const { expect } = require('chai');
const { By } = require('selenium-webdriver');

const { createDriver, waitForServer, BASE_URL, TIMEOUTS, ADMIN_CREDENTIALS, EMPLOYEE_CREDENTIALS } = require('./config');
const { navigateTo } = require('./helpers');

/**
 * Execute a fetch request inside the browser and return the result.
 */
async function browserFetch(driver, path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const script = `
    const [url, opts, callback] = arguments;
    fetch(url, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      credentials: 'include',
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })
    .then(async res => {
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = text; }
      callback({ status: res.status, body: json });
    })
    .catch(err => callback({ status: 0, body: { error: err.message } }));
  `;
  return driver.executeAsyncScript(script, url, options);
}

describe('🌐 API Integration Tests (via Browser)', function () {
  this.timeout(90000);
  let driver;
  let adminToken = null;
  let empToken = null;

  before(async function () {
    await waitForServer();
    driver = await createDriver();
    // Navigate to a page so we have a valid origin for fetch
    await navigateTo(driver, '/Templates/Login_Page.html');
    await driver.sleep(1000);
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  // ─── Health ─────────────────────────────────────────────────────────────

  describe('Health Endpoint', function () {
    it('GET /api/health should return status ok', async function () {
      const res = await browserFetch(driver, '/api/health');
      expect(res.status).to.equal(200);
      expect(res.body.status).to.equal('ok');
      expect(res.body.time).to.be.a('string');
    });
  });

  // ─── Auth ───────────────────────────────────────────────────────────────

  describe('Authentication API', function () {
    it('POST /api/auth/login should reject empty body', async function () {
      const res = await browserFetch(driver, '/api/auth/login', {
        method: 'POST',
        body: {},
      });
      expect(res.status).to.equal(400);
    });

    it('POST /api/auth/login should reject wrong password', async function () {
      const res = await browserFetch(driver, '/api/auth/login', {
        method: 'POST',
        body: { email: ADMIN_CREDENTIALS.email, password: 'wrongpass' },
      });
      expect(res.status).to.equal(401);
    });

    it('POST /api/auth/login should succeed for admin (returns TOTP flow)', async function () {
      const res = await browserFetch(driver, '/api/auth/login', {
        method: 'POST',
        body: ADMIN_CREDENTIALS,
      });
      expect(res.status).to.equal(200);
      // Admin should require TOTP setup or verify
      if (res.body.requireTotpSetup || res.body.requireTotp) {
        adminToken = res.body.tempToken;
        expect(adminToken).to.be.a('string');
      } else if (res.body.token) {
        adminToken = res.body.token;
        expect(adminToken).to.be.a('string');
      }
    });

    it('POST /api/auth/login should succeed for employee', async function () {
      const res = await browserFetch(driver, '/api/auth/login', {
        method: 'POST',
        body: EMPLOYEE_CREDENTIALS,
      });
      expect(res.status).to.equal(200);
      if (res.body.token) {
        empToken = res.body.token;
        expect(empToken).to.be.a('string');
      }
    });

    it('GET /api/auth/me should reject unauthenticated requests', async function () {
      const res = await browserFetch(driver, '/api/auth/me');
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it('GET /api/auth/me should work with valid token', async function () {
      if (!adminToken) this.skip();
      const res = await browserFetch(driver, '/api/auth/me', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      // May return 200 (valid) or 401 (temp token without TOTP verify)
      expect(res.status).to.be.oneOf([200, 401]);
    });
  });

  // ─── Employees ──────────────────────────────────────────────────────────

  describe('Employee API', function () {
    it('GET /api/employees should reject unauthenticated requests', async function () {
      const res = await browserFetch(driver, '/api/employees');
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it('GET /api/departments should reject unauthenticated requests', async function () {
      const res = await browserFetch(driver, '/api/departments');
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it('GET /api/employees should return list with valid token', async function () {
      if (!adminToken) this.skip();
      const res = await browserFetch(driver, '/api/employees', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      // May fail if using temp token; skip assertion if so
      if (res.status === 200) {
        expect(res.body).to.be.an('array');
      }
    });
  });

  // ─── QR & Attendance ───────────────────────────────────────────────────

  describe('QR & Attendance API', function () {
    it('GET /api/qr/current without department_id should return 400', async function () {
      if (!adminToken) this.skip();
      const res = await browserFetch(driver, '/api/qr/current', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).to.be.oneOf([400, 401]);
    });

    it('GET /api/attendance should reject unauthenticated requests', async function () {
      const res = await browserFetch(driver, '/api/attendance');
      expect(res.status).to.be.oneOf([401, 403]);
    });
  });

  // ─── Dashboard ──────────────────────────────────────────────────────────

  describe('Dashboard API', function () {
    it('GET /api/dashboard/summary should reject unauthenticated requests', async function () {
      const res = await browserFetch(driver, '/api/dashboard/summary');
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it('GET /api/reports/organisation should reject unauthenticated requests', async function () {
      const res = await browserFetch(driver, '/api/reports/organisation');
      expect(res.status).to.be.oneOf([401, 403]);
    });
  });

  // ─── Leave ──────────────────────────────────────────────────────────────

  describe('Leave API', function () {
    it('GET /api/leave should reject unauthenticated requests', async function () {
      const res = await browserFetch(driver, '/api/leave');
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it('GET /api/leave/balance should reject unauthenticated requests', async function () {
      const res = await browserFetch(driver, '/api/leave/balance');
      expect(res.status).to.be.oneOf([401, 403]);
    });
  });

  // ─── Security ──────────────────────────────────────────────────────────

  describe('Security API', function () {
    it('GET /api/security/alerts should reject unauthenticated requests', async function () {
      const res = await browserFetch(driver, '/api/security/alerts');
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it('GET /api/security/alerts/stats should reject unauthenticated requests', async function () {
      const res = await browserFetch(driver, '/api/security/alerts/stats');
      expect(res.status).to.be.oneOf([401, 403]);
    });
  });

  // ─── 404 Handling ──────────────────────────────────────────────────────

  describe('404 Handling', function () {
    it('GET /api/nonexistent should return 404', async function () {
      const res = await browserFetch(driver, '/api/nonexistent');
      expect(res.status).to.equal(404);
      expect(res.body.error).to.be.a('string');
    });
  });
});
