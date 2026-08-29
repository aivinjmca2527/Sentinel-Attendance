document.addEventListener("DOMContentLoaded", () => {
  const user = sentinelGetSession();

  // Guard: bounce back to login if no active session
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  // Populate the logged-in user's name and email
  document.getElementById("userName").textContent = user.name;
  document.getElementById("userEmail").textContent = user.email;
  document.getElementById("userRole").textContent = user.role;
  document.getElementById("userInitials").textContent = user.initials;
  document.getElementById("welcomeLine").textContent =
    `Welcome back, ${user.name.split(" ")[0]} — live attendance tracking for ` +
    new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

  // Dropdown toggle
  const trigger = document.getElementById("userMenuTrigger");
  const dropdown = document.getElementById("userMenuDropdown");
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });
  document.addEventListener("click", () => dropdown.classList.remove("open"));

  // Sign out (both entry points)
  document.getElementById("signOutLink").addEventListener("click", (e) => {
    e.preventDefault();
    sentinelLogout();
  });
  document.getElementById("signOutLink2").addEventListener("click", (e) => {
    e.preventDefault();
    sentinelLogout();
  });

  // Simple placeholder trend chart (7-day bars)
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const values = [72, 78, 65, 90, 85, 40, 30]; // % height
  const chart = document.getElementById("trendChart");
  chart.innerHTML = days
    .map(
      (d, i) => `
      <div class="trend-bar-col">
        <div class="trend-bar" style="height:${values[i]}%"></div>
        <div class="trend-bar-label">${d}</div>
      </div>`
    )
    .join("");
});
