/**
 * Sentinel — Employees Page JS
 * Full CRUD via /api/employees and /api/departments
 */

let allEmployees = [];
let departments  = [];
let editingId    = null;
let deletingId   = null;

document.addEventListener("DOMContentLoaded", async () => {

  // ─── Auth guard ────────────────────────────────────────────────────────────

  const user = sentinelGetSession();
  if (!user || user.temp) {
    window.location.href = "index.html";
    return;
  }

  const WRITE_ROLES = ["Manager", "Admin", "Super Admin"];
  const canWrite = WRITE_ROLES.includes(user.role);

  // Populate header
  document.getElementById("userName").textContent     = user.name;
  document.getElementById("userEmail").textContent    = user.email;
  document.getElementById("userRole").textContent     = user.role;
  document.getElementById("userInitials").textContent = user.initials || user.name.slice(0, 2).toUpperCase();

  // User menu dropdown
  const trigger  = document.getElementById("userMenuTrigger");
  const dropdown = document.getElementById("userMenuDropdown");
  trigger.addEventListener("click", (e) => { e.stopPropagation(); dropdown.classList.toggle("open"); });
  document.addEventListener("click", () => dropdown.classList.remove("open"));

  // Sign out
  document.getElementById("signOutLink")?.addEventListener("click", (e) => { e.preventDefault(); sentinelLogout(); });
  document.getElementById("signOutLink2")?.addEventListener("click", (e) => { e.preventDefault(); sentinelLogout(); });

  // Hide write controls if no permission
  if (!canWrite) {
    document.getElementById("addEmpBtn").style.display   = "none";
    document.getElementById("exportBtn").style.display   = "none";
  }

  // ─── Load departments ──────────────────────────────────────────────────────

  await loadDepartments();

  // ─── Load employees ────────────────────────────────────────────────────────

  await loadEmployees();

  // ─── Filter controls ───────────────────────────────────────────────────────

  let filterTimer;
  document.getElementById("searchInput").addEventListener("input", () => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(renderTable, 200);
  });
  document.getElementById("statusFilter").addEventListener("change", renderTable);
  document.getElementById("deptFilter").addEventListener("change", renderTable);

  // ─── Add button ────────────────────────────────────────────────────────────

  document.getElementById("addEmpBtn")?.addEventListener("click", () => {
    openModal(null);
  });

  // ─── Export CSV ────────────────────────────────────────────────────────────

  document.getElementById("exportBtn")?.addEventListener("click", exportCSV);

  // ─── Modal wiring ──────────────────────────────────────────────────────────

  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("modalCancel").addEventListener("click", closeModal);
  document.getElementById("modalBackdrop").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modalBackdrop")) closeModal();
  });

  document.getElementById("empForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveEmployee();
  });

  // ─── Delete modal ──────────────────────────────────────────────────────────

  document.getElementById("deleteClose").addEventListener("click", closeDeleteModal);
  document.getElementById("deleteCancelBtn").addEventListener("click", closeDeleteModal);
  document.getElementById("deleteConfirmBtn").addEventListener("click", confirmDelete);
  document.getElementById("deleteBackdrop").addEventListener("click", (e) => {
    if (e.target === document.getElementById("deleteBackdrop")) closeDeleteModal();
  });
});

// ─── Data Loading ──────────────────────────────────────────────────────────────

async function loadDepartments() {
  try {
    const res = await authFetch("/departments");
    if (res.ok) {
      departments = await res.json();
      const deptFilter = document.getElementById("deptFilter");
      const mDept      = document.getElementById("mDept");
      for (const d of departments) {
        deptFilter.insertAdjacentHTML("beforeend", `<option value="${d.id}">${d.name}</option>`);
        mDept.insertAdjacentHTML("beforeend", `<option value="${d.id}">${d.name}</option>`);
      }
    }
  } catch {}
}

async function loadEmployees() {
  try {
    const res = await authFetch("/employees");
    if (!res.ok) { showTableError("Failed to load employees."); return; }
    allEmployees = await res.json();
    renderTable();
  } catch {
    showTableError("Cannot connect to Sentinel server.");
  }
}

// ─── Render ────────────────────────────────────────────────────────────────────

function getFiltered() {
  const search = document.getElementById("searchInput").value.toLowerCase();
  const status = document.getElementById("statusFilter").value;
  const dept   = document.getElementById("deptFilter").value;

  return allEmployees.filter((e) => {
    const matchSearch = !search ||
      e.name.toLowerCase().includes(search) ||
      e.email.toLowerCase().includes(search) ||
      e.emp_id.toLowerCase().includes(search);
    const matchStatus = !status || e.status === status;
    const matchDept   = !dept   || String(e.department_id) === dept;
    return matchSearch && matchStatus && matchDept;
  });
}

function renderTable() {
  const filtered = getFiltered();
  const tbody    = document.getElementById("empTableBody");
  const countEl  = document.getElementById("empCount");

  countEl.textContent = `${filtered.length} employee${filtered.length !== 1 ? "s" : ""}`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">
      <i class="fa-solid fa-users-slash"></i><br/>No employees match your filters.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map((e) => {
      const initials = e.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
      const deptName = e.department_name || "—";
      const joinDate = e.join_date ? new Date(e.join_date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
      return `
        <tr>
          <td>
            <div class="emp-cell">
              <div class="avatar-initials">${initials}</div>
              <div>
                <div class="emp-name">${e.name}</div>
                <div class="emp-email">${e.email}</div>
              </div>
            </div>
          </td>
          <td><code class="emp-id">${e.emp_id}</code></td>
          <td>${deptName}</td>
          <td>${e.role}</td>
          <td><span class="status-badge status-${e.status.replace(" ", "-").toLowerCase()}">${e.status}</span></td>
          <td>${joinDate}</td>
          <td>
            <div class="action-btns">
              <button class="action-btn edit-btn" title="Edit" onclick="openModal(${e.id})">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="action-btn delete-btn" title="Delete" onclick="openDeleteModal(${e.id}, '${e.name.replace(/'/g, "\\'")}')">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>`;
    })
    .join("");
}

function showTableError(msg) {
  document.getElementById("empTableBody").innerHTML =
    `<tr><td colspan="7" class="table-empty table-error"><i class="fa-solid fa-triangle-exclamation"></i> ${msg}</td></tr>`;
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

function openModal(id) {
  editingId = id;
  const modal = document.getElementById("modalBackdrop");
  document.getElementById("modalTitle").textContent = id ? "Edit Employee" : "Add Employee";
  document.getElementById("modalSave").textContent  = id ? "Save Changes" : "Add Employee";
  document.getElementById("modalError").style.display = "none";
  document.getElementById("empForm").reset();

  if (id) {
    const emp = allEmployees.find((e) => e.id === id);
    if (emp) {
      document.getElementById("mEmpId").value   = emp.emp_id;
      document.getElementById("mEmpId").disabled = true; // Can't change emp ID
      document.getElementById("mName").value    = emp.name;
      document.getElementById("mEmail").value   = emp.email;
      document.getElementById("mPhone").value   = emp.phone || "";
      document.getElementById("mRole").value    = emp.role;
      document.getElementById("mDept").value    = emp.department_id || "";
      document.getElementById("mStatus").value  = emp.status;
      document.getElementById("mJoinDate").value = emp.join_date || "";
    }
  } else {
    document.getElementById("mEmpId").disabled = false;
  }

  modal.style.display = "flex";
  document.getElementById("mEmpId").focus();
}

function closeModal() {
  document.getElementById("modalBackdrop").style.display = "none";
  editingId = null;
}

async function saveEmployee() {
  const saveBtn = document.getElementById("modalSave");
  const errorEl = document.getElementById("modalError");
  errorEl.style.display = "none";

  const payload = {
    emp_id:        document.getElementById("mEmpId").value.trim(),
    name:          document.getElementById("mName").value.trim(),
    email:         document.getElementById("mEmail").value.trim(),
    phone:         document.getElementById("mPhone").value.trim() || null,
    role:          document.getElementById("mRole").value,
    department_id: document.getElementById("mDept").value || null,
    status:        document.getElementById("mStatus").value,
    join_date:     document.getElementById("mJoinDate").value || null,
  };

  if (!payload.emp_id || !payload.name || !payload.email) {
    errorEl.textContent    = "Employee ID, name, and email are required.";
    errorEl.style.display = "block";
    return;
  }

  saveBtn.disabled    = true;
  saveBtn.textContent = "Saving…";

  try {
    const url    = editingId ? `/employees/${editingId}` : "/employees";
    const method = editingId ? "PUT" : "POST";
    const res    = await authFetch(url, { method, body: JSON.stringify(payload) });
    const data   = await res.json();

    if (!res.ok) {
      errorEl.textContent    = data.error || "Save failed.";
      errorEl.style.display = "block";
      return;
    }

    closeModal();
    await loadEmployees();

  } catch {
    errorEl.textContent    = "Server error. Please try again.";
    errorEl.style.display = "block";
  } finally {
    saveBtn.disabled    = false;
    saveBtn.textContent = editingId ? "Save Changes" : "Add Employee";
  }
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

function openDeleteModal(id, name) {
  deletingId = id;
  document.getElementById("deleteEmpName").textContent = name;
  document.getElementById("deleteError").style.display = "none";
  document.getElementById("deleteBackdrop").style.display = "flex";
}

function closeDeleteModal() {
  document.getElementById("deleteBackdrop").style.display = "none";
  deletingId = null;
}

async function confirmDelete() {
  if (!deletingId) return;
  const confirmBtn = document.getElementById("deleteConfirmBtn");
  const errorEl    = document.getElementById("deleteError");
  confirmBtn.disabled    = true;
  confirmBtn.textContent = "Deleting…";

  try {
    const res = await authFetch(`/employees/${deletingId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      errorEl.textContent    = data.error || "Delete failed.";
      errorEl.style.display = "block";
      return;
    }
    closeDeleteModal();
    await loadEmployees();
  } catch {
    errorEl.textContent    = "Server error.";
    errorEl.style.display = "block";
  } finally {
    confirmBtn.disabled    = false;
    confirmBtn.textContent = "Delete";
  }
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV() {
  const filtered = getFiltered();
  const header   = ["ID", "Name", "Email", "Phone", "Role", "Department", "Status", "Join Date"];
  const rows     = filtered.map((e) => [
    e.emp_id, e.name, e.email, e.phone || "", e.role,
    e.department_name || "", e.status, e.join_date || "",
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `sentinel-employees-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Auth Fetch Helper ────────────────────────────────────────────────────────

function authFetch(path, options = {}) {
  const token   = sentinelGetToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${SENTINEL_API}${path}`, { ...options, headers });
}
