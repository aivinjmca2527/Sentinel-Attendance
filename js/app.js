/* ==========================================================================
   Sentinel — Mock Auth Layer
   Replace this with real API calls when a backend is wired up.
   Look for the "TODO: connect backend" markers.
   ========================================================================== */

const SENTINEL_USERS = [
  {
    name: "Sarah Smith",
    email: "sarah.smith@sentinel.com",
    password: "Sarah@123",
    role: "Admin",
    department: "Marketing",
    initials: "SS"
  },
  {
    name: "Alex Reyes",
    email: "admin@sentinel.com",
    password: "Admin@123",
    role: "Super Admin",
    department: "Operations",
    initials: "AR"
  },
  {
    name: "John Doe",
    email: "john.doe@sentinel.com",
    password: "John@123",
    role: "Manager",
    department: "Engineering",
    initials: "JD"
  }
];

const SENTINEL_SESSION_KEY = "sentinel_session";

function sentinelLogin(email, password) {
  // TODO: connect backend — replace with a real POST /api/auth/login call.
  const match = SENTINEL_USERS.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
  );
  if (match) {
    const { password: _pw, ...safeUser } = match;
    sessionStorage.setItem(SENTINEL_SESSION_KEY, JSON.stringify(safeUser));
    return { ok: true, user: safeUser };
  }
  return { ok: false, error: "Invalid email or password." };
}

function sentinelGetSession() {
  const raw = sessionStorage.getItem(SENTINEL_SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

function sentinelLogout() {
  sessionStorage.removeItem(SENTINEL_SESSION_KEY);
  window.location.href = "index.html";
}

/* ---------------- Login page wiring ---------------- */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  if (!form) return; // not on the login page

  // If already logged in, skip straight to dashboard
  if (sentinelGetSession()) {
    window.location.href = "dashboard.html";
    return;
  }

  const errorMsg = document.getElementById("errorMsg");
  const pwInput = document.getElementById("password");
  const toggleBtn = document.getElementById("togglePw");

  toggleBtn?.addEventListener("click", () => {
    const isPw = pwInput.type === "password";
    pwInput.type = isPw ? "text" : "password";
    toggleBtn.innerHTML = isPw
      ? '<i class="fa-solid fa-eye-slash"></i>'
      : '<i class="fa-solid fa-eye"></i>';
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = pwInput.value;

    const result = sentinelLogin(email, password);
    if (result.ok) {
      errorMsg.style.display = "none";
      window.location.href = "dashboard.html";
    } else {
      errorMsg.textContent = result.error;
      errorMsg.style.display = "block";
    }
  });
});
