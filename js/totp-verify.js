/**
 * Sentinel — TOTP Verify Page JS
 * Handles the 6 individual digit boxes and submits to /api/auth/totp/verify
 */

document.addEventListener("DOMContentLoaded", () => {
  const tempToken = sessionStorage.getItem("sentinel_temp_jwt");
  if (!tempToken) {
    window.location.href = "index.html";
    return;
  }

  const boxes    = Array.from(document.querySelectorAll(".otp-box"));
  const verifyBtn = document.getElementById("verifyBtn");
  const errorEl  = document.getElementById("totpError");

  // ─── OTP box navigation ───────────────────────────────────────────────────

  boxes.forEach((box, idx) => {
    box.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !box.value && idx > 0) {
        boxes[idx - 1].focus();
      }
    });

    box.addEventListener("input", () => {
      const val = box.value.replace(/\D/g, "");
      box.value = val.slice(-1);
      if (val && idx < boxes.length - 1) {
        boxes[idx + 1].focus();
      }
      // Auto-submit when all 6 boxes are filled
      if (boxes.every((b) => b.value)) submitCode();
    });

    box.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData)
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, 6);
      pasted.split("").forEach((ch, i) => {
        if (boxes[i]) boxes[i].value = ch;
      });
      const nextEmpty = boxes.find((b) => !b.value);
      (nextEmpty || boxes[boxes.length - 1]).focus();
      if (pasted.length === 6) submitCode();
    });
  });

  boxes[0].focus();

  // ─── Verify button ─────────────────────────────────────────────────────────

  verifyBtn.addEventListener("click", submitCode);

  async function submitCode() {
    const code = boxes.map((b) => b.value).join("");
    if (code.length !== 6) {
      showError("Please enter all 6 digits.");
      return;
    }

    verifyBtn.disabled   = true;
    verifyBtn.textContent = "Verifying…";
    errorEl.style.display = "none";
    boxes.forEach((b) => b.classList.remove("otp-error"));

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
        boxes.forEach((b) => (b.value = ""));
        boxes.forEach((b) => b.classList.add("otp-error"));
        boxes[0].focus();
        showError(data.error || "Incorrect code. Please try again.");
        return;
      }

      // Success — store full token and proceed
      sessionStorage.removeItem("sentinel_temp_jwt");
      sessionStorage.setItem("sentinel_jwt", data.token);
      window.location.href = "dashboard.html";

    } catch {
      showError("Cannot connect to Sentinel server. Is the backend running?");
    } finally {
      verifyBtn.disabled   = false;
      verifyBtn.textContent = "Verify Identity";
    }
  }

  function showError(msg) {
    errorEl.textContent    = msg;
    errorEl.style.display = "block";
  }
});
