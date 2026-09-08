/**
 * Shared sidebar injection + active-link highlighting + sign-out wiring.
 * Each page includes <div id="sidebar-container"></div> and this script.
 */
(function () {
  'use strict';

  var container = document.getElementById('sidebar-container');
  if (!container) return;

  fetch('/Templates/shared/sidebar.html')
    .then(function (res) {
      if (!res.ok) throw new Error('Failed to load sidebar: HTTP ' + res.status);
      return res.text();
    })
    .then(function (html) {
      container.innerHTML = html;

      // ── Active link highlighting ──
      var path = window.location.pathname;
      // Extract filename without extension, e.g. "Admin_Dashboard_Page"
      var filename = path.split('/').pop().replace('.html', '');

      var navLinks = container.querySelectorAll('nav a[data-page]');
      navLinks.forEach(function (link) {
        link.classList.remove('active');
        if (link.getAttribute('data-page') === filename) {
          link.classList.add('active');
        }
      });

      // ── Sign Out wiring ──
      var signOutLink = container.querySelector('#sidebar-sign-out');
      if (signOutLink) {
        signOutLink.addEventListener('click', function (e) {
          e.preventDefault();
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/Templates/Login_Page.html';
        });
      }
    })
    .catch(function (err) {
      console.error('[Sidebar]', err);
    });
})();
