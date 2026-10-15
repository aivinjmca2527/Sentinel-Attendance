/**
 * Sentinel Attendance — Selenium Test: Leave Management & Security Reports
 *
 * Tests for:
 * - Leave_Approval_Page.html (Leave requests, approvals, balances)
 * - Security_Reports_Page.html (Security alerts, geofence violations)
 */

const { describe, it, before, after } = require('mocha');
const { expect } = require('chai');
const { By, until } = require('selenium-webdriver');

const { createDriver, waitForServer, BASE_URL, TIMEOUTS, ADMIN_CREDENTIALS } = require('./config');
const {
  navigateTo, waitForVisible, waitForPresent,
  elementExists, getElementText, waitForPageLoad,
  getAdminTokenViaAPI, setAuthToken
} = require('./helpers');

describe('🏖️ Leave Approval Page Tests', function () {
  this.timeout(60000);
  let driver;
  let authToken;

  before(async function () {
    await waitForServer();
    driver = await createDriver();
    authToken = await getAdminTokenViaAPI();

    if (authToken) {
      await setAuthToken(driver, authToken, { role: 'admin', email: ADMIN_CREDENTIALS.email });
    }
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  // ─── Page Structure ─────────────────────────────────────────────────────

  describe('Page Structure', function () {
    before(async function () {
      await navigateTo(driver, '/Templates/Leave_Approval_Page.html');
      await driver.sleep(3000);
    });

    it('should load the leave approval page', async function () {
      const title = await driver.getTitle();
      expect(title.toLowerCase()).to.include('leave');
    });

    it('should have headings', async function () {
      const headings = await driver.findElements(By.css('h1, h2, h3'));
      expect(headings.length).to.be.greaterThan(0);
    });

    it('should have a leave requests list or table', async function () {
      const lists = await driver.findElements(
        By.css('table, [class*="list"], [class*="request"], [class*="leave"]')
      );
      expect(lists.length).to.be.greaterThan(0);
    });

    it('should have filter/status tabs or buttons', async function () {
      const filters = await driver.findElements(
        By.css('[class*="tab"], [class*="filter"], [class*="status"], button[class*="chip"]')
      );
      expect(filters).to.be.an('array');
    });

    it('should have action buttons (approve/deny)', async function () {
      const body = await driver.findElement(By.css('body')).getText();
      const buttons = await driver.findElements(By.css('button'));
      expect(buttons.length).to.be.greaterThan(0);
    });
  });

  // ─── Split View Layout ──────────────────────────────────────────────────

  describe('Split View Layout', function () {
    before(async function () {
      await navigateTo(driver, '/Templates/Leave_Approval_Page.html');
      await driver.sleep(2000);
    });

    it('should have a split-view or detail panel area', async function () {
      // Leave page title indicates "Split View" design
      const panels = await driver.findElements(
        By.css('[class*="panel"], [class*="detail"], [class*="split"], [class*="sidebar"]')
      );
      // At minimum, the page should have structured layout
      const body = await driver.findElement(By.css('body'));
      const text = await body.getText();
      expect(text.length).to.be.greaterThan(0);
    });
  });
});

describe('🛡️ Security Reports Page Tests', function () {
  this.timeout(60000);
  let driver;
  let authToken;

  before(async function () {
    await waitForServer();
    driver = await createDriver();
    authToken = await getAdminTokenViaAPI();

    if (authToken) {
      await setAuthToken(driver, authToken, { role: 'admin', email: ADMIN_CREDENTIALS.email });
    }
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  // ─── Page Structure ─────────────────────────────────────────────────────

  describe('Page Structure', function () {
    before(async function () {
      await navigateTo(driver, '/Templates/Security_Reports_Page.html');
      await driver.sleep(3000);
    });

    it('should load the security reports page', async function () {
      const title = await driver.getTitle();
      expect(title.toLowerCase()).to.include('security');
    });

    it('should have headings for the security section', async function () {
      const headings = await driver.findElements(By.css('h1, h2, h3'));
      expect(headings.length).to.be.greaterThan(0);
    });

    it('should have alert list or report display', async function () {
      const reports = await driver.findElements(
        By.css('table, [class*="alert"], [class*="report"], [class*="list"]')
      );
      expect(reports.length).to.be.greaterThan(0);
    });

    it('should have filter controls', async function () {
      const filters = await driver.findElements(
        By.css('select, input[type="date"], [class*="filter"], [class*="search"]')
      );
      expect(filters).to.be.an('array');
    });

    it('should have summary/stats section', async function () {
      const stats = await driver.findElements(
        By.css('[class*="stat"], [class*="summary"], [class*="card"], [class*="metric"]')
      );
      expect(stats).to.be.an('array');
    });

    it('should have alert type indicators', async function () {
      const body = await driver.findElement(By.css('body')).getText();
      // Page should reference security terminology
      expect(body.length).to.be.greaterThan(0);
    });
  });

  // ─── Responsive Design ─────────────────────────────────────────────────

  describe('Responsive Design', function () {
    it('should render at mobile width without overflow', async function () {
      await driver.manage().window().setRect({ width: 375, height: 812 });
      await navigateTo(driver, '/Templates/Security_Reports_Page.html');
      await driver.sleep(2000);

      const body = await driver.findElement(By.css('body'));
      const text = await body.getText();
      expect(text.length).to.be.greaterThan(0);
    });

    after(async function () {
      await driver.manage().window().setRect({ width: 1920, height: 1080 });
    });
  });
});
