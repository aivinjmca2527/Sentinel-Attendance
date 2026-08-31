/**
 * Sentinel — Dashboard JS
 * Reads user from JWT, populates UI, handles sign-out and trend chart.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const user = sentinelGetSession();

  // Guard: bounce back to login if no active session or temp token
  if (!user || user.temp) {
    window.location.href = "index.html";
    return;
  }

  // ─── Populate user details ───────────────────────────────────────────────

  document.getElementById("userName").textContent    = user.name;
  document.getElementById("userEmail").textContent   = user.email;
  document.getElementById("userRole").textContent    = user.role;
  document.getElementById("userInitials").textContent = user.initials || user.name.slice(0, 2).toUpperCase();
  document.getElementById("welcomeLine").textContent =
    `Welcome back, ${user.name.split(" ")[0]} — live attendance tracking for ` +
    new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

  // ─── Show Employees nav item for privileged roles ────────────────────────

  const empNavItem = document.getElementById("navEmployees");
  if (empNavItem && ["Manager", "Admin", "Super Admin"].includes(user.role)) {
    empNavItem.style.display = "";
  }

  // ─── Dropdown toggle ─────────────────────────────────────────────────────

  const trigger  = document.getElementById("userMenuTrigger");
  const dropdown = document.getElementById("userMenuDropdown");
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });
  document.addEventListener("click", () => dropdown.classList.remove("open"));

  // ─── Sign out (sidebar + dropdown) ───────────────────────────────────────

  document.getElementById("signOutLink")?.addEventListener("click", (e) => {
    e.preventDefault();
    sentinelLogout();
  });
  document.getElementById("signOutLink2")?.addEventListener("click", (e) => {
    e.preventDefault();
    sentinelLogout();
  });

  // ─── Trend chart (last 7 days bar chart) ─────────────────────────────────

  const days   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const values = [72, 78, 65, 90, 85, 40, 30];
  const chart  = document.getElementById("trendChart");
  if (chart) {
    chart.innerHTML = days
      .map(
        (d, i) => `
        <div class="trend-bar-col">
          <div class="trend-bar" style="height:${values[i]}%"></div>
          <div class="trend-bar-label">${d}</div>
        </div>`
      )
      .join("");
  }

  // ─── Load live employee count from API ───────────────────────────────────

  try {
    const token = sentinelGetToken();
    const res   = await fetch(`${SENTINEL_API}/employees`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const employees = await res.json();
      const active    = employees.filter((e) => e.status === "Active").length;
      const onLeave   = employees.filter((e) => e.status === "On Leave").length;
      const inactive  = employees.filter((e) => e.status === "Inactive").length;

      // Update stat card values if they exist
      const presentEl   = document.getElementById("statPresent");
      const absentEl    = document.getElementById("statAbsent");
      const onLeaveEl   = document.getElementById("statOnLeave");
      const totalCountEl = document.getElementById("totalEmpCount");

      if (presentEl)    presentEl.textContent   = active;
      if (absentEl)     absentEl.textContent    = inactive;
      if (onLeaveEl)    onLeaveEl.textContent   = onLeave;
      if (totalCountEl) totalCountEl.textContent = employees.length;
    }
  } catch {
    // Silently ignore — static values from HTML are still visible
  }
});
