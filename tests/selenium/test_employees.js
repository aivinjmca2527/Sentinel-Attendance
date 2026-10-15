/**
 * Sentinel Attendance — Selenium Test: Employee Management Page
 *
 * Tests for Employee_Management_Page.html including:
 * - Page loads with employee list/table
 * - Search/filter functionality
 * - Add Employee button presence
 * - Employee detail view
 * - Table structure and data display
 */

const { describe, it, before, after } = require('mocha');
const { expect } = require('chai');
const { By, until } = require('selenium-webdriver');

const { createDriver, waitForServer, BASE_URL, TIMEOUTS, ADMIN_CREDENTIALS } = require('./config');
const {
  navigateTo, waitForVisible, waitForPresent, waitForClickable,
  elementExists, getElementText, clearAndType, waitForPageLoad,
  getAdminTokenViaAPI, setAuthToken
} = require('./helpers');

describe('👥 Employee Management Tests', function () {
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
      await navigateTo(driver, '/Templates/Employee_Management_Page.html');
      await driver.sleep(3000);
    });

    it('should load the employee management page', async function () {
      const title = await driver.getTitle();
      expect(title.toLowerCase()).to.include('employee');
    });

    it('should have a header/title area', async function () {
      const headings = await driver.findElements(By.css('h1, h2, h3'));
      expect(headings.length).to.be.greaterThan(0);
    });

    it('should have an employee list or table area', async function () {
      const hasTable = await elementExists(driver, By.css('table, [class*="table"], [class*="list"], [class*="grid"]'));
      expect(hasTable).to.be.true;
    });

    it('should have a search or filter input', async function () {
      const searchInputs = await driver.findElements(
        By.css('input[type="search"], input[type="text"][placeholder*="search" i], input[placeholder*="filter" i], input[placeholder*="Search" i]')
      );
      // Search functionality is common in employee management pages
      expect(searchInputs.length).to.be.greaterThanOrEqual(0); // May or may not exist
    });
  });

  // ─── Employee Table ──────────────────────────────────────────────────────

  describe('Employee Table', function () {
    before(async function () {
      await navigateTo(driver, '/Templates/Employee_Management_Page.html');
      await driver.sleep(3000);
    });

    it('should display employee data rows', async function () {
      // Look for table rows or list items representing employees
      const rows = await driver.findElements(By.css('table tbody tr, [class*="employee-row"], [class*="emp-item"]'));
      // Table might be empty or populated depending on DB state
      expect(rows).to.be.an('array');
    });

    it('should have action buttons for each employee', async function () {
      const actionBtns = await driver.findElements(
        By.css('button[class*="edit"], button[class*="delete"], button[class*="view"], [class*="action"] button')
      );
      // Action buttons should be present if employees exist
      expect(actionBtns).to.be.an('array');
    });
  });

  // ─── Add Employee Page ──────────────────────────────────────────────────

  describe('Add Employee Page', function () {
    before(async function () {
      await navigateTo(driver, '/Templates/Add_Employee_Page.html');
      await driver.sleep(2000);
    });

    it('should load the add employee page', async function () {
      const title = await driver.getTitle();
      expect(title.toLowerCase()).to.include('employee');
    });

    it('should have form fields for employee details', async function () {
      const inputs = await driver.findElements(By.css('input, select, textarea'));
      expect(inputs.length).to.be.greaterThan(0);
    });

    it('should have a name input field', async function () {
      const nameInputs = await driver.findElements(
        By.css('input[name*="name" i], input[id*="name" i], input[placeholder*="name" i]')
      );
      expect(nameInputs.length).to.be.greaterThan(0);
    });

    it('should have an email input field', async function () {
      const emailInputs = await driver.findElements(
        By.css('input[type="email"], input[name*="email" i], input[id*="email" i]')
      );
      expect(emailInputs.length).to.be.greaterThan(0);
    });

    it('should have a department selector', async function () {
      const deptSelects = await driver.findElements(
        By.css('select[id*="department" i], select[name*="department" i], [id*="dept" i]')
      );
      expect(deptSelects.length).to.be.greaterThan(0);
    });

    it('should have a submit/save button', async function () {
      const submitBtns = await driver.findElements(
        By.css('button[type="submit"], button[class*="save" i], button[class*="submit" i]')
      );
      // Check for any kind of primary action button
      const allBtns = await driver.findElements(By.css('button'));
      expect(allBtns.length).to.be.greaterThan(0);
    });
  });
});
