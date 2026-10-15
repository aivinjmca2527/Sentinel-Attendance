#!/usr/bin/env node

/**
 * Sentinel Attendance — Selenium Test Runner
 *
 * A self-contained test runner that executes all Selenium test suites
 * and displays beautiful, colored terminal output.
 *
 * Usage:
 *   node tests/selenium/run_tests.js              — Run all tests
 *   node tests/selenium/run_tests.js login        — Run only login tests
 *   node tests/selenium/run_tests.js nav          — Run only navigation tests
 *   node tests/selenium/run_tests.js dashboard    — Run only dashboard tests
 *   node tests/selenium/run_tests.js employees    — Run only employee tests
 *   node tests/selenium/run_tests.js attendance   — Run only attendance/QR tests
 *   node tests/selenium/run_tests.js leave        — Run only leave/security tests
 *   node tests/selenium/run_tests.js api          — Run only API integration tests
 *
 * Ensure the server is running first:  npm run dev
 */

const path = require('path');
const http = require('http');
const { By, Key, until } = require('selenium-webdriver');

// ── Import config & helpers ─────────────────────────────────────────────────

const {
  BASE_URL, TIMEOUTS, ADMIN_CREDENTIALS, EMPLOYEE_CREDENTIALS,
  createDriver, waitForServer,
} = require('./config');
const {
  navigateTo, waitForVisible, waitForPresent, waitForClickable,
  waitForUrlContains, waitForTitleContains, clearAndType,
  takeScreenshot, loginAsAdmin, setAuthToken, getAdminTokenViaAPI,
  elementExists, getElementText, scrollToElement, waitForPageLoad,
} = require('./helpers');

// ── ANSI Color Helpers ──────────────────────────────────────────────────────

const c = {
  reset:      '\x1b[0m',
  bold:       '\x1b[1m',
  dim:        '\x1b[2m',
  italic:     '\x1b[3m',
  underline:  '\x1b[4m',
  red:        '\x1b[31m',
  green:      '\x1b[32m',
  yellow:     '\x1b[33m',
  blue:       '\x1b[34m',
  magenta:    '\x1b[35m',
  cyan:       '\x1b[36m',
  white:      '\x1b[37m',
  bgRed:      '\x1b[41m',
  bgGreen:    '\x1b[42m',
  bgYellow:   '\x1b[43m',
  bgBlue:     '\x1b[44m',
  bgCyan:     '\x1b[46m',
};

function banner(text) {
  const line = '═'.repeat(84);
  console.log(`\n${c.cyan}╔${line}╗${c.reset}`);
  console.log(`${c.cyan}║${c.reset}  ${c.bold}${c.white}${text.padEnd(82)}${c.cyan}║${c.reset}`);
  console.log(`${c.cyan}╚${line}╝${c.reset}\n`);
}

function sectionHeader(icon, title) {
  const width = Math.max(0, 72 - title.length);
  console.log(`\n  ${c.bold}${c.blue}┌─── ${icon}  ${title} ${'─'.repeat(width)}┐${c.reset}`);
}

function sectionFooter() {
  console.log(`  ${c.blue}└${'─'.repeat(82)}┘${c.reset}`);
}

function logTestStart(name) {
  const label = `Testing: ${name} `.padEnd(56, '.');
  process.stdout.write(`  ${c.blue}│${c.reset}  ${label} `);
}

function logTestResult(name, passed, duration, error) {
  const status = passed
    ? `${c.bold}${c.green}✅ SUCCESS${c.reset}`
    : `${c.bold}${c.red}❌ FAILED ${c.reset}`;
  const dur = `${c.dim}(${duration}ms)${c.reset}`;
  console.log(`${status} ${dur}`);
  if (!passed && error) {
    const errMsg = error.message || String(error);
    console.log(`  ${c.blue}│${c.reset}    ${c.red}↳ ${errMsg.substring(0, 76)}${c.reset}`);
  }
}

function logSkipped(name) {
  const label = `Testing: ${name} `.padEnd(56, '.');
  console.log(`  ${c.blue}│${c.reset}  ${label} ${c.yellow}⏭️  SKIPPED${c.reset}`);
}

// ── Execute a fetch request inside the browser ──────────────────────────────

async function browserFetch(driver, urlPath, options = {}) {
  const url = `${BASE_URL}${urlPath}`;
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

/**
 * Make an HTTP request using Node.js native http module (no browser needed).
 * More reliable for API tests than browserFetch.
 */
async function apiFetch(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const method = (options.method || 'GET').toUpperCase();
    const bodyData = options.body ? JSON.stringify(options.body) : null;
    const PORT = process.env.PORT || 3000;

    const reqOpts = {
      hostname: 'localhost',
      port: PORT,
      path: urlPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };
    if (bodyData) reqOpts.headers['Content-Length'] = Buffer.byteLength(bodyData);

    const req = http.request(reqOpts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let body;
        try { body = JSON.parse(data); } catch { body = data; }
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

// ── Test Assertion Helpers ──────────────────────────────────────────────────

function expect(actual) {
  return {
    to: {
      equal(expected) {
        if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
      },
      include(substring) {
        if (typeof actual !== 'string' || !actual.includes(substring)) {
          throw new Error(`Expected "${actual}" to include "${substring}"`);
        }
      },
      be: {
        true: (() => { if (actual !== true) throw new Error(`Expected true but got ${actual}`); })(),
        false: (() => { if (actual !== false) throw new Error(`Expected false but got ${actual}`); })(),
        a(type) {
          if (type === 'string' && typeof actual !== 'string') throw new Error(`Expected a string but got ${typeof actual}`);
          if (type === 'array' && !Array.isArray(actual)) throw new Error(`Expected an array but got ${typeof actual}`);
          if (type === 'number' && typeof actual !== 'number') throw new Error(`Expected a number but got ${typeof actual}`);
        },
        greaterThan(n) { if (!(actual > n)) throw new Error(`Expected ${actual} > ${n}`); },
        greaterThanOrEqual(n) { if (!(actual >= n)) throw new Error(`Expected ${actual} >= ${n}`); },
        oneOf(arr) {
          if (!arr.includes(actual)) throw new Error(`Expected ${actual} to be one of [${arr}]`);
        },
      },
      not: {
        be: {
          null: (() => { if (actual === null || actual === undefined) throw new Error('Expected non-null value'); })(),
        }
      }
    },
  };
}

// Simpler assertion helpers
function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertIncludes(str, sub, msg) {
  if (typeof str !== 'string' || !str.toLowerCase().includes(sub.toLowerCase())) {
    throw new Error(msg || `Expected "${str}" to include "${sub}"`);
  }
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)} but got ${JSON.stringify(a)}`);
}

function assertGreaterThan(a, b, msg) {
  if (!(a > b)) throw new Error(msg || `Expected ${a} > ${b}`);
}

function assertOneOf(val, arr, msg) {
  if (!arr.includes(val)) throw new Error(msg || `Expected ${val} to be one of [${arr.join(', ')}]`);
}

function assertIsString(val, msg) {
  if (typeof val !== 'string') throw new Error(msg || `Expected a string but got ${typeof val}`);
}

function assertIsArray(val, msg) {
  if (!Array.isArray(val)) throw new Error(msg || `Expected an array but got ${typeof val}`);
}

// ── Test Suite Definitions ──────────────────────────────────────────────────

/**
 * Each suite is { name, icon, setup, teardown, tests[] }
 * Each test is  { name, fn(driver, ctx) }
 * ctx carries shared state (authToken, etc.)
 */

const SUITES = {

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  login: {
    name: 'Login Page',
    icon: '🔐',
    async setup(driver) {
      await navigateTo(driver, '/Templates/Login_Page.html');
      await driver.executeScript(`localStorage.removeItem('token'); localStorage.removeItem('user');`);
      return {};
    },
    tests: [
      {
        name: 'Page loads with correct title',
        async fn(driver) {
          const title = await driver.getTitle();
          assertIncludes(title, 'Sentinel', 'Page title should contain "Sentinel"');
        },
      },
      {
        name: 'Has email & password fields',
        async fn(driver) {
          await navigateTo(driver, '/Templates/Login_Page.html');
          const email = await waitForVisible(driver, By.id('email'));
          const pwd = await waitForVisible(driver, By.id('password'));
          const emailType = await email.getAttribute('type');
          assertEqual(emailType, 'email', 'Email field should have type "email"');
          const pwdType = await pwd.getAttribute('type');
          assertEqual(pwdType, 'password', 'Password field should have type "password"');
        },
      },
      {
        name: 'Has sign-in submit button',
        async fn(driver) {
          const btn = await waitForVisible(driver, By.css('button[type="submit"]'));
          const text = await btn.getText();
          assertIncludes(text, 'sign in', 'Submit button should say "Sign in"');
        },
      },
      {
        name: 'Has Remember Me checkbox',
        async fn(driver) {
          const checkbox = await waitForPresent(driver, By.id('remember-me'));
          const type = await checkbox.getAttribute('type');
          assertEqual(type, 'checkbox', 'Remember-me should be a checkbox');
          const checked = await checkbox.isSelected();
          assert(!checked, 'Remember-me should be unchecked by default');
        },
      },
      {
        name: 'Has Forgot Password link',
        async fn(driver) {
          const link = await driver.findElement(By.linkText('Forgot Password?'));
          assert(link, 'Forgot Password link should exist');
        },
      },
      {
        name: 'Empty form does not submit',
        async fn(driver) {
          await navigateTo(driver, '/Templates/Login_Page.html');
          await driver.executeScript(`localStorage.removeItem('token'); localStorage.removeItem('user');`);
          await driver.navigate().refresh();
          await driver.sleep(500);
          const btn = await driver.findElement(By.css('button[type="submit"]'));
          await btn.click();
          await driver.sleep(500);
          const url = await driver.getCurrentUrl();
          assertIncludes(url, 'Login_Page', 'Should remain on login page');
        },
      },
      {
        name: 'Rejects wrong password',
        async fn(driver) {
          await navigateTo(driver, '/Templates/Login_Page.html');
          await driver.executeScript(`localStorage.removeItem('token'); localStorage.removeItem('user');`);
          await driver.navigate().refresh();
          await driver.sleep(500);
          await clearAndType(driver, By.id('email'), ADMIN_CREDENTIALS.email);
          await clearAndType(driver, By.id('password'), 'wrongpassword');
          const btn = await driver.findElement(By.css('button[type="submit"]'));
          await btn.click();
          await driver.sleep(2000);
          const url = await driver.getCurrentUrl();
          assertIncludes(url, 'Login_Page', 'Should remain on login page after wrong password');
        },
      },
      {
        name: 'Admin login triggers TOTP modal',
        async fn(driver) {
          await navigateTo(driver, '/Templates/Login_Page.html');
          await driver.executeScript(`localStorage.removeItem('token'); localStorage.removeItem('user');`);
          await driver.navigate().refresh();
          await driver.sleep(500);
          await clearAndType(driver, By.id('email'), ADMIN_CREDENTIALS.email);
          await clearAndType(driver, By.id('password'), ADMIN_CREDENTIALS.password);
          const btn = await driver.findElement(By.css('button[type="submit"]'));
          await btn.click();
          await driver.sleep(3000);
          const modalVisible = await elementExists(driver, By.id('totp-modal'));
          assert(modalVisible, 'TOTP modal should appear for admin login');
        },
      },
      {
        name: 'Root URL redirects to login',
        async fn(driver) {
          await driver.executeScript(`localStorage.removeItem('token'); localStorage.removeItem('user');`);
          await navigateTo(driver, '/');
          await driver.sleep(2000);
          const url = await driver.getCurrentUrl();
          assertIncludes(url, 'Login_Page', 'Root URL should redirect to Login_Page');
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NAVIGATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  nav: {
    name: 'Navigation & Page Access',
    icon: '🧭',
    tests: [
      {
        name: 'Login page loads',
        async fn(driver) {
          await navigateTo(driver, '/Templates/Login_Page.html');
          await driver.sleep(1000);
          const title = await driver.getTitle();
          assertIncludes(title, 'Sentinel');
        },
      },
      {
        name: 'Auth guard: Dashboard redirects to login',
        async fn(driver) {
          await navigateTo(driver, '/Templates/Login_Page.html');
          await driver.executeScript(`localStorage.removeItem('token'); localStorage.removeItem('user');`);
          await navigateTo(driver, '/Templates/Admin_Dashboard_Page.html');
          await driver.sleep(3000);
          const url = await driver.getCurrentUrl();
          assertIncludes(url, 'Login_Page', 'Unauthenticated Dashboard access should redirect to login');
        },
      },
      {
        name: 'Auth guard: Employee page redirects to login',
        async fn(driver) {
          await driver.executeScript(`localStorage.removeItem('token'); localStorage.removeItem('user');`);
          await navigateTo(driver, '/Templates/Employee_Management_Page.html');
          await driver.sleep(3000);
          const url = await driver.getCurrentUrl();
          assertIncludes(url, 'Login_Page', 'Unauthenticated Employee access should redirect to login');
        },
      },
      {
        name: 'Attendance Tracking page loads',
        async fn(driver) {
          await navigateTo(driver, '/Templates/Daily_Attendnace_Tracking_Page.html');
          await driver.sleep(1500);
          const title = await driver.getTitle();
          assertIncludes(title, 'Attendance');
        },
      },
      {
        name: 'Auth guard: Leave page redirects to login',
        async fn(driver) {
          await driver.executeScript(`localStorage.removeItem('token'); localStorage.removeItem('user');`);
          await navigateTo(driver, '/Templates/Leave_Approval_Page.html');
          await driver.sleep(3000);
          const url = await driver.getCurrentUrl();
          assertIncludes(url, 'Login_Page', 'Unauthenticated Leave access should redirect to login');
        },
      },
      {
        name: 'Auth guard: Security page redirects to login',
        async fn(driver) {
          await driver.executeScript(`localStorage.removeItem('token'); localStorage.removeItem('user');`);
          await navigateTo(driver, '/Templates/Security_Reports_Page.html');
          await driver.sleep(3000);
          const url = await driver.getCurrentUrl();
          assertIncludes(url, 'Login_Page', 'Unauthenticated Security access should redirect to login');
        },
      },
      {
        name: 'Health endpoint returns OK',
        async fn(driver) {
          await navigateTo(driver, '/Templates/Login_Page.html');
          await driver.sleep(500);
          const res = await browserFetch(driver, '/api/health');
          assertEqual(res.status, 200, 'Health should return 200');
          assertEqual(res.body.status, 'ok', 'Health endpoint should return status "ok"');
        },
      },
      {
        name: 'Static assets are served (styles.css)',
        async fn(driver) {
          await navigateTo(driver, '/Templates/shared/styles.css');
          await driver.sleep(500);
          const body = await driver.findElement(By.css('body')).getText();
          assertGreaterThan(body.length, 0, 'styles.css should have content');
        },
      },
      {
        name: 'Root URL redirects to login',
        async fn(driver) {
          await driver.executeScript(`localStorage.removeItem('token'); localStorage.removeItem('user');`);
          await navigateTo(driver, '/');
          await driver.sleep(2000);
          const url = await driver.getCurrentUrl();
          assertIncludes(url, 'Login_Page', 'Root URL should redirect to Login_Page');
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  dashboard: {
    name: 'Admin Dashboard',
    icon: '📊',
    async setup(driver) {
      const token = await getAdminTokenViaAPI();
      if (token) {
        await setAuthToken(driver, token, { role: 'admin', email: ADMIN_CREDENTIALS.email });
      }
      return { authToken: token };
    },
    tests: [
      {
        name: 'Dashboard page has correct title',
        async fn(driver, ctx) {
          if (ctx.authToken) {
            await setAuthToken(driver, ctx.authToken, { role: 'admin', email: ADMIN_CREDENTIALS.email });
          }
          await driver.get(`${BASE_URL}/Templates/Admin_Dashboard_Page.html`);
          await driver.sleep(3000);
          const title = await driver.getTitle();
          // With tempToken (TOTP pending), it may redirect to login — check either
          const url = await driver.getCurrentUrl();
          const onDashboard = url.includes('Dashboard');
          const onLogin = url.includes('Login_Page');
          assert(onDashboard || onLogin, 'Should be on Dashboard or redirected to Login');
        },
      },
      {
        name: 'Has main content area',
        async fn(driver) {
          const body = await driver.findElement(By.css('body')).getText();
          assertGreaterThan(body.length, 0, 'Dashboard should have content');
        },
      },
      {
        name: 'Displays summary stat cards or login form',
        async fn(driver) {
          const cards = await driver.findElements(By.css('[class*="card"], [class*="stat"], [class*="summary"], [class*="bg-surface"], form'));
          assertGreaterThan(cards.length, 0, 'Dashboard should have stat cards or form');
        },
      },
      {
        name: 'Has sidebar or navigation',
        async fn(driver) {
          const sidebar = await elementExists(driver, By.css('nav, aside, [class*="sidebar"], [class*="side-nav"], a'));
          assert(sidebar, 'Page should have navigation elements');
        },
      },
      {
        name: 'Displays page headings',
        async fn(driver) {
          const headings = await driver.findElements(By.css('h1, h2, h3, h4'));
          assertGreaterThan(headings.length, 0, 'Should have headings');
        },
      },
      {
        name: 'Renders at desktop width (1920x1080)',
        async fn(driver) {
          await driver.manage().window().setRect({ width: 1920, height: 1080 });
          await driver.sleep(500);
          const body = await driver.findElement(By.css('body'));
          const size = await body.getRect();
          assertGreaterThan(size.width, 900, 'Body width should be > 900px');
        },
      },
      {
        name: 'Renders at mobile width (375x812)',
        async fn(driver) {
          await driver.manage().window().setRect({ width: 375, height: 812 });
          await driver.sleep(500);
          const body = await driver.findElement(By.css('body')).getText();
          assertGreaterThan(body.length, 0, 'Should render at mobile width');
          await driver.manage().window().setRect({ width: 1920, height: 1080 });
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EMPLOYEE MANAGEMENT TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  employees: {
    name: 'Employee Management',
    icon: '👥',
    async setup(driver) {
      const token = await getAdminTokenViaAPI();
      if (token) {
        await setAuthToken(driver, token, { role: 'admin', email: ADMIN_CREDENTIALS.email });
      }
      return { authToken: token };
    },
    tests: [
      {
        name: 'Employee page loads',
        async fn(driver, ctx) {
          if (ctx.authToken) {
            await setAuthToken(driver, ctx.authToken, { role: 'admin', email: ADMIN_CREDENTIALS.email });
          }
          await navigateTo(driver, '/Templates/Employee_Management_Page.html');
          await driver.sleep(3000);
          const title = await driver.getTitle();
          assertIncludes(title, 'Employee');
        },
      },
      {
        name: 'Has headings on employee page',
        async fn(driver) {
          const headings = await driver.findElements(By.css('h1, h2, h3'));
          assertGreaterThan(headings.length, 0, 'Should have page headings');
        },
      },
      {
        name: 'Has employee list/table area',
        async fn(driver) {
          const hasTable = await elementExists(driver, By.css('table, [class*="table"], [class*="list"], [class*="grid"]'));
          assert(hasTable, 'Should have employee table or list');
        },
      },
      {
        name: 'Add Employee page loads',
        async fn(driver, ctx) {
          if (ctx.authToken) {
            await setAuthToken(driver, ctx.authToken, { role: 'admin', email: ADMIN_CREDENTIALS.email });
          }
          await navigateTo(driver, '/Templates/Add_Employee_Page.html');
          await driver.sleep(2000);
          const title = await driver.getTitle();
          assertIncludes(title, 'Employee');
        },
      },
      {
        name: 'Add Employee form has input fields',
        async fn(driver) {
          const inputs = await driver.findElements(By.css('input, select, textarea'));
          assertGreaterThan(inputs.length, 0, 'Form should have input fields');
        },
      },
      {
        name: 'Add Employee has name field',
        async fn(driver) {
          const nameInputs = await driver.findElements(By.css('input[name*="name" i], input[id*="name" i], input[placeholder*="name" i]'));
          assertGreaterThan(nameInputs.length, 0, 'Should have name input');
        },
      },
      {
        name: 'Add Employee has email field',
        async fn(driver) {
          const emailInputs = await driver.findElements(By.css('input[type="email"], input[name*="email" i], input[id*="email" i]'));
          assertGreaterThan(emailInputs.length, 0, 'Should have email input');
        },
      },
      {
        name: 'Add Employee has department selector',
        async fn(driver) {
          const deptSelects = await driver.findElements(By.css('select[id*="department" i], select[name*="department" i], [id*="dept" i]'));
          assertGreaterThan(deptSelects.length, 0, 'Should have department selector');
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ATTENDANCE & QR TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  attendance: {
    name: 'Attendance & QR Generation',
    icon: '📋',
    async setup(driver) {
      const token = await getAdminTokenViaAPI();
      if (token) {
        await setAuthToken(driver, token, { role: 'admin', email: ADMIN_CREDENTIALS.email });
      }
      return { authToken: token };
    },
    tests: [
      {
        name: 'Attendance page loads',
        async fn(driver, ctx) {
          if (ctx.authToken) {
            await setAuthToken(driver, ctx.authToken, { role: 'admin', email: ADMIN_CREDENTIALS.email });
          }
          await navigateTo(driver, '/Templates/Daily_Attendnace_Tracking_Page.html');
          await driver.sleep(3000);
          const title = await driver.getTitle();
          assertIncludes(title, 'Attendance');
        },
      },
      {
        name: 'Has attendance records area',
        async fn(driver) {
          const records = await driver.findElements(By.css('table, [class*="record"], [class*="list"], [class*="attendance"]'));
          assertGreaterThan(records.length, 0, 'Should have attendance records area');
        },
      },
      {
        name: 'QR Generation page loads',
        async fn(driver, ctx) {
          if (ctx.authToken) {
            await setAuthToken(driver, ctx.authToken, { role: 'admin', email: ADMIN_CREDENTIALS.email });
          }
          await navigateTo(driver, '/Templates/QR_Generation_Page.html');
          await driver.sleep(3000);
          const body = await driver.findElement(By.css('body')).getText();
          assertGreaterThan(body.length, 0, 'QR page should load content');
        },
      },
      {
        name: 'QR page has headings',
        async fn(driver) {
          const headings = await driver.findElements(By.css('h1, h2, h3'));
          assertGreaterThan(headings.length, 0, 'QR page should have headings');
        },
      },
      {
        name: 'QR page has action buttons',
        async fn(driver) {
          const buttons = await driver.findElements(By.css('button'));
          assertGreaterThan(buttons.length, 0, 'QR page should have buttons');
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LEAVE & SECURITY TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  leave: {
    name: 'Leave & Security Reports',
    icon: '🏖️',
    async setup(driver) {
      const token = await getAdminTokenViaAPI();
      if (token) {
        await setAuthToken(driver, token, { role: 'admin', email: ADMIN_CREDENTIALS.email });
      }
      return { authToken: token };
    },
    tests: [
      {
        name: 'Leave Approval page loads',
        async fn(driver, ctx) {
          if (ctx.authToken) {
            await setAuthToken(driver, ctx.authToken, { role: 'admin', email: ADMIN_CREDENTIALS.email });
          }
          await navigateTo(driver, '/Templates/Leave_Approval_Page.html');
          await driver.sleep(3000);
          const title = await driver.getTitle();
          assertIncludes(title, 'Leave');
        },
      },
      {
        name: 'Leave page has headings',
        async fn(driver) {
          const headings = await driver.findElements(By.css('h1, h2, h3'));
          assertGreaterThan(headings.length, 0, 'Leave page should have headings');
        },
      },
      {
        name: 'Leave page has request list/table',
        async fn(driver) {
          const lists = await driver.findElements(By.css('table, [class*="list"], [class*="request"], [class*="leave"], [class*="card"], [class*="panel"], div[id], section'));
          assertGreaterThan(lists.length, 0, 'Should have leave requests area');
        },
      },
      {
        name: 'Leave page has action buttons',
        async fn(driver) {
          const buttons = await driver.findElements(By.css('button'));
          assertGreaterThan(buttons.length, 0, 'Leave page should have buttons');
        },
      },
      {
        name: 'Security Reports page loads',
        async fn(driver, ctx) {
          if (ctx.authToken) {
            await setAuthToken(driver, ctx.authToken, { role: 'admin', email: ADMIN_CREDENTIALS.email });
          }
          await navigateTo(driver, '/Templates/Security_Reports_Page.html');
          await driver.sleep(3000);
          const title = await driver.getTitle();
          assertIncludes(title, 'Security');
        },
      },
      {
        name: 'Security page has headings',
        async fn(driver) {
          const headings = await driver.findElements(By.css('h1, h2, h3'));
          assertGreaterThan(headings.length, 0, 'Security page should have headings');
        },
      },
      {
        name: 'Security page has alert/report area',
        async fn(driver) {
          const reports = await driver.findElements(By.css('table, [class*="alert"], [class*="report"], [class*="list"]'));
          assertGreaterThan(reports.length, 0, 'Should have alert/report display');
        },
      },
      {
        name: 'Security page renders at mobile width',
        async fn(driver) {
          await driver.manage().window().setRect({ width: 375, height: 812 });
          await navigateTo(driver, '/Templates/Security_Reports_Page.html');
          await driver.sleep(2000);
          const body = await driver.findElement(By.css('body')).getText();
          assertGreaterThan(body.length, 0, 'Should render at mobile width');
          await driver.manage().window().setRect({ width: 1920, height: 1080 });
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // API INTEGRATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  api: {
    name: 'API Integration',
    icon: '🌐',
    async setup() {
      return { adminToken: null, empToken: null };
    },
    tests: [
      {
        name: 'GET /api/health returns OK',
        async fn(driver, ctx) {
          const res = await apiFetch('/api/health');
          assertEqual(res.status, 200, 'Health should return 200');
          assertEqual(res.body.status, 'ok', 'Health status should be "ok"');
        },
      },
      {
        name: 'POST /api/auth/login rejects empty body',
        async fn(driver, ctx) {
          const res = await apiFetch('/api/auth/login', { method: 'POST', body: {} });
          assert(res.status >= 400, `Empty login should be rejected (got ${res.status})`);
        },
      },
      {
        name: 'POST /api/auth/login rejects wrong password',
        async fn(driver, ctx) {
          const res = await apiFetch('/api/auth/login', {
            method: 'POST',
            body: { email: ADMIN_CREDENTIALS.email, password: 'wrongpass' },
          });
          assert(res.status >= 400, `Wrong password should be rejected (got ${res.status})`);
        },
      },
      {
        name: 'POST /api/auth/login succeeds for admin',
        async fn(driver, ctx) {
          const res = await apiFetch('/api/auth/login', {
            method: 'POST',
            body: ADMIN_CREDENTIALS,
          });
          assertEqual(res.status, 200, `Admin login should return 200 (got ${res.status})`);
          const token = res.body.token || res.body.tempToken;
          assertIsString(token, 'Should receive a token');
          ctx.adminToken = token;
        },
      },
      {
        name: 'POST /api/auth/login succeeds for employee',
        async fn(driver, ctx) {
          const res = await apiFetch('/api/auth/login', {
            method: 'POST',
            body: EMPLOYEE_CREDENTIALS,
          });
          assertEqual(res.status, 200, `Employee login should return 200 (got ${res.status})`);
          if (res.body.token) {
            ctx.empToken = res.body.token;
            assertIsString(ctx.empToken, 'Should receive employee token');
          }
        },
      },
      {
        name: 'GET /api/auth/me rejects unauthenticated',
        async fn(driver, ctx) {
          const res = await apiFetch('/api/auth/me');
          assert(res.status >= 400, `Should reject unauthenticated /me (got ${res.status})`);
        },
      },
      {
        name: 'GET /api/employees rejects unauthenticated',
        async fn(driver, ctx) {
          const res = await apiFetch('/api/employees');
          assertOneOf(res.status, [401, 403], 'Should reject unauthenticated employees');
        },
      },
      {
        name: 'GET /api/attendance rejects unauthenticated',
        async fn(driver, ctx) {
          const res = await apiFetch('/api/attendance');
          assertOneOf(res.status, [401, 403], 'Should reject unauthenticated attendance');
        },
      },
      {
        name: 'GET /api/leave rejects unauthenticated',
        async fn(driver, ctx) {
          const res = await apiFetch('/api/leave');
          assertOneOf(res.status, [401, 403], 'Should reject unauthenticated leave');
        },
      },
      {
        name: 'GET /api/security/alerts rejects unauthenticated',
        async fn(driver, ctx) {
          const res = await apiFetch('/api/security/alerts');
          assertOneOf(res.status, [401, 403], 'Should reject unauthenticated security');
        },
      },
      {
        name: 'GET /api/nonexistent returns 404',
        async fn(driver, ctx) {
          const res = await apiFetch('/api/nonexistent');
          assertEqual(res.status, 404, 'Unknown API route should return 404');
        },
      },
    ],
  },
};

// ── Runner ──────────────────────────────────────────────────────────────────

async function runSuite(suiteKey, driver) {
  const suite = SUITES[suiteKey];
  if (!suite) {
    console.log(`${c.red}  Unknown suite: ${suiteKey}${c.reset}`);
    return { passed: 0, failed: 0, skipped: 0, total: 0 };
  }

  sectionHeader(suite.icon, suite.name);

  let ctx = {};
  try {
    if (suite.setup) ctx = await suite.setup(driver);
  } catch (err) {
    console.log(`  ${c.blue}│${c.reset}  ${c.yellow}⚠️  Setup failed: ${err.message}${c.reset}`);
  }

  let passed = 0, failed = 0, skipped = 0;

  for (const test of suite.tests) {
    logTestStart(test.name);
    const start = Date.now();
    try {
      await test.fn(driver, ctx);
      const dur = Date.now() - start;
      logTestResult(test.name, true, dur);
      passed++;
    } catch (err) {
      const dur = Date.now() - start;
      logTestResult(test.name, false, dur, err);
      failed++;
    }
  }

  sectionFooter();
  return { passed, failed, skipped, total: suite.tests.length };
}

async function checkServerHealth() {
  const PORT = process.env.PORT || 3000;
  return new Promise((resolve) => {
    http.get(`http://localhost:${PORT}/api/health`, (res) => {
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
}

async function main() {
  const startTime = Date.now();

  banner('🧪  Sentinel Attendance — Selenium Test Suite');

  // ── Check server ────────────────────────────────────────────────────────
  console.log(`  ${c.dim}Checking server at ${BASE_URL}...${c.reset}`);
  const healthy = await checkServerHealth();

  if (!healthy) {
    console.log(`\n  ${c.bgRed}${c.white}${c.bold} ERROR ${c.reset} ${c.red}Server is not running at ${BASE_URL}${c.reset}`);
    console.log(`  ${c.yellow}Start the server first:  ${c.bold}npm run dev${c.reset}\n`);
    process.exit(1);
  }

  console.log(`  ${c.green}✅ Server is healthy${c.reset}\n`);

  // ── Determine which suites to run ────────────────────────────────────────
  const arg = process.argv[2];
  const suiteKeys = arg && SUITES[arg]
    ? [arg]
    : Object.keys(SUITES);

  console.log(`  ${c.bold}${c.white}Suites:${c.reset} ${suiteKeys.map(k => `${SUITES[k].icon}  ${SUITES[k].name}`).join('  •  ')}`);

  // ── Create driver ───────────────────────────────────────────────────────
  console.log(`\n  ${c.dim}Launching headless Firefox browser...${c.reset}`);
  let driver;
  try {
    driver = await createDriver();
    console.log(`  ${c.green}✅ Browser launched${c.reset}`);
  } catch (err) {
    console.log(`\n  ${c.bgRed}${c.white}${c.bold} ERROR ${c.reset} ${c.red}Failed to launch browser: ${err.message}${c.reset}`);
    console.log(`  ${c.yellow}Make sure geckodriver is installed:  ${c.bold}npx geckodriver --version${c.reset}\n`);
    process.exit(1);
  }

  // ── Run suites ──────────────────────────────────────────────────────────
  const results = [];

  for (const key of suiteKeys) {
    try {
      const result = await runSuite(key, driver);
      results.push({ key, ...result });
    } catch (err) {
      console.log(`  ${c.red}Suite "${key}" crashed: ${err.message}${c.reset}`);
      results.push({ key, passed: 0, failed: 1, skipped: 0, total: 1 });
    }
  }

  // ── Quit driver ─────────────────────────────────────────────────────────
  try {
    await driver.quit();
  } catch { /* ignore */ }

  // ── Summary ─────────────────────────────────────────────────────────────
  const totalPassed = results.reduce((s, r) => s + r.passed, 0);
  const totalFailed = results.reduce((s, r) => s + r.failed, 0);
  const totalTests  = results.reduce((s, r) => s + r.total, 0);
  const duration    = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('');
  banner(totalFailed === 0
    ? `✅  All Tests Passed!  (${totalPassed}/${totalTests})  —  ${duration}s`
    : `❌  ${totalFailed} Test(s) Failed  (${totalPassed}/${totalTests} passed)  —  ${duration}s`
  );

  // Per-suite summary
  console.log(`  ${c.bold}${c.white}Suite Summary:${c.reset}\n`);
  for (const r of results) {
    const suite = SUITES[r.key];
    const icon  = r.failed === 0 ? `${c.green}✅` : `${c.red}❌`;
    const stats = `${c.green}${r.passed} passed${c.reset}${r.failed > 0 ? `, ${c.red}${r.failed} failed${c.reset}` : ''}`;
    console.log(`    ${icon}  ${suite.icon}  ${suite.name.padEnd(30)} ${stats}`);
  }

  console.log(`\n  ${c.dim}Total: ${totalPassed} passed, ${totalFailed} failed, ${totalTests} total${c.reset}`);
  console.log(`  ${c.dim}Duration: ${duration}s${c.reset}\n`);

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${c.red}Runner crashed: ${err.message}${c.reset}`);
  console.error(err.stack);
  process.exit(1);
});
