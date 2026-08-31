/**
 * Sentinel — TOTP Setup Page JS
 */

document.addEventListener("DOMContentLoaded", async () => {
  const tempToken = sessionStorage.getItem("sentinel_temp_jwt");
  if (!tempToken) {
    window.location.href = "index.html";
    return;
  }

  const stepLoading = document.getElementById("stepLoading");
  const stepSetup   = document.getElementById("stepSetup");
  const qrImage     = document.getElementById("qrImage");
  const secretEl    = document.getElementById("totpSecret");
  const codeInput   = document.getElementById("totpCode");
  const verifyBtn   = document.getElementById("verifyBtn");
  const errorEl     = document.getElementById("totpError");

  // Format code input with a space after 3 digits
  codeInput.addEventListener("input", () => {
    let v = codeInput.value.replace(/\D/g, "").slice(0, 6);
    if (v.length > 3) v = v.slice(0, 3) + " " + v.slice(3);
    codeInput.value = v;
  });

  // ─── Request QR code from backend ─────────────────────────────────────────

  try {
    const res  = await fetch(`${SENTINEL_API}/auth/totp/setup`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${tempToken}` },
    });
    const data = await res.json();

    if (!res.ok) {
      sessionStorage.removeItem("sentinel_temp_jwt");
      alert(data.error || "Failed to generate TOTP. Please sign in again.");
      window.location.href = "index.html";
      return;
    }

    qrImage.src       = data.qrDataUrl;
    secretEl.textContent = data.secret;

    stepLoading.style.display = "none";
    stepSetup.style.display   = "";

  } catch {
    alert("Cannot reach Sentinel server. Is the backend running?");
    window.location.href = "index.html";
  }

  // ─── Verify button ─────────────────────────────────────────────────────────

  verifyBtn.addEventListener("click", async () => {
    const code = codeInput.value.replace(/\s/g, "");
    if (code.length !== 6) {
      showError("Please enter the full 6-digit code.");
      return;
    }

    verifyBtn.disabled   = true;
    verifyBtn.textContent = "Verifying…";
    errorEl.style.display = "none";

    try {
      const res  = await fetch(`${SENTINEL_API}/auth/totp/verify`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tempToken}`,
        },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (!res.ok) {
        showError(data.error || "Verification failed. Try again.");
        return;
      }

      // TOTP verified — store full JWT and go to dashboard
      sessionStorage.removeItem("sentinel_temp_jwt");
      sessionStorage.setItem("sentinel_jwt", data.token);
      window.location.href = "dashboard.html";

    } catch {
      showError("Server error. Please try again.");
    } finally {
      verifyBtn.disabled   = false;
      verifyBtn.textContent = "Verify & Activate";
    }
  });

  function showError(msg) {
    errorEl.textContent    = msg;
    errorEl.style.display = "block";
  }
});
