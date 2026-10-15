/**
 * Sentinel Attendance — Selenium Test Configuration
 * Shared setup for browser driver, base URL, timeouts, etc.
 */

require('dotenv').config();
const { Builder } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');

const BASE_URL = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

// Timeouts (ms)
const TIMEOUTS = {
  implicit:   5000,   // implicit wait for element lookups
  pageLoad:  30000,   // page load timeout
  script:    15000,   // script execution timeout
  explicit:  10000,   // explicit wait default
  short:      3000,   // short wait (animations, quick transitions)
  long:      30000,   // long wait (server start, heavy operations)
};

// Test credentials
const ADMIN_CREDENTIALS = {
  email:    'admin@sentinel.com',
  password: 'Admin@123',
};

const EMPLOYEE_CREDENTIALS = {
  email:    'mary.lee@sentinel.com',
  password: 'Mary@123',
};

/**
 * Build and return a configured WebDriver instance (headless Firefox).
 */
async function createDriver() {
  const options = new firefox.Options();
  options.addArguments('--headless');
  options.addArguments('--width=1920');
  options.addArguments('--height=1080');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');

  const driver = await new Builder()
    .forBrowser('firefox')
    .setFirefoxOptions(options)
    .build();

  await driver.manage().setTimeouts({
    implicit: TIMEOUTS.implicit,
    pageLoad: TIMEOUTS.pageLoad,
    script:   TIMEOUTS.script,
  });

  return driver;
}

/**
 * Wait for the server to be healthy before running tests.
 */
async function waitForServer(maxWait = TIMEOUTS.long) {
  const http = require('http');
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    try {
      const ok = await new Promise((resolve, reject) => {
        http.get(`${BASE_URL}/api/health`, (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              const body = JSON.parse(data);
              resolve(res.statusCode === 200 && body.status === 'ok');
            } catch {
              resolve(false);
            }
          });
        }).on('error', () => resolve(false));
      });
      if (ok) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${BASE_URL} did not become healthy within ${maxWait}ms`);
}

module.exports = {
  BASE_URL,
  TIMEOUTS,
  ADMIN_CREDENTIALS,
  EMPLOYEE_CREDENTIALS,
  createDriver,
  waitForServer,
};
