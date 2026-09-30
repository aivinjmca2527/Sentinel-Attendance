/**
 * Geofencing Configuration
 * ------------------------
 * Manages geofence verification mode and accuracy settings.
 *
 * Modes:
 * - 'off':     Bypass all geofence and location validation.
 * - 'log':     Default mode. Validate geofence boundaries and log security alerts,
 *              without blocking check-in/out.
 * - 'enforce': Reject check-in/out outside boundary (403), with poor accuracy (422),
 *              or using mock locations (403). Still logs security alerts.
 */

function isTestOverrideAuthorized(reqOrCtx) {
  if (process.env.NODE_ENV !== 'test' || !reqOrCtx) {
    return false;
  }
  const configuredSecret = process.env.TEST_OVERRIDE_SECRET;
  if (!configuredSecret) {
    return false;
  }
  const headers = reqOrCtx.headers || (reqOrCtx.req && reqOrCtx.req.headers);
  if (!headers) {
    return false;
  }
  const providedSecret = headers['x-test-secret'] || headers['X-Test-Secret'];
  return Boolean(providedSecret && providedSecret === configuredSecret);
}

let dynamicGeofenceMode = null;

function setGeofenceMode(mode) {
  if (['off', 'log', 'enforce'].includes(mode)) {
    dynamicGeofenceMode = mode;
  }
}

function getGeofenceMode(reqOrCtx) {
  // Allow request header override in test environment when authorized by secret
  if (isTestOverrideAuthorized(reqOrCtx)) {
    const headers = reqOrCtx.headers || (reqOrCtx.req && reqOrCtx.req.headers);
    if (headers && headers['x-geofence-mode']) {
      const override = headers['x-geofence-mode'].toLowerCase().trim();
      if (['off', 'log', 'enforce'].includes(override)) {
        return override;
      }
    }
  }

  if (dynamicGeofenceMode) {
    return dynamicGeofenceMode;
  }

  const mode = (process.env.GEOFENCE_MODE || 'log').toLowerCase().trim();
  if (['off', 'log', 'enforce'].includes(mode)) {
    return mode;
  }
  return 'log';
}

function getMaxAccuracy(reqOrCtx) {
  if (isTestOverrideAuthorized(reqOrCtx)) {
    const headers = reqOrCtx.headers || (reqOrCtx.req && reqOrCtx.req.headers);
    if (headers && headers['x-geofence-max-accuracy']) {
      const val = parseFloat(headers['x-geofence-max-accuracy']);
      if (!isNaN(val) && val > 0) return val;
    }
  }

  const val = parseFloat(process.env.GEOFENCE_MAX_ACCURACY_M);
  return !isNaN(val) && val > 0 ? val : 50;
}

module.exports = {
  getGeofenceMode,
  setGeofenceMode,
  getMaxAccuracy,
  get GEOFENCE_MODE() {
    return getGeofenceMode();
  },
  get GEOFENCE_MAX_ACCURACY_M() {
    return getMaxAccuracy();
  }
};

