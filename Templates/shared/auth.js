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

function handle401(res) {
  if (res.status === 401) {
    window.location.href = '/Templates/Login_Page.html';
    return true;
  }
  return false;
}
