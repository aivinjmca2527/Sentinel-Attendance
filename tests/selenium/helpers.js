/**
 * Sentinel Attendance — Selenium Helper Utilities
 * Reusable functions for common test operations (login, navigation, waits, etc.)
 */

const { By, until, Key } = require('selenium-webdriver');
const { BASE_URL, TIMEOUTS, ADMIN_CREDENTIALS } = require('./config');

/**
 * Navigate to a page and wait for full load.
 */
async function navigateTo(driver, path) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  await driver.get(url);
  await driver.sleep(1000); // allow initial JS to execute
}

/**
 * Wait for an element to be visible.
 */
async function waitForVisible(driver, locator, timeout = TIMEOUTS.explicit) {
  return driver.wait(until.elementLocated(locator), timeout)
    .then(() => driver.wait(until.elementIsVisible(driver.findElement(locator)), timeout));
}

/**
 * Wait for an element to be present in the DOM (not necessarily visible).
 */
async function waitForPresent(driver, locator, timeout = TIMEOUTS.explicit) {
  return driver.wait(until.elementLocated(locator), timeout);
}

/**
 * Wait for an element to be clickable (visible + enabled).
 */
async function waitForClickable(driver, locator, timeout = TIMEOUTS.explicit) {
  const el = await waitForVisible(driver, locator, timeout);
  await driver.wait(until.elementIsEnabled(el), timeout);
  return el;
}

/**
 * Wait until the URL contains a specific substring.
 */
async function waitForUrlContains(driver, substring, timeout = TIMEOUTS.explicit) {
  return driver.wait(until.urlContains(substring), timeout);
}

/**
 * Wait for the page title to contain a specific substring.
 */
async function waitForTitleContains(driver, substring, timeout = TIMEOUTS.explicit) {
  return driver.wait(until.titleContains(substring), timeout);
}

/**
 * Clear an input field and type new text.
 */
async function clearAndType(driver, locator, text) {
  const el = await waitForVisible(driver, locator);
  await el.clear();
  await el.sendKeys(text);
  return el;
}

/**
 * Take a screenshot and return as base64.
 */
async function takeScreenshot(driver) {
  return driver.takeScreenshot();
}

/**
 * Perform admin login through the UI — fills email, password, submits.
 * Returns true if redirected to the dashboard (employee login skips TOTP).
 * For admin/manager, TOTP is required — this function handles that case by
 * checking if the TOTP modal appears and returns a status.
 */
async function loginAsAdmin(driver, credentials = ADMIN_CREDENTIALS) {
  await navigateTo(driver, '/Templates/Login_Page.html');

  // Clear any existing auth
  await driver.executeScript(`
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  `);
  await driver.navigate().refresh();
  await driver.sleep(1000);

  // Wait for the login form
  await waitForVisible(driver, By.id('email'));

  // Fill credentials
  await clearAndType(driver, By.id('email'), credentials.email);
  await clearAndType(driver, By.id('password'), credentials.password);

  // Submit form
  const submitBtn = await driver.findElement(By.css('button[type="submit"]'));
  await submitBtn.click();

  // Wait for either redirect to dashboard or TOTP modal
  await driver.sleep(2000);

  return {
    url: await driver.getCurrentUrl(),
    title: await driver.getTitle(),
  };
}

/**
 * Set auth token directly via localStorage to bypass UI login.
 * Useful for quickly authenticating before testing other pages.
 */
async function setAuthToken(driver, token, user) {
  await navigateTo(driver, '/Templates/Login_Page.html');
  await driver.executeScript(`
    localStorage.setItem('token', arguments[0]);
    localStorage.setItem('user', JSON.stringify(arguments[1]));
  `, token, user);
}

/**
 * Get an admin auth token via API (bypasses UI).
 */
async function getAdminTokenViaAPI() {
  const http = require('http');
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      email: ADMIN_CREDENTIALS.email,
      password: ADMIN_CREDENTIALS.password,
    });
    const opts = {
      hostname: 'localhost',
      port: process.env.PORT || 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          // For employee accounts (no TOTP), token is returned directly
          // For admin/manager, tempToken is returned (needs TOTP)
          resolve(json.token || json.tempToken || null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Check if an element exists in the DOM.
 */
async function elementExists(driver, locator) {
  try {
    const elements = await driver.findElements(locator);
    return elements.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get the text content of an element (waits for it to be present).
 */
async function getElementText(driver, locator, timeout = TIMEOUTS.explicit) {
  const el = await waitForPresent(driver, locator, timeout);
  return el.getText();
}

/**
 * Scroll to an element.
 */
async function scrollToElement(driver, element) {
  await driver.executeScript('arguments[0].scrollIntoView({ behavior: "smooth", block: "center" });', element);
  await driver.sleep(500);
}

/**
 * Wait for page to fully load (document.readyState === 'complete').
 */
async function waitForPageLoad(driver, timeout = TIMEOUTS.pageLoad) {
  await driver.wait(async () => {
    const readyState = await driver.executeScript('return document.readyState');
    return readyState === 'complete';
  }, timeout);
}

module.exports = {
  navigateTo,
  waitForVisible,
  waitForPresent,
  waitForClickable,
  waitForUrlContains,
  waitForTitleContains,
  clearAndType,
  takeScreenshot,
  loginAsAdmin,
  setAuthToken,
  getAdminTokenViaAPI,
  elementExists,
  getElementText,
  scrollToElement,
  waitForPageLoad,
};
