# Sentinel Attendance System - Comprehensive Technical Project Report

---

## 1. Executive Summary & System Architecture

**Sentinel** is an enterprise-grade Attendance and Workforce Management System engineered for high security, operational transparency, and tamper-resistant physical presence verification. Conventional attendance methods (such as paper logs, static QR codes, or unverified RFID cards) are vulnerable to buddy punching, screenshot sharing, and replay attacks. Sentinel mitigates these vulnerabilities by introducing:

1. **Cryptographically Signed, Rotating Dynamic QR Codes**: Server-generated, time-bounded QR sessions signed with HMAC-SHA256 that refresh continuously, rendering screenshots and recorded videos obsolete.
2. **Two-Tier Authentication with TOTP 2FA**: Strict identity gating for administrative and management tiers using RFC 6238 Time-Based One-Time Passwords (compatible with Google Authenticator, Authy, etc.).
3. **Pluggable Verification Pipeline**: An extensible, sequential pipeline architecture (`verificationSteps.js`) governing check-ins and check-outs that validates cryptographic signatures, session TTLs, duplicate scan constraints, and prerequisite attendance states.
4. **Cross-Module Cohesion & Aggregation**: Unified handling of leaves and attendance, automatically synchronizing approved absences into attendance calendars and aggregating real-time analytics for executive dashboards and compliance CSV exports.

### 1.1 Architectural Pattern: Modular Monolith

Sentinel adopts a **Modular Monolith** architecture. While running inside a single Node.js runtime for operational simplicity and minimal latency, the codebase is partitioned into distinct domain modules (`modules/attendance`, `modules/auth`, `modules/dashboard`, `modules/employees`, `modules/leave`, `modules/qr`, `modules/reports`). 

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Client Interfaces                               │
│   ┌───────────────────────────┐             ┌───────────────────────────┐   │
│   │   Mobile Scanner Client   │             │ Admin & Manager Web Kiosk │   │
│   │   (Employee Attendance)   │             │   (Dashboards & Leaves)   │   │
└─────────────────┬─────────────────────────────┬─────────────────────────────┘
                  │ HTTPS / JSON                │ HTTPS / JSON
                  ▼                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Sentinel Express Gateway                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Middlewares: rateLimiter, authenticateToken, roleCheck, Cache-Control  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                               Domain Modules                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Auth Module  │  │  QR Engine   │  │  Attendance  │  │  Leave Manager  │  │
│  │ (JWT & TOTP) │  │  (HMAC Loop) │  │  (Pipeline)  │  │ (Sync & Balances)│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                       │
│  │  Dashboard   │  │  Employees   │  │   Reports    │                       │
│  │ (Aggregator) │  │ (Directory)  │  │(CSV Streamer)│                       │
│  └──────────────┘  └──────────────┘  └──────────────┘                       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Mongoose ORM
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Database Layer (MongoDB)                          │
│   Collections: Users, Employees, Departments, Attendance, LeaveRequests,   │
│                LeaveBalances, QRSessions, AuthSessions                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack & Framework Justifications

| Tier | Technology | Justification & Role |
| :--- | :--- | :--- |
| **Runtime Environment** | **Node.js (v18+)** | Asynchronous, event-driven I/O engine capable of executing real-time background processes alongside non-blocking HTTP request processing. |
| **Backend Framework** | **Express.js** | Minimalist and battle-tested HTTP routing framework. Powers RESTful endpoints, middleware chaining, and modular route composition. |
| **Primary Database** | **MongoDB (via Mongoose)** | Document-oriented NoSQL database. Ideal for heterogeneous records, sub-document population (`populate`), indexing TTL records, and multi-field date range queries. |
| **In-Memory Fallback** | **`mongodb-memory-server`** | Embedded MongoDB instance that automatically bootstraps when cloud Atlas clusters are unreachable, ensuring frictionless development and automated test passes. |
| **Frontend Foundation** | **HTML5 / Vanilla JavaScript (ES6+)** | Zero-build complexity, instant browser reloads, maximum execution performance, and native DOM manipulation without heavy front-end virtual-DOM overhead. |
| **Frontend Styling** | **Tailwind CSS (CDN)** | Utility-first CSS framework providing a cohesive modern design system, responsive flexbox/grid layouts, and consistent spacing across all dashboard views. |
| **Data Visualizations** | **HTML5 Canvas API** | Lightweight, dependency-free rendering engine for customized attendance trend graphs, status distribution donut charts, and department progress bars. |
| **Cryptographic Security** | **Node.js `crypto`** | Native cryptographic library used to generate 32-byte pseudo-random tokens and compute HMAC-SHA256 signatures for QR integrity verification. |
| **Password Security** | **`bcryptjs`** | Adaptive one-way hashing function utilizing salt rounds to protect stored credentials against rainbow table and dictionary attacks. |
| **State-less Sessions** | **`jsonwebtoken` (JWT)** | Compact, URL-safe tokens enabling stateless authentication. Implements a 2-tier token model (10-minute temporary tokens for 2FA onboarding; 8-hour full tokens for authorized sessions). |
| **Two-Factor Auth** | **`otplib` & `qrcode`** | RFC 6238 compliant Time-Based One-Time Password generator coupled with a QR data URL generator for seamless pairing with mobile authenticator apps. |
| **DoS Mitigation** | **`express-rate-limit`** | IP-based request throttling applied to authentication routes to defend against automated credential-stuffing and brute-force attacks. |

---

## 3. Annotated Directory Structure

```text
Sentinel-Attendance/
├── modules/                               # Domain-driven backend modules
│   ├── attendance/                        # Attendance logging & verification
│   │   ├── controller.js                  # Check-in/out logic, hours calculation, record queries
│   │   ├── routes.js                      # Route definitions for /api/attendance
│   │   └── verificationSteps.js           # Chain-of-responsibility verification pipeline
│   ├── auth/                              # Authentication & Authorization
│   │   ├── controller.js                  # Login, 2-tier JWT issuance, TOTP setup/verify
│   │   └── routes.js                      # Endpoints for /api/auth
│   ├── dashboard/                         # Analytics & Administrative Aggregations
│   │   ├── controller.js                  # Daily summaries, 7/30-day trends, late arrival lists
│   │   └── routes.js                      # Endpoints for /api/dashboard
│   ├── employees/                         # Organizational Directory & User Management
│   │   ├── controller.js                  # Employee CRUD, department associations, status changes
│   │   └── routes.js                      # Endpoints for /api/employees & /api/departments
│   ├── leave/                             # Leave Management & Attendance Synthesis
│   │   ├── controller.js                  # Application submission, overlap checks, approvals
│   │   └── routes.js                      # Endpoints for /api/leave
│   ├── qr/                                # Dynamic Rotating QR Subsystem
│   │   ├── controller.js                  # Current QR retrieval, live scan log streaming
│   │   └── service.js                     # Background rotation loop (HMAC generation & TTLs)
│   └── reports/                           # Audit Reporting & Data Export
│       ├── controller.js                  # Dynamic CSV formatting and organization-wide queries
│       └── routes.js                      # Endpoints for /api/reports
├── shared/                                # Reusable infrastructural layers
│   ├── config/                            # Environment and database drivers
│   │   └── db.js                          # MongoDB connection with fallback memory server
│   ├── middleware/                        # Express middleware suite
│   │   └── auth.middleware.js             # Token decoding, role verification, temporary token traps
│   └── models/                            # Mongoose schemas and ODM models
│       ├── Attendance.js                  # Attendance log schema (dates, times, status, QR refs)
│       ├── AuthSession.js                 # Active login session tracker
│       ├── Department.js                  # Corporate department designations
│       ├── Employee.js                    # Profile data linked to User and Department
│       ├── LeaveBalance.js                # Leave quotas (sick, casual, earned) and usage counters
│       ├── LeaveRequest.js                # Leave applications, date ranges, and approval statuses
│       ├── QRSession.js                   # Ephemeral rotating QR codes with HMAC signatures
│       └── User.js                        # Security credentials, roles, and TOTP secrets
├── Templates/                             # Frontend user interfaces (HTML/JS/CSS)
│   ├── shared/                            # Global frontend assets
│   │   ├── auth.js                        # Client-side JWT interceptor, bfcache back-navigation defense
│   │   ├── navbar.html                    # Reusable top navigation markup
│   │   └── sidebar.html                   # Reusable administrative sidebar markup
│   ├── Admin_Dashboard_Page.html          # High-level operational overview & KPI widgets
│   ├── Daily_Attendnace_Tracking_Page.html# Live monitoring of employee arrivals and departures
│   ├── Employee_Management_Page.html      # Directory management, employee onboarding/editing
│   ├── Leave_Approval_Page.html           # Managerial review portal for pending leave requests
│   ├── Login_Page.html                    # Multi-step authentication view (Password + TOTP)
│   ├── QR_Attendance_Scan_Page.html       # Public Kiosk display projecting rotating dynamic QR
│   ├── Reports_Page.html                  # Filterable audit reports with CSV download buttons
│   └── TOTP_Setup_Page.html               # 2FA onboarding interface with authenticator QR modal
├── server.js                              # Application entry point, module mounting, static assets
├── package.json                           # Dependencies, scripts, and runtime engines
└── Sentinel_Project_Memory.md             # Continuous architectural decisions & operational logs
```

---

## 4. Comprehensive Data Models & Database Schemas

### 4.1. `User` Schema (`shared/models/User.js`)
*Represents system credentials and security attributes.*
- `name` (String, Required): Full legal name.
- `email` (String, Required, Unique, Lowercase): Primary login identifier.
- `password_hash` (String, Required): Salted bcrypt hash of the password.
- `role` (String, Enum: `['admin', 'manager', 'employee']`, Default: `'employee'`): Access authorization level.
- `totp_secret` (String, Nullable): Base32 secret key for RFC 6238 TOTP computation.
- `totp_enabled` (Boolean, Default: `false`): Flags whether 2FA verification is mandatory on login.

### 4.2. `Employee` Schema (`shared/models/Employee.js`)
*Represents operational profile details.*
- `user_id` (ObjectId -> `User`, Required, Unique): Foreign reference to the authentication account.
- `department_id` (ObjectId -> `Department`, Required): Organizational division.
- `designation` (String, Required): Professional job title.
- `date_of_joining` (Date, Required): Employment start date.
- `contact_number` (String): Emergency/mobile phone number.
- `status` (String, Enum: `['active', 'inactive', 'terminated']`, Default: `'active'`).

### 4.3. `Attendance` Schema (`shared/models/Attendance.js`)
*The atomic record of employee presence for a specific calendar date.*
- `employee_id` (ObjectId -> `Employee`, Required, Indexed): Employee reference.
- `date` (Date, Required, Indexed): Normalized UTC midnight timestamp representing the calendar day.
- `check_in_time` (Date, Nullable): Exact timestamp when check-in was registered.
- `check_out_time` (Date, Nullable): Exact timestamp when check-out was registered.
- `check_in_qr_session_id` (ObjectId -> `QRSession`): Reference to the QR session scanned at check-in.
- `check_out_qr_session_id` (ObjectId -> `QRSession`): Reference to the QR session scanned at check-out.
- `status` (String, Enum: `['on-time', 'late', 'early-leave', 'half-day', 'absent', 'on-leave', 'incomplete']`): Evaluated attendance status.
- `working_hours` (Number, Default: `0.0`): Total decimal hours between check-in and check-out.
- `verification_method` (String, Enum: `['qr_only', 'qr_and_geofence', 'manual']`, Default: `'qr_only'`).

### 4.4. `QRSession` Schema (`shared/models/QRSession.js`)
*Short-lived cryptographic session tokens.*
- `code_value` (String, Required): 64-character hexadecimal cryptographically random string.
- `signature` (String, Required): HMAC-SHA256 digest of the `code_value`.
- `generated_at` (Date, Default: `Date.now`): Creation timestamp.
- `expires_at` (Date, Required, Indexed): TTL timestamp (typically `generated_at + 10 seconds`).

### 4.5. `LeaveRequest` Schema (`shared/models/LeaveRequest.js`)
*Employee time-off applications.*
- `employee_id` (ObjectId -> `Employee`, Required, Indexed).
- `leave_type` (String, Enum: `['sick', 'casual', 'earned']`, Required).
- `start_date` (Date, Required): Start date normalized to UTC midnight.
- `end_date` (Date, Required): End date normalized to UTC midnight.
- `reason` (String, Required): Narrative explanation.
- `status` (String, Enum: `['pending', 'approved', 'rejected']`, Default: `'pending'`).
- `reviewed_by` (ObjectId -> `User`, Nullable): Manager/Admin who adjudicated the request.
- `reviewed_at` (Date, Nullable).

### 4.6. `LeaveBalance` Schema (`shared/models/LeaveBalance.js`)
*Tracks allocated vs. consumed leave allowances.*
- `employee_id` (ObjectId -> `Employee`, Required).
- `leave_type` (String, Enum: `['sick', 'casual', 'earned']`, Required).
- `total` (Number, Default quotas: Sick: 12, Casual: 12, Earned: 15).
- `used` (Number, Default: 0).
- `year` (Number, Default: Current calendar year).

---

## 5. Core Mathematical & Algorithmic Foundations

```
                        DYNAMIC QR LIFECYCLE & VERIFICATION
 ┌────────────────┐      HMAC-SHA256(code_value, secret)      ┌───────────────────┐
 │ Background Loop│ ─────────────────────────────────────────> │   New QRSession   │
 │ (Every 5s)     │                                            │ TTL: 10s Window   │
 └────────────────┘                                            └─────────┬─────────┘
                                                                         │
                                                                  Kiosk Displays
                                                                         │
                                                                         ▼
                                                               ┌───────────────────┐
                                                               │  Employee Mobile  │
                                                               │  Camera Scans QR  │
                                                               └─────────┬─────────┘
                                                                         │
                   POST /api/attendance/checkin                          │
           { qr_session_id, code_value, signature }                     │
   ┌─────────────────────────────────────────────────────────────────────┘
   ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                          VERIFICATION PIPELINE                                  │
 │                                                                                 │
 │  Step 1: Check Database Match         Step 2: Recompute HMAC     Step 3: TTL    │
 │  ┌───────────────────────────┐        ┌───────────────────────┐  ┌───────────┐  │
 │  │ QRSession.findById(id)    │ ────>  │ HMAC(code, secret)    │─>│ now <     │  │
 │  │ code_value == stored.code │        │   === signature       │  │ expires_at│  │
 │  └───────────────────────────┘        └───────────────────────┘  └─────┬─────┘  │
 │                                                                        │ Pass   │
 │                                                                        ▼        │
 │                                                              ┌───────────────┐  │
 │  Step 4: Duplicate Prevention                                │ Attendance    │  │
 │  Attendance.findOne(empId, todayStart, check_in != null)     │ Record Saved  │  │
 │  Assert: record == null                                      └───────────────┘  │
 └─────────────────────────────────────────────────────────────────────────────────┘
```

### 5.1. Dynamic QR Rotation & Cryptographic Anti-Replay Algorithm

Static QR codes are fundamentally vulnerable to physical interception: a single photo sent via messaging platforms allows remote employees to falsely register attendance. Sentinel prevents this via dynamic, signed sessions.

#### Algorithm Steps:
1. **Entropy Generation**: Every $T_{\text{rotate}} = 5$ seconds, the server draws 32 bytes of cryptographically secure pseudo-random entropy:
   $$\text{code\_value} = \text{HexEncode}(\text{crypto.randomBytes}(32))$$
2. **Cryptographic Signing**: An HMAC-SHA256 signature is calculated over the token using a server-side secret key $K_{\text{secret}}$:
   $$\text{signature} = \text{HMAC-SHA256}(K_{\text{secret}}, \text{code\_value})$$
3. **Time-Bounded Validity**: The session is assigned a strictly enforced expiration timestamp:
   $$t_{\text{expires}} = t_{\text{now}} + T_{\text{expiry}} \quad \text{where } T_{\text{expiry}} = 10\text{ seconds}$$
4. **Validation Pipeline**: When a client presents a scan payload $(\text{id}, \text{code\_value}, \text{signature})$:
   - The server queries `QRSession` by $\text{id}$.
   - It performs constant-time comparison of `code_value` against stored data.
   - It re-computes $\text{HMAC-SHA256}(K_{\text{secret}}, \text{code\_value})$ and asserts exact equality with the submitted signature.
   - It verifies that $t_{\text{current}} \le t_{\text{expires}}$. If $t_{\text{current}} > t_{\text{expires}}$, HTTP `410 Gone` is returned.

---

### 5.2. Time-Based One-Time Password (TOTP) Algorithm (RFC 6238)

Used to protect administrative accounts from credential stuffing.

1. **Shared Secret Generation**: A high-entropy Base32 secret string $S$ is generated and associated with the user record.
2. **Time Window Quantification**: Unix epoch time is divided into 30-second discrete steps:
   $$T = \left\lfloor \frac{\text{UnixTime}()}{30} \right\rfloor$$
3. **HMAC-SHA1 Computation**:
   $$H = \text{HMAC-SHA1}(S, T)$$
4. **Dynamic Truncation**: The last 4 bits of the 20-byte hash $H$ determine an offset index $O = H[19] \land \text{0x0F}$. A 31-bit integer is extracted from bytes $O$ through $O+3$:
   $$\text{Code} = \left( (H[O] \land \text{0x7F}) \ll 24 \mid (H[O+1] \land \text{0xFF}) \ll 16 \mid (H[O+2] \land \text{0xFF}) \ll 8 \mid (H[O+3] \land \text{0xFF}) \right) \pmod{10^6}$$
5. **Two-Tier Authentication Pipeline**:
   - Step 1: User submits `email` + `password`. If valid, the system determines if `totp_enabled` is active.
   - Step 2: Instead of issuing a full access token, the system returns a **temporary JWT** (`{ temp: true, expiresIn: '10m' }`).
   - Step 3: Client exchanges the temporary JWT + 6-digit TOTP code via `POST /api/auth/totp/verify`. Once validated, the server returns the **full JWT** (`{ expiresIn: '8h' }`).

---

### 5.3. Dynamic Attendance State Machine & Workday Calculation

The status of an attendance record is computed deterministically through a state machine based on corporate thresholds:
- **$\text{Cutoff Time}$ ($T_{\text{cutoff}}$)**: Set by default to `09:00 AM UTC`.
- **$\text{Standard Workday}$ ($H_{\text{standard}}$)**: 8.0 hours.

```
       [SCAN CHECK-IN]
              │
              ▼
   Is Check-in Time <= 09:00?
        ├── YES ──> Status = 'on-time'
        └── NO  ──> Status = 'late'
              │
              │  (Employee Works Shift)
              │  Record Status in DB = 'incomplete' (if check-out is pending)
              ▼
       [SCAN CHECK-OUT]
              │
              ▼
   Compute Working Hours:
   W = (t_checkout - t_checkin) in hours
              │
              ▼
   Is W < 8.0 Hours?
        ├── YES ──> Status = 'early-leave'
        └── NO  ──> Status = (Check-in was 'late' ? 'late' : 'on-time')
```

#### Working Hours Formulation:
$$W = \text{round}\left(\frac{t_{\text{checkout}} - t_{\text{checkin}}}{1000 \times 60 \times 60}, 2\right)$$

---

## 6. Deep Module-by-Module Technical Breakdown

### 6.1. Auth Module (`modules/auth/`)
- **Perimeter Defense**: Rate-limiting middleware caps failed login attempts to 10 requests per 15-minute window per IP.
- **Two-Tier JWT Pipeline**: 
  - Standard user endpoints reject any token carrying `temp: true`.
  - Temporary tokens are only accepted at `/api/auth/totp/verify` and `/api/auth/totp/setup`.
- **Bfcache Defense (Client Navigation)**: Implemented in `Templates/shared/auth.js`. Modern browsers use backward-forward caching (bfcache) which snapshots the DOM. If a user logs out and hits the browser's "Back" button, bfcache could display confidential dashboard data. Sentinel attaches a `window.addEventListener('pageshow', (event) => { if (event.persisted && !getToken()) window.location.replace('/login'); })` listener and issues `Cache-Control: no-store, no-cache, must-revalidate` HTTP headers, forcing an immediate re-check.

### 6.2. QR Module (`modules/qr/`)
- **Lazy Evaluation (On-Demand Resiliency)**: In `getOrCreateCurrentSession()`, QR sessions are evaluated lazily. The system automatically synthesizes a fresh, cryptographically-signed session on demand if the database has no valid, non-expired session, rather than continuously polling or spinning CPU cycles.
- **Live Kiosk Stream**: Powers `Templates/QR_Attendance_Scan_Page.html` by exposing `/api/qr/current` for the QR code display and `/api/qr/recent-scans` which populates a live table of the last 10 entries.

### 6.3. Attendance Module (`modules/attendance/`)
- **Pluggable Verification Pipeline (`verificationSteps.js`)**: Encapsulates verification as an array of decoupled, asynchronous steps:
  - `verifyQrSignatureAndExpiry`: Validates token existence, HMAC hash match, and TTL.
  - `verifyNoDuplicateCheckin`: Confirms the employee does not already have a check-in logged for the calendar day.
  - `verifyCheckoutPreconditions`: Asserts that an existing check-in record exists for today and that `check_out_time` is currently empty.
- **Flexible Filter Queries**: `getAttendanceRecords` supports composite filtering by `employee_id`, explicit single `date`, or date ranges (`start_date`, `end_date`), automatically joining `Employee` and `User` models via Mongoose `populate`.

### 6.4. Leave Management Module (`modules/leave/`)
- **Date Normalization Engine**: All incoming dates (`start_date`, `end_date`) are normalized to UTC midnight (`00:00:00.000Z`) via `toMidnightUTC()` to eliminate timezone mismatches.
- **Overlap Collision Detection**: Queries existing requests for the employee where `status` is `pending` or `approved` and matches:
  $$\text{existing.start\_date} \le \text{new.end\_date} \quad \text{AND} \quad \text{existing.end\_date} \ge \text{new.start\_date}$$
- **Cross-Module Attendance Synthesis**: When a manager calls `approveLeave`:
  1. The leave balance is atomically decremented in `LeaveBalance`.
  2. For every calendar day in $[\text{start\_date}, \text{end\_date}]$, an Attendance document is upserted with `status: 'on-leave'`. If a record already exists, its timestamps are preserved while its status is updated to reflect approved leave.

### 6.5. Dashboard & Analytics Module (`modules/dashboard/`)
- **Direct Database Aggregations**: Bypasses internal HTTP roundtrips in favor of direct Mongoose query pipelines.
- **Real-Time Today Metrics**:
  - Total active employee count.
  - On-time, late, early-leave, incomplete, and on-leave tallies.
  - Real-time absent calculation:
    $$\text{Absent} = \text{Total Active Employees} - (\text{Present Employees} \cup \text{Approved Leave Employees})$$
- **Late Arrivals Inspector**: Identifies all check-ins past 09:00 AM and computes exact tardiness in minutes:
  $$\text{Late Minutes} = \text{round}\left(\frac{t_{\text{checkin}} - t_{\text{09:00 AM}}}{1000 \times 60}\right)$$
- **Historical Trends (7-Day & 30-Day)**: Iterates across the preceding date range, grouping daily records to compute presence percentages and department-wise attendance rates.

### 6.6. Employee Management Module (`modules/employees/`)
- **Dual Entity Management**: Synchronizes the creation of the security entity (`User`) and the organizational profile entity (`Employee`).
- **Department Association**: Links employees to departments, enabling group-level metrics, permission inheritance, and managerial oversight.
- **Status Lifecycle**: Supports transitioning employees between `active`, `inactive`, and `terminated` states, which dynamically influences dashboard denominators and attendance tracking.

### 6.7. Reports & Compliance Module (`modules/reports/`)
- **Dual Format Output**: Supports both `format=json` (for UI consumption) and `format=csv` (for direct file downloads).
- **Sanitized CSV Streamer**:
  - Implements cell value escaping (`escapeCsvValue`) to prevent CSV injection vulnerabilities.
  - Dynamically builds organization summaries, department performance metrics, and individual employee attendance logs.
  - Streams HTTP headers `Content-Type: text/csv` and `Content-Disposition: attachment; filename="Sentinel_Attendance_Report.csv"`.

---

## 7. Security Architecture & Threat Mitigation Matrix

| Threat / Attack Vector | Severity | Vulnerability Mechanism | Sentinel Countermeasure & Mitigation |
| :--- | :--- | :--- | :--- |
| **QR Screenshot Sharing ("Buddy Punching")** | **High** | An absent employee scans a screenshot of a QR code forwarded by a colleague at the office. | **Dynamic Session TTL (10s) & HMAC-SHA256**: Codes expire within seconds. By the time a screenshot is taken, transmitted, and scanned, the session is rejected as `410 Gone`. |
| **Credential Stuffing & Brute-Force** | **High** | Automated scripts hammering `/api/auth/login` with breached password lists. | **Rate-Limiting Middleware**: `express-rate-limit` throttles IPs exceeding 10 requests per 15 minutes. |
| **Administrative Session Hijacking** | **Critical** | Attacker obtains an admin's password via phishing or keylogging. | **Mandatory RFC 6238 TOTP 2FA**: Admin and Manager roles must provide a dynamic 6-digit TOTP code generated on a separate physical device. |
| **Post-Logout Browser Navigation (bfcache)** | **Medium** | An employee logs out on a shared terminal; next user clicks the browser's "Back" button to see cached dashboard data. | **Cache-Control & Client-Side Token Interceptors**: Backend emits `no-store` headers; frontend binds `pageshow` listener to clear cached DOMs and force redirect if the token is missing. |
| **QR Replay & Tampering** | **High** | Attacker intercepts a valid QR payload and modifies `qr_session_id` or `code_value`. | **Cryptographic Signature Validation**: The server re-computes the HMAC digest using the private secret. Any payload tampering produces an invalid signature (`401 Unauthorized`). |
| **Duplicate Check-In Race Conditions** | **Medium** | Multiple rapid scan requests sent simultaneously for the same employee. | **Verification Pipeline Duplicate Checks**: Database queries verify that no existing check-in record exists for that employee on the current UTC date. |
| **CSV Injection** | **Low** | Malicious users input names starting with `=`, `+`, or `-`, executing formulas in Microsoft Excel. | **Cell Sanitization**: The Reports module sanitizes and quotes all CSV fields using `escapeCsvValue()`. |

---

## 8. Step-by-Step System Workflows

### 8.1. End-to-End Employee Check-In Sequence

```
Employee App                  Entrance Kiosk                 Sentinel Backend               Database
     │                              │                               │                          │
     │                              │ <── GET /api/qr/current ───── │                          │
     │                              │ ─── Displays Rotating QR ──── │                          │
     │                              │                               │                          │
     │ ──── Scans Displayed QR ───> │                               │                          │
     │                              │                               │                          │
     │ ──── POST /api/attendance/checkin ─────────────────────────> │                          │
     │      Payload: { qr_session_id, code_value, signature }       │                          │
     │                                                              │ ─── Query QRSession ───> │
     │                                                              │ <── Session Found ────── │
     │                                                              │                          │
     │                                                              │ [Execute Pipeline Steps] │
     │                                                              │ 1. Match code_value      │
     │                                                              │ 2. Verify HMAC SHA-256   │
     │                                                              │ 3. Assert now < expiry   │
     │                                                              │ 4. Check no dup check-in │
     │                                                              │                          │
     │                                                              │ ─── Insert Attendance ─> │
     │                                                              │ <── Insert Confirmed ─── │
     │                                                              │                          │
     │ <─── 201 Created: { status: 'on-time', check_in_time } ───── │                          │
     │                                                              │                          │
```

---

### 8.2. Admin Login & Two-Factor Authentication Sequence

```
Admin Browser                                                Sentinel Backend               Database
     │                                                              │                          │
     │ ──── POST /api/auth/login { email, password } ─────────────> │                          │
     │                                                              │ ─── Fetch User Record ─> │
     │                                                              │ <── Return User ──────── │
     │                                                              │                          │
     │                                                              │ [bcrypt.compareSync()]   │
     │                                                              │ [Check user.role]        │
     │                                                              │                          │
     │ <─── 200 OK: { requireTotp: true, tempToken } ────────────── │                          │
     │                                                              │                          │
     │ (Admin enters 6-digit code from Google Authenticator)        │                          │
     │                                                              │                          │
     │ ──── POST /api/auth/totp/verify ───────────────────────────> │                          │
     │      Headers: Authorization: Bearer <tempToken>              │                          │
     │      Payload: { code: '849201' }                             │                          │
     │                                                              │ [otplib.verify()]        │
     │                                                              │ [Generate Full JWT]      │
     │                                                              │                          │
     │ <─── 200 OK: { token: <8h-Full-JWT>, user } ──────────────── │                          │
     │                                                              │                          │
     │ ──── Redirect to Admin_Dashboard_Page.html ────────────────> │                          │
```

---

## 9. Future Roadmap & Extensibility

1. **Biometric Face-Matching Pipeline Step**: Leverage the pluggable `verificationSteps.js` architecture to insert `verifyFaceMatch(ctx)` prior to attendance commits.
2. **GPS Geofencing Step**: Extend the mobile scan payload with device coordinates $(\text{lat}, \text{lng})$ and insert a `verifyGeofence(ctx)` step that calculates Haversine distance against corporate premises.
3. **Automated Offline Synchronization**: Allow mobile clients to queue offline scans cryptographically signed with client private keys for batch replay upon reconnection.
4. **WebSocket Push Notifications**: Replace polling on `Daily_Attendnace_Tracking_Page.html` and `QR_Attendance_Scan_Page.html` with WebSocket events for instantaneous updates.

---
*Report compiled autonomously for the Sentinel Attendance Project.*
