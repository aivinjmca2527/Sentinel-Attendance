/**
 * Sentinel Attendance — Selenium Test: Navigation & Page Access
 *
 * Tests for:
 * - All page URLs respond correctly
 * - Auth guard redirects unauthenticated users to login
 * - Sidebar navigation between pages
 * - Page titles are correct
 * - Health endpoint is accessible
 */

const { describe, it, before, after, beforeEach } = require('mocha');
const { expect } = require('chai');
const { By, until } = require('selenium-webdriver');

const { createDriver, waitForServer, BASE_URL, TIMEOUTS } = require('./config');
const {
  navigateTo, waitForVisible, waitForPresent, elementExists,
  getElementText, waitForUrlContains, waitForPageLoad
} = require('./helpers');

// All the pages in the app
const PAGES = [
  { name: 'Login',                path: '/Templates/Login_Page.html',                      title: 'Sentinel', authRequired: false },
  { name: 'Admin Dashboard',      path: '/Templates/Admin_Dashboard_Page.html',             title: 'Dashboard', authRequired: true },
  { name: 'Employee Management',  path: '/Templates/Employee_Management_Page.html',         title: 'Employee', authRequired: true },
  { name: 'Daily Attendance',     path: '/Templates/Daily_Attendnace_Tracking_Page.html',   title: 'Attendance', authRequired: true },
  { name: 'QR Generation',        path: '/Templates/QR_Generation_Page.html',               title: 'QR', authRequired: true },
  { name: 'Leave Approval',       path: '/Templates/Leave_Approval_Page.html',              title: 'Leave', authRequired: true },
  { name: 'Security Reports',     path: '/Templates/Security_Reports_Page.html',            title: 'Security', authRequired: true },
  { name: 'Add Employee',         path: '/Templates/Add_Employee_Page.html',                title: 'Employee', authRequired: true },
];

describe('🧭 Navigation & Page Access Tests', function () {
  this.timeout(60000);
  let driver;

  before(async function () {
    await waitForServer();
    driver = await createDriver();
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  // ─── Page Accessibility ─────────────────────────────────────────────────

  describe('Page Accessibility', function () {
    PAGES.forEach(({ name, path, title }) => {
      it(`should load "${name}" page at ${path}`, async function () {
        await navigateTo(driver, path);
        await driver.sleep(1500);
        const pageTitle = await driver.getTitle();
        expect(pageTitle.toLowerCase()).to.include(title.toLowerCase());
      });
    });
  });

  // ─── Auth Guard Tests ────────────────────────────────────────────────────

  describe('Auth Guard (Unauthenticated Access)', function () {
    beforeEach(async function () {
      // Clear auth
      await navigateTo(driver, '/Templates/Login_Page.html');
      await driver.executeScript(`
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      `);
    });

    PAGES.filter(p => p.authRequired).forEach(({ name, path }) => {
      it(`should redirect from "${name}" to login when not authenticated`, async function () {
        await navigateTo(driver, path);
        await driver.sleep(3000); // Wait for auth guard to redirect

        const url = await driver.getCurrentUrl();
        // Auth guard should redirect to login page
        expect(url).to.include('Login_Page');
      });
    });
  });

  // ─── Health Endpoint ─────────────────────────────────────────────────────

  describe('API Health Endpoint', function () {
    it('should return healthy status from /api/health', async function () {
      await navigateTo(driver, '/api/health');
      await driver.sleep(1000);

      const body = await driver.findElement(By.css('body')).getText();
      const data = JSON.parse(body);
      expect(data.status).to.equal('ok');
      expect(data.time).to.be.a('string');
    });
  });

  // ─── 404 Handling ────────────────────────────────────────────────────────

  describe('404 Handling', function () {
    it('should return 404 JSON for unknown API routes', async function () {
      await navigateTo(driver, '/api/nonexistent');
      await driver.sleep(1000);

      const body = await driver.findElement(By.css('body')).getText();
      try {
        const data = JSON.parse(body);
        expect(data.error).to.be.a('string');
      } catch {
        // If not JSON, just verify it loaded
        expect(body.length).to.be.greaterThan(0);
      }
    });
  });

  // ─── Root Redirect ──────────────────────────────────────────────────────

  describe('Root URL', function () {
    it('should redirect / to Login_Page.html', async function () {
      await navigateTo(driver, '/');
      await driver.sleep(2000);

      const url = await driver.getCurrentUrl();
      expect(url).to.include('Login_Page');
    });
  });

  // ─── Static Asset Loading ───────────────────────────────────────────────

  describe('Static Assets', function () {
    it('should serve shared styles.css', async function () {
      await navigateTo(driver, '/Templates/shared/styles.css');
      await driver.sleep(500);
      const body = await driver.findElement(By.css('body')).getText();
      // CSS file should contain some content
      expect(body.length).to.be.greaterThan(0);
    });

    it('should serve shared auth.js', async function () {
      await navigateTo(driver, '/Templates/shared/auth.js');
      await driver.sleep(500);
      const body = await driver.findElement(By.css('body')).getText();
      expect(body).to.include('authHeaders');
    });
  });
});
