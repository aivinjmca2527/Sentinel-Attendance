/**
 * Sentinel — Frontend Auth Layer
 * Connects to the Express backend at SENTINEL_API.
 */

const SENTINEL_API = "http://localhost:3000/api";
const SENTINEL_JWT_KEY = "sentinel_jwt";
const SENTINEL_TEMP_KEY = "sentinel_temp_jwt";

// ─── JWT helpers ──────────────────────────────────────────────────────────────

function sentinelDecodeJWT(token) {
  try {
    const base64Payload = token.split(".")[1];
    const payload = atob(base64Payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function sentinelGetSession() {
  const token = sessionStorage.getItem(SENTINEL_JWT_KEY);
  if (!token) return null;
  const payload = sentinelDecodeJWT(token);
  if (!payload) return null;
  // Check expiry
  if (payload.exp && Date.now() / 1000 > payload.exp) {
    sessionStorage.removeItem(SENTINEL_JWT_KEY);
    return null;
  }
  return payload;
}

function sentinelGetToken() {
  return sessionStorage.getItem(SENTINEL_JWT_KEY);
}

function sentinelLogout() {
  fetch(`${SENTINEL_API}/auth/logout`, { method: "POST" }).catch(() => {});
  sessionStorage.removeItem(SENTINEL_JWT_KEY);
  sessionStorage.removeItem(SENTINEL_TEMP_KEY);
  window.location.href = "index.html";
}

// ─── Login page wiring ────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  if (!form) return; // not on the login page

  // If already have a valid full session, go to dashboard
  if (sentinelGetSession()) {
    window.location.href = "dashboard.html";
    return;
  }

  const errorMsg  = document.getElementById("errorMsg");
  const pwInput   = document.getElementById("password");
  const toggleBtn = document.getElementById("togglePw");
  const submitBtn = form.querySelector("button[type=submit]");

  toggleBtn?.addEventListener("click", () => {
    const isPassword = pwInput.type === "password";
    pwInput.type = isPassword ? "text" : "password";
    toggleBtn.innerHTML = isPassword
      ? '<i class="fa-solid fa-eye-slash"></i>'
      : '<i class="fa-solid fa-eye"></i>';
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorMsg.style.display = "none";

    const email    = document.getElementById("email").value.trim();
    const password = pwInput.value;

    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in…";

    try {
      const res  = await fetch(`${SENTINEL_API}/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        showError(data.error || "Login failed. Please try again.");
        return;
      }

      if (data.requireTotpSetup) {
        // First-time TOTP setup required (Manager/Admin)
        sessionStorage.setItem(SENTINEL_TEMP_KEY, data.tempToken);
        window.location.href = "totp-setup.html";
        return;
      }

      if (data.requireTotp) {
        // TOTP already configured — need verification
        sessionStorage.setItem(SENTINEL_TEMP_KEY, data.tempToken);
        window.location.href = "totp-verify.html";
        return;
      }

      // Full JWT returned (Employee role)
      sessionStorage.setItem(SENTINEL_JWT_KEY, data.token);
      window.location.href = "dashboard.html";

    } catch (err) {
      showError("Cannot connect to Sentinel server. Make sure the backend is running on port 3000.");
    } finally {
      submitBtn.disabled   = false;
      submitBtn.textContent = "Sign In to Portal";
    }
  });

  function showError(msg) {
    errorMsg.textContent    = msg;
    errorMsg.style.display = "block";
  }
});
