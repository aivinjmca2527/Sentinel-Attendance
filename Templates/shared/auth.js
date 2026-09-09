/**
 * Shared auth helpers — used by all dashboard pages.
 * Extracted from the duplicated inline implementations.
 */
function authHeaders(extra) {
  var token = localStorage.getItem('token');
  var h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = 'Bearer ' + token;
  if (extra) { for (var k in extra) h[k] = extra[k]; }
  return h;
}

function clearAuthAndRedirect() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/Templates/Login_Page.html';
}

function handle401(res) {
  if (res.status === 401) {
    clearAuthAndRedirect();
    return true;
  }
  return false;
}

/**
 * Validate token server-side. Returns true if valid, false otherwise.
 * On failure, clears localStorage so login page won't bounce back.
 */
async function validateTokenOrRedirect() {
  var token = localStorage.getItem('token');
  if (!token) { clearAuthAndRedirect(); return false; }
  try {
    var res = await fetch('/api/auth/me', { headers: authHeaders() });
    if (!res.ok) { clearAuthAndRedirect(); return false; }
    return true;
  } catch (e) {
    clearAuthAndRedirect();
    return false;
  }
}
