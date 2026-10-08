/**
 * Shared auth helpers — used by all dashboard pages.
 * Works seamlessly with httpOnly cookies (and Bearer tokens as backward-compatibility fallback).
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
  fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).finally(function () {
    if (window.location.pathname.indexOf('Login_Page.html') === -1) {
      window.location.href = '/Templates/Login_Page.html';
    }
  });
}

function handle401(res) {
  if (res.status === 401) {
    clearAuthAndRedirect();
    return true;
  }
  return false;
}

/**
 * Validate token server-side via httpOnly cookie or Bearer header.
 * Returns true if valid, false otherwise.
 * On failure, clears auth session and redirects to login.
 */
async function validateTokenOrRedirect() {
  try {
    var res = await fetch('/api/auth/me', {
      headers: authHeaders(),
      credentials: 'include'
    });
    if (!res.ok) {
      clearAuthAndRedirect();
      return false;
    }
    return true;
  } catch (e) {
    clearAuthAndRedirect();
    return false;
  }
}
