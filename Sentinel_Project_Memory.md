# Sentinel (EAMS) — Project Memory / Handoff Document

Paste this whole file into a new chat to continue exactly where this conversation left 
off, without re-explaining anything. See "What to upload in the new chat" at the bottom 
for which files to attach alongside this one.

> **Instruction to Claude, in this or any future chat continuing this project:** Treat 
> this file as the living source of truth for the Sentinel project. Whenever a new 
> decision is made, a design changes, a phase completes (e.g. merging finishes, a bug is 
> fixed, a new feature is scoped), or anything in this document becomes outdated — update 
> this file (don't just answer in chat and let the file go stale) and regenerate/re-share 
> it with the person so they always have an up-to-date copy to carry into their next 
> chat. Add new sections as needed (e.g. "Post-Merge Bugs Found & Fixed", "Phase 2: Face 
> Auth + Geofencing") rather than overwriting history — extend this document, don't 
> shrink it. If a section becomes truly obsolete (e.g. a merge step that's now done), 
> mark it as "COMPLETED" rather than deleting it, so the project history stays intact. 
> At the end of any work session, proactively ask the person if they'd like the memory 
> file updated before they go, rather than waiting to be asked.

---

## 1. Project Overview

**Project:** Sentinel — Employee Attendance Management System (capstone project, Team 9)

**Team & final module assignments** (this was swapped once mid-project — these are final):
- **Melbin Paul** — Module 1: User Authentication & Employee Management
- **Aivin Jinu** — Module 2: Smart Attendance & QR Verification
- **Amina Salim** — Module 3: Admin Dashboard & Analytics
- **Nandana Rajendran** — Module 4: Leave Management & Employee Self-Service

**GitHub repo:** https://github.com/aivinjmca2527/Sentinel-Attendance

---

## 2. Core Architecture Decisions (all confirmed, don't re-litigate these)

- **Two separate client applications:**
  - **Web app** — used ONLY by Managers and Administrators. Built with React.js (or 
    plain wired-up HTML/Tailwind templates), Node.js + Express.js backend.
  - **Mobile app** — used ONLY by Employees. ~~A completely separate codebase/repository 
    (Flutter-based, per an old test folder we found and removed — see Section 5).~~ 
    **SUPERSEDED — see Section 9: mobile app now lives in a `mobile` branch inside this 
    same repo, not a separate one.**
- **Shared database:** MongoDB Atlas (cloud-hosted, free tier), ONE shared instance — 
  not local per-developer databases. Everyone's `.env` MONGO_URI points at the same 
  connection string.
- **Critical rule:** the mobile app NEVER writes to MongoDB directly — it only calls the 
  same Express REST API the web app uses. This is what makes the QR tamper-resistance 
  design actually hold.
- **Authentication:** fully custom — bcrypt for password hashing, JWT for session 
  tokens, TOTP (via `otplib`) as a mandatory second factor for Manager/Administrator 
  accounts only. Explicitly NOT using Firebase Authentication or Supabase (Supabase is 
  Postgres-based and doesn't fit a MongoDB project; Firebase doesn't natively support 
  TOTP anyway, so it would have added setup cost for no real benefit).
- **QR attendance mechanism:** backend generates a cryptographically signed QR code, 
  rotating every ~5 seconds, displayed on a kiosk screen (rendered from the web app). 
  Employees scan it via the mobile app; the SERVER verifies signature + expiry before 
  writing an attendance record (never trust the client).

---

## 3. Known Design Flaw + Planned Future Enhancement (NOT built yet — future phase)

**The flaw:** QR-only verification can't stop a "burner phone" attack — someone scanning 
a valid, unexpired code on a phone that isn't the real employee's.

**The planned fix (future phase, explicitly out of scope for the current build):**
A three-layer check before attendance can be marked, in this order:
1. **Face authentication** — unlocks the rest of the flow only if the employee's face 
   is verified.
2. **Geofencing** — only unlocks once face auth passes; checks the phone's GPS is 
   inside the office's allowed radius.
3. **Signed QR scan** — the existing tamper-resistant mechanism, only reachable once 
   inside the geofence.
The server (not the phone) must make the actual pass/fail decision for all of this, 
same as it already does for QR signature/expiry — a phone can't be trusted to self-report 
"face_verified: true."

**What's already been built to prepare for this (done, in the current schema/prompts):**
- Reserved, currently-UNUSED database fields: `Employees.reference_face_photo_url`, and 
  on `Attendance`: `verification_method` (enum, only value in use today is `'qr_only'`), 
  plus `check_in_latitude`/`check_in_longitude`/`check_out_latitude`/`check_out_longitude`.
- Aivin's check-in/check-out logic was specified to be built as a **modular verification 
  pipeline** — an array of small, independently named functions (e.g. 
  `verifyQrSignatureAndExpiry`, `verifyNoDuplicateScan`) run in sequence, rather than one 
  large function — so that adding `verifyFaceMatch` and `verifyGeofence` later is just 
  adding two more functions to the array, not a rewrite.
- **Nobody has built face auth or geofencing yet.** This is intentionally deferred to a 
  future phase. Do not start building it unless explicitly asked.

---

## 4. Repo Structure (confirmed from the actual GitHub repo)

**Branches:** `main`, `Templates`, `Aivin`, `Amina`, `Nandana`, `Melbin` (capitalized). 
There is also a branch called `Sentinal` (note the missing "e") — this is an old/stray 
branch and should be **ignored entirely, never merged**.

**`main` branch cleanup (completed):**
- Removed `sentinel_app/` (an old Flutter test app — confirmed not needed; the real 
  mobile app is being built in a separate repo).
- Removed unused root-level `css/style.css`, `js/app.js`, `js/dashboard.js` — confirmed 
  by inspecting all 7 real templates that none of them reference local CSS/JS files; 
  they're all self-contained (Tailwind CDN + inline `<style>`/`<script>`).
- `documentations/` folder left untouched (real project docs).

**`Templates` branch** — has a capital-T `Templates/` folder with these 7 REAL HTML 
files (exact filenames, including a typo that must NOT be "fixed" since it's the real 
filename in the repo):
- `Templates/Login_Page.html`
- `Templates/Employee_Management_Page.html`
- `Templates/QR_Generation_Page.html`
- `Templates/Daily_Attendnace_Tracking_Page.html` ← yes, "Attendnace", real filename
- `Templates/Admin_Dashboard_Page.html`
- `Templates/Security_Reports_Page.html`
- `Templates/Leave_Approval_Page.html`

**Template-to-module ownership mapping:**
| Template file | Owner |
|---|---|
| Login_Page.html | Melbin |
| Employee_Management_Page.html | Melbin |
| QR_Generation_Page.html | Aivin |
| Daily_Attendnace_Tracking_Page.html | Aivin |
| Admin_Dashboard_Page.html | Amina |
| Security_Reports_Page.html | Amina |
| Leave_Approval_Page.html | Nandana |

**Specific findings from inspecting each template (already fed into the module prompts):**
- `Admin_Dashboard_Page.html`: chart is a hand-drawn `<canvas>` script (not a charting 
  library) with hardcoded mock data `[30, 45, 55, 65, 85]` for Mon–Fri — Amina's job was 
  to replace the array with real fetched data, keep the drawing code.
- `Security_Reports_Page.html`: has a placeholder date-range-picker click handler that 
  just does `console.log(...)` — a real hook point for Amina to wire up.
- `QR_Generation_Page.html`: already has a `<table>` in it, likely a recent-scans log — 
  Aivin was told to wire it up rather than replace it.
- `Employee_Management_Page.html`: has a working table with 4 rows of mock data, but the 
  "Add Employee" button has NO form/modal behind it in the static design — Melbin had to 
  build that himself.
- `Leave_Approval_Page.html`: is a two-panel MASTER-DETAIL layout (list of request cards 
  on the left, a "Request Details" panel with Approve/Reject buttons on the right) — NOT 
  a flat table. Nandana had to wire card-click → detail-panel → approve/reject.
- None of the 7 templates have unique element IDs beyond a "tailwind-config" script tag 
  — whoever wires a page had to add their own IDs/data-attributes.

**Shared backend scaffold** (added to the `Templates` branch, so everyone gets it when 
they merge `Templates` into their own branch):
```
/modules
  /auth          (Melbin)
  /employees     (Melbin)
  /attendance    (Aivin)
  /qr            (Aivin)
  /dashboard     (Amina)
  /reports       (Amina)
  /leave         (Nandana)
/shared
  /models        (Mongoose schemas — see Section 6 for fields)
  /middleware    (auth.middleware.js)
  /config
    db.js        (MongoDB Atlas connection)
server.js         (route mounts, each commented with owner's name until they uncomment 
                   their own line)
package.json      (express, mongoose, bcrypt, jsonwebtoken, dotenv, cors, otplib, nodemon)
.env.example
SETUP.md          (MongoDB Atlas setup instructions for the team)
```

---

## 5. Database Schema (v2 — final, as delivered)

Seven core collections, MongoDB/Mongoose. Design principle: only primary keys, foreign 
keys, and security-critical fields are strictly enforced — everything else stays 
loose/nullable so the team can freely insert/delete test data during development.

**Users:** user_id (PK), name, email (unique), password_hash (bcrypt), role (enum: 
employee/manager/admin), totp_secret (nullable), totp_enabled (default false), timestamps.

**Employees:** employee_id (PK), user_id (FK→Users), department_id (FK→Departments, 
nullable), designation, contact_number (nullable, no format validation), 
date_of_joining, status (active/inactive), **reference_face_photo_url (nullable — 
RESERVED for future face-auth, not used yet)**.

**Departments:** department_id (PK), department_name (unique), manager_id (FK→Employees, 
**nullable on purpose** — breaks a circular dependency between Departments and 
Employees; seed order: create department with manager_id null → create its employees → 
update manager_id after).

**Attendance:** attendance_id (PK), employee_id (FK), date, check_in_time (nullable), 
check_out_time (nullable), working_hours (computed, nullable when checkout is null), 
status (enum: on-time/late/early-leave/on-leave/**incomplete** — used when checkout is 
still null), check_in_qr_session_id (FK), check_out_qr_session_id (FK, nullable), 
**verification_method (enum, only 'qr_only' used today — RESERVED for future 
'qr_geofence_face' value)**, **check_in_latitude/longitude, check_out_latitude/longitude 
(all nullable — RESERVED for future geofencing)**. Recommended (not hard-enforced) index 
on (employee_id, date) to catch duplicate check-ins — kept as a soft index, not a hard 
constraint, so bulk test-data inserts aren't blocked.

**QR_Sessions:** qr_session_id (PK), code_value, signature (cryptographic), 
generated_at, expires_at (a few seconds after generation).

**Leave_Requests:** leave_id (PK), employee_id (FK), leave_type (sick/casual/earned), 
start_date/end_date, reason (optional), status (pending/approved/denied), approved_by 
(FK→Employees — app layer must verify: if Manager, same department as requester; if 
Admin, any department allowed), applied_at.

**Auth_Sessions:** session_id (PK), user_id (FK), token_hash (hash of JWT, not raw 
token), **platform (enum: web/mobile — same login endpoint issues tokens for both)**, 
issued_at/expires_at.

**3NF note:** Attendance is an intentional denormalization exception — working_hours/ 
status are derived from check_in_time/check_out_time, which is a transitive dependency, 
accepted for dashboard aggregation performance, on condition the app layer always 
recomputes both on any timestamp write.

---

## 6. Key Decisions/Corrections Made Along the Way (context for "why" things are the way they are)

- Web app has NO employee-facing screens at all — employees only exist on mobile. 
  Administrators create employee accounts on web; employees then log into mobile with 
  those credentials.
- Use-case diagram was corrected: Employee is not a web actor. Web actors are Manager, 
  Administrator, and the QR-display Kiosk.
- Leave approval rule was split: Manager approvers restricted to same department as the 
  requester; Administrator approvers can approve across any department.
- TOTP should be force-prompted on first Manager/Administrator login (not left optional 
  indefinitely) — schema allows totp_enabled=false but the app logic must not let that 
  persist for those roles.
- Nandana's leave-approval endpoint is the ONE place a module writes into another 
  module's data (writes 'on-leave' status into Attendance, owned by Aivin) — this was 
  explicitly flagged as the sole intentional cross-module write in the project.

---

## 7. Merge Plan (about to be executed — this is the current/next phase)

Merge order matters because of dependencies. One branch at a time, testing after each, 
NOT all four at once:

1. **Melbin → main** (auth — everything else depends on it). Test: server boots, login 
   works, TOTP setup works, employee/department CRUD works.
2. **Aivin → main**. Test: QR rotates, check-in/check-out works via API, expired/fake 
   signature rejected.
3. **Nandana → main** (leave — depends on Aivin's Attendance model existing first). 
   Test: submit + approve a leave request, confirm Attendance shows 'on-leave' for those 
   dates.
4. **Amina → main** (dashboard — reads from everyone, merges last). Test: dashboard 
   numbers reflect real test data, not zeros.

After all four: one full manual end-to-end pass — login → check-in → apply & approve 
leave → dashboard reflects it all — before considering the integration done.

**Status as of this handoff:** Aivin, Amina, and Nandana's branches are ready to merge 
as-is. Melbin's structural restructure (moving his auth/employee code onto the shared 
scaffold) has been run and is functionally verified, but has leftover files that still 
need deleting — that cleanup is now built into the first step of Prompt A itself, so no 
separate action is needed. Full current status and verification details: Section 10.

**UPDATE:** Merge prompt (Prompt A, `EAMS_Antigravity_Prompts_v4_Merge_and_Mobile.md`) 
is ready to run, following this exact order and test checklist. It includes: the Melbin 
cleanup as a required first step; a `MERGE_PROGRESS.md` file (created at the repo root, 
updated + committed after every step) so an interrupted session can resume from the 
correct branch instead of restarting or re-merging; and a final wiring check after all 
four branches are in (confirms all route mounts exist/aren't duplicated, every 
`require()` path resolves, only one DB connection). Not yet confirmed executed — update 
this line to "COMPLETED" once the full four-branch merge + end-to-end pass has actually 
been run and passed. There's also a **Prompt C** for checking/pushing Nandana's work 
(already used successfully — see Section 10) and a **Prompt D** for Melbin's restructure 
(already run — see Section 10).

---

## 8. Troubleshooting Quick-Reference (for when merge errors come up)

- Git push permission denied → use a GitHub Personal Access Token, or `gh auth login`.
- Push rejected (non-fast-forward) → `git pull --rebase origin <branch>`, resolve, push.
- Merge conflict → resolve `<<<<<<<`/`=======`/`>>>>>>>` markers manually, `git add`, 
  `git commit`.
- MongoDB connection fails → check MONGO_URI matches the shared Atlas string exactly, 
  Atlas Network Access allows 0.0.0.0/0, password has no unencoded special characters.
- Port already in use → change PORT in `.env`, or kill the old process.
- npm install fails → delete `node_modules` + `package-lock.json`, reinstall, confirm 
  Node 18+.
- JWT errors → confirm everyone's `.env` has the SAME agreed JWT_SECRET, and requests 
  send `Authorization: Bearer <token>`.
- CORS errors → confirm `cors()` middleware is applied before routes are mounted.

---

## 9. Mobile App — Architecture Change + v1 Scope (NEW, this session)

**Architecture decision CHANGED — flagging explicitly since Section 2 above said the 
opposite and that was previously "confirmed, don't re-litigate":**
- OLD decision (Section 2, now superseded for the mobile app's location only): mobile 
  app is a completely separate repository, not part of Sentinel-Attendance.
- NEW decision (this session): mobile app lives in a `mobile` branch **inside** the 
  Sentinel-Attendance repo, under a `/mobile` folder at the repo root. Everything else 
  from Section 2 still holds — Flutter, employees-only, calls the same Express REST API, 
  never writes to MongoDB directly.
- Reason for the change: not stated by the team, just a direct instruction to switch to 
  a branch-based approach. If this causes friction later (e.g. mixing a Flutter project 
  and a Node project in one repo's tooling/CI), that trade-off wasn't discussed — worth 
  revisiting if it becomes a problem.

**v1 scope decision (this session):** the mobile app's first build is intentionally 
narrow — login + QR scan to check in/check out, nothing else. This differs from what was 
implied during the leave-module build: Nandana's `POST /api/leave` (Module 4, Leave 
Management — see the ownership correction directly below) was originally commented as 
"called by the mobile app." That mobile-submission use case is deferred to a v2, not 
built in v1. The backend endpoint already exists and is unaffected — only the mobile 
client doesn't call it yet.

**Mobile app v1 build plan:** see Prompt B in `EAMS_Antigravity_Prompts_v4_Merge_and_
Mobile.md` — Flutter, `dio` for networking, `flutter_secure_storage` for the JWT, 
`mobile_scanner` for QR capture. Three screens: login, home (today's status + 
check-in/out button), scanner. Branch created off `main` (assumes `main` is fully merged 
and tested first — see Section 7 merge order).

**Status:** branch/prompt written, not yet executed as of this handoff.

---

## 10. Module Ownership — CONFIRMED and CORRECTED (this session)

**Final, confirmed module ownership** (Section 1's original table was correct all 
along):
- Melbin Paul — **Module 1: User Authentication & Employee Management**
- Aivin Jinu — Module 2: Smart Attendance & QR Verification
- Amina Salim — Module 3: Admin Dashboard & Analytics
- Nandana Rajendran — **Module 4: Leave Management & Employee Self-Service**

**What happened:** `EAMS_Antigravity_Prompts_v3.md` (the original build prompts) and 
`EAMS_Updated_Abstract_and_Table_Design.docx` both had Module 1 and Module 4 swapped 
(Nandana = auth, Melbin = leave) — the opposite of Section 1 above and the opposite of 
what's actually on the real GitHub branches. Both documents have now been corrected to 
match reality:
- `EAMS_Updated_Abstract_and_Table_Design.docx` — Module 1/4 owner names swapped back, 
  validated, and visually confirmed.
- `EAMS_Antigravity_Prompts_v3.md` — every Nandana/Melbin reference swapped throughout 
  (branch names, route-mount comments, Prompt 1 and Prompt 4 headers/bodies, merge-order 
  list, and one leftover gendered pronoun that needed fixing after the swap).
- `EAMS_Antigravity_Prompts_v4_Merge_and_Mobile.md` (the merge/mobile prompts written 
  this session) already had the correct ownership from the start — no changes needed 
  there.

**Verified directly from the live GitHub repo** (via `git ls-remote` + clone, not just 
inference from documents), as of this session:
- **Melbin's branch — restructure RUN and PARTIALLY VERIFIED, this session.** 
  Originally found: real Auth & Employee Management code (`backend/routes/auth.js`, 
  `employees.js`, `departments.js`, `middleware/auth.js`, `roles.js`, TOTP setup/verify 
  pages) existed but lived in his own `backend/` folder, not the shared `/modules` + 
  `/shared` Templates scaffold that Aivin, Amina, and Nandana used. Decision made: 
  Option 1 — Antigravity investigates + restructures automatically (Prompt D in 
  `EAMS_Antigravity_Prompts_v4_Merge_and_Mobile.md`), with a human diff review after.
  Prompt D has been run. **Verified directly on GitHub afterward (commit `ece742f`):**
  - Done correctly: `modules/auth/controller.js` + `routes.js` (152+16 lines), 
    `modules/employees/controller.js` + `routes.js` (218+37 lines), 
    `shared/middleware/auth.middleware.js` (50 lines, consolidated), both route mounts 
    live and uncommented in `server.js`.
  - NOT done — cleanup incomplete: the old `backend/` folder (with its own `db.js`, 
    `server.js`, `routes/`, `middleware/`) is still present, orphaned/unused. The old 
    root-level `index.html`, `employees.html`, `totp-setup.html`, `totp-verify.html`, 
    `dashboard.html`, `css/`, `js/` are also still present, duplicating what now lives in 
    `modules/` and `Templates/`.
  - **Fix folded into Prompt A itself** (not a separate step anymore): Prompt A's first 
    instruction, before the merge order begins, is to delete these leftovers on `Melbin`, 
    confirm the app still boots/logs in after deleting them, and push — then proceed with 
    the merge. **No separate action needed; just run Prompt A.**
- **Aivin's branch**: Attendance + QR, properly built on the shared scaffold (259 + 97 + 
  150 lines across controller/service/verification files). Open PR #1. No issues.
- **Amina's branch**: Dashboard + Reports, properly built on the shared scaffold (353 + 
  266 lines). No issues.
- **Nandana's branch — CONFIRMED COMPLETE, this session.** Verified directly on 
  GitHub (commit `f0f5eb3`, "Implement Leave Management backend and frontend 
  integration"): `modules/leave/controller.js` (634 lines), `routes.js` (73 lines), a 
  new `authHelpers.js` (89 lines), route mounted and uncommented in `server.js`, 
  `Templates/Leave_Approval_Page.html` wired to the API. Core spec matched exactly: 
  department-based approval rule (manager = same department only, admin = any) and the 
  cross-module Attendance `on-leave` reconciliation write, both implemented correctly. 
  **Ready to merge.**
  - Two additions beyond the original Prompt 4 spec, flagged for awareness, not 
    blockers: (1) a `LeaveBalance` model + `GET /api/leave/balance` endpoint 
    (sick/casual/earned day allocations) — the original spec said no balance/accrual 
    system was needed for this capstone, so this is extra scope, keep-or-trim is a call 
    for the person to make; (2) `authHelpers.js` has a clearly-commented temporary 
    dev-mode auth bypass (`x-user-id`/`x-user-role` headers) standing in until Melbin's 
    real JWT middleware is merged — well-labeled as "remove once real auth is live," but 
    a loose end to close once his branch merges.
  - Minor cosmetic issue: the route-mount comment in her `server.js` still says 
    `// Melbin` (leftover from the pre-correction module-ownership mixup) even though 
    the route is hers and working — harmless, but worth a one-line fix during merge.
**Bottom line, updated:** Aivin, Amina, and Nandana are ready to merge as-is. Melbin's 
restructure is functionally done and verified, just needs the leftover-file cleanup — 
which is now built into the start of Prompt A. **All four branches are effectively ready 
— running Prompt A (which starts with the Melbin cleanup) is the next and only remaining 
step before `main` is fully integrated.**

---

## 11. What to Upload in the New Chat

To get full context without re-explaining anything, upload these files alongside this 
memory document:

1. **This file** (`Sentinel_Project_Memory.md`) — the master context.
2. **`EAMS_Updated_Abstract_and_Table_Design.docx`** — the full formatted abstract + 
   database schema document (Section 5 above is a condensed version of this).
3. **`EAMS_Antigravity_Prompts_v3.md`** — the four detailed build prompts already used 
   by the team (useful if any module needs rework, or for reference on exact endpoint 
   specs/file ownership when debugging merge issues).
4. **`EAMS_Antigravity_Prompts_v4_Merge_and_Mobile.md`** — the current-phase prompts: 
   Prompt A merges all four branches into `main`, Prompt B builds the v1 Flutter mobile 
   app on a `mobile` branch. Needed for anything merge- or mobile-related.

Optional, only if relevant to what you're doing next:
5. The original 7 uploaded template HTML files (`Login_Page.html`, 
   `Employee_Management_Page.html`, `QR_Generation_Page.html`, 
   `Daily_Attendnace_Tracking_Page.html`, `Admin_Dashboard_Page.html`, 
   `Security_Reports_Page.html`, `Leave_Approval_Page.html`) — only needed if you're 
   troubleshooting something specific to one page's structure; not needed for general 
   merge-debugging help.

**Note for mid-merge recovery:** once Prompt A has been run at least once, check 
`MERGE_PROGRESS.md` at the repo root on `main` (not this memory file) for exactly which 
branches are already merged and tested — it's the source of truth for merge state, this 
memory file just tracks the higher-level project decisions.

**Suggested first message in the new chat:** "Continuing the Sentinel EAMS capstone 
project — see attached memory file for full context, and keep it updated as we go per 
the instruction at the top of it. We're now at the merge phase (Section 7 in the memory 
file). [describe whatever error or question you actually have]."
