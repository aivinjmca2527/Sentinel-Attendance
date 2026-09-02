/**
 * Sentinel — Employee & Department Routes (Module 1: Melbin)
 * Mounts: /api/employees  and  /api/departments
 *
 * This file exports TWO routers:
 *   - employeeRouter   → mounted at /api/employees
 *   - departmentRouter → mounted at /api/departments
 */

const employeeRouter   = require("express").Router();
const departmentRouter = require("express").Router();
const ctrl = require("./controller");
const { requireAuth, requireRole } = require("../../shared/middleware/auth.middleware");

const WRITE_ROLES = ["Manager", "Admin", "Super Admin"];

// ═══════════════════════════════════════════════════════════════════════════════
// /api/employees
// ═══════════════════════════════════════════════════════════════════════════════

employeeRouter.get("/",     requireAuth,                              ctrl.listEmployees);
employeeRouter.get("/:id",  requireAuth,                              ctrl.getEmployee);
employeeRouter.post("/",    requireAuth, requireRole(...WRITE_ROLES),  ctrl.createEmployee);
employeeRouter.put("/:id",  requireAuth, requireRole(...WRITE_ROLES),  ctrl.updateEmployee);
employeeRouter.delete("/:id", requireAuth, requireRole(...WRITE_ROLES), ctrl.deleteEmployee);

// ═══════════════════════════════════════════════════════════════════════════════
// /api/departments
// ═══════════════════════════════════════════════════════════════════════════════

departmentRouter.get("/",     requireAuth,                                      ctrl.listDepartments);
departmentRouter.get("/:id",  requireAuth,                                      ctrl.getDepartment);
departmentRouter.post("/",    requireAuth, requireRole("Admin", "Super Admin"),  ctrl.createDepartment);
departmentRouter.put("/:id",  requireAuth, requireRole("Admin", "Super Admin"),  ctrl.updateDepartment);
departmentRouter.delete("/:id", requireAuth, requireRole("Super Admin"),        ctrl.deleteDepartment);

module.exports = { employeeRouter, departmentRouter };
