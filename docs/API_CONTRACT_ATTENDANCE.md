# API Contract & Geofencing Specification: Attendance Module

**Document Version:** 1.2.0-draft  
**Status:** Geofencing & kiosk: Implemented. **Face Authentication (Section 5): DESIGNED, NOT YET IMPLEMENTED** (contract locked ahead of the build; marked *(planned)* wherever it appears).  
**Target File / Module:** `modules/attendance/`, `modules/dashboard/`, `modules/reports/`, & `shared/`  

---

## 1. Endpoints & API Contract

### 1.1 POST `/api/attendance/checkin`

Performs verification and records the start of an employee's workday.

- **Authentication:** Required (`requireAuth` middleware). `employee_id` is extracted from `req.user.employee_id` (fallback to `req.body.employee_id`).
- **HTTP Method:** `POST`
- **Route:** `/api/attendance/checkin`

#### Request Payload (`application/json`)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `qr_session_id` | `string` | **Yes** | MongoDB ObjectId hex string of the active QR session. |
| `code_value` | `string` | **Yes** | Payload value scanned from the dynamic QR code. |
| `signature` | `string` | **Yes** | HMAC SHA-256 hex signature from the QR code. |
| `employee_id` | `string` | Optional* | MongoDB ObjectId of employee (*required if not set in auth token). |
| `latitude` | `number` | Optional* | Current device latitude (e.g. `12.9716`). *Required in `enforce` mode. |
| `longitude` | `number` | Optional* | Current device longitude (e.g. `77.5946`). *Required in `enforce` mode. |
| `accuracy_m` | `number` | Optional | Horizontal GPS accuracy in meters (e.g. `15.5`). |
| `is_mock_location` | `boolean` | Optional* | Mock/spoofed location indicator from client device. *Required boolean (`true`/`false`) in `enforce` mode. |
| `face_proof` | `string` | Optional* | *(planned)* Signed, single-use token from `POST /api/face/verify`. *Required in `enforce` when `FACE_MODE=enforce`. See Section 5. |

#### Response: Success (`201 Created`)
```json
{
  "message": "Check-in successful.",
  "attendance_id": "6741f0a2e4b02a1d4c8e9012",
  "check_in_time": "2026-09-29T09:05:00.000Z",
  "status": "on-time",
  "verification_method": "qr_geo"
}
```
*Note on `status`: Calculated against `CHECK_IN_CUTOFF` (default `'09:00'`). Values are `'on-time'` or `'late'`.*  
*Note on `verification_method`: Set to `'qr_geo'` if both `latitude` and `longitude` are present, otherwise `'qr_only'`.*

#### Response: Error Status Codes
- `400 Bad Request`: Missing required fields (`qr_session_id`, `code_value`, `signature`, `employee_id`), missing coordinates in enforce mode (`{ "error": "LOCATION_REQUIRED" }`), or missing boolean mock flag in enforce mode (`{ "error": "MOCK_LOCATION_FLAG_REQUIRED" }`).
- `401 Unauthorized`: QR session not found, `code_value` mismatch, or signature tampering detected.
- `403 Forbidden`: 
  - Department mismatch (`"Department mismatch: you cannot check in with another department's QR code."`).
  - Mock location detected in enforce mode (`{ "error": "MOCK_LOCATION" }`).
  - Outside department geofence in enforce mode (`{ "error": "OUTSIDE_GEOFENCE", "distance_m": 350, "allowed_radius_m": 200 }`).
  - *(planned)* Face proof problems in `FACE_MODE=enforce`: `FACE_PROOF_REQUIRED`, `FACE_PROOF_INVALID`, `FACE_PROOF_EXPIRED`, `FACE_PROOF_REUSED`, `FACE_PROOF_ACTION_MISMATCH`, `FACE_NOT_ENROLLED` (see Section 5.6).
- `404 Not Found`: Employee record not found.
- `409 Conflict`: Duplicate check-in (`"Employee has already checked in today."`).
- `410 Gone`: QR code has expired.
- `422 Unprocessable Entity`: GPS accuracy exceeds `GEOFENCE_MAX_ACCURACY_M` threshold in enforce mode (`{ "error": "ACCURACY_TOO_LOW" }`).
- `500 Internal Server Error`: Server or database failure.

---

### 1.2 POST `/api/attendance/checkout`

Performs verification, updates today's attendance record with check-out timestamp, calculates working hours, and updates attendance status.

- **Authentication:** Required (`requireAuth` middleware). `employee_id` is extracted from `req.user.employee_id` (fallback to `req.body.employee_id`).
- **HTTP Method:** `POST`
- **Route:** `/api/attendance/checkout`

#### Request Payload (`application/json`)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `qr_session_id` | `string` | **Yes** | MongoDB ObjectId hex string of the active QR session. |
| `code_value` | `string` | **Yes** | Payload value scanned from the dynamic QR code. |
| `signature` | `string` | **Yes** | HMAC SHA-256 hex signature from the QR code. |
| `employee_id` | `string` | Optional* | MongoDB ObjectId of employee (*required if not set in auth token). |
| `latitude` | `number` | Optional* | Current device latitude. *Required in `enforce` mode. |
| `longitude` | `number` | Optional* | Current device longitude. *Required in `enforce` mode. |
| `accuracy_m` | `number` | Optional | Horizontal GPS accuracy in meters. |
| `is_mock_location` | `boolean` | Optional* | Mock/spoofed location indicator. *Required boolean (`true`/`false`) in `enforce` mode. |
| `face_proof` | `string` | Optional* | *(planned)* Signed, single-use token from `POST /api/face/verify`. *Required in `enforce` when `FACE_MODE=enforce`. See Section 5. |

#### Response: Success (`200 OK`)
```json
{
  "message": "Check-out successful.",
  "attendance_id": "6741f0a2e4b02a1d4c8e9012",
  "check_out_time": "2026-09-29T17:30:00.000Z",
  "working_hours": 8.42,
  "status": "on-time"
}
```
*Note on `status`: Evaluated against `STANDARD_WORK_HOURS` (default `8` hours). If `working_hours < 8`, returns `'early-leave'`. If working hours are met but initial check-in was late, preserves `'late'`. Otherwise returns `'on-time'`.*  
*Note on `verification_method`: If `latitude` and `longitude` are supplied and the record was previously `'qr_only'`, it is updated to `'qr_geo'`.*

#### Response: Error Status Codes
- `400 Bad Request`: Missing required fields, missing coordinates in enforce mode (`{ "error": "LOCATION_REQUIRED" }`), missing boolean mock flag in enforce mode (`{ "error": "MOCK_LOCATION_FLAG_REQUIRED" }`), or no check-in record found for today.
- `401 Unauthorized`: Invalid QR session or signature.
- `403 Forbidden`: Department mismatch, mock location in enforce mode, outside geofence boundary in enforce mode, or *(planned)* a face-proof error in `FACE_MODE=enforce` (same codes as check-in, Section 5.6).
- `404 Not Found`: Employee not found.
- `409 Conflict`: Employee has already checked out today.
- `410 Gone`: Expired QR code.
- `422 Unprocessable Entity`: GPS accuracy exceeds `GEOFENCE_MAX_ACCURACY_M` threshold in enforce mode.
- `500 Internal Server Error`: Server or database failure.

---

### 1.3 GET `/api/qr/kiosk-view`

Low-privilege, unauthenticated endpoint for physical attendance kiosk screens to retrieve the active rotating QR code without holding an administrative JWT session.

- **Authentication:** Unauthenticated via JWT (`requireAuth` bypassed). Authenticated via low-privilege shared secret `kiosk_key` matched against `process.env.KIOSK_DISPLAY_KEY`.
- **HTTP Method:** `GET`
- **Route:** `/api/qr/kiosk-view`
- **Rate Limiting:** Enforced via `express-rate-limit` (default max 300 requests per 15-minute window; returns HTTP 429 when exceeded).

#### Query Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `department_id` | `string` | **Yes** | MongoDB ObjectId hex string of the department whose QR session is being displayed. |
| `kiosk_key` | `string` | **Yes** | Shared secret string matching `process.env.KIOSK_DISPLAY_KEY`. Can also be passed via `x-kiosk-key` header. |

#### Security Guarantees
1. **Low Privilege:** Access to `kiosk_key` grants read-only access to rotating ephemeral QR codes only. It cannot access employee personal data, cannot modify settings, cannot access attendance logs, and cannot sign administrative tokens.
2. **Credential Blindness:** If `kiosk_key` is invalid or missing, the server returns HTTP 401 immediately without verifying or revealing whether `department_id` exists in the database.

#### Response: Success (`200 OK`)
```json
{
  "qr_session_id": "6741f0a2e4b02a1d4c8e9012",
  "department_id": "6aa0b5124d4f05d801fc7903",
  "code_value": "8f3b2c1a...",
  "signature": "e7d8f9a0...",
  "expires_at": "2026-09-30T09:05:10.000Z"
}
```

#### Response: Error Status Codes
- `400 Bad Request`: Missing required `department_id` query parameter (`{ "error": "department_id query parameter is required." }`).
- `401 Unauthorized`: Missing, unconfigured, or mismatched `kiosk_key` (`{ "error": "Invalid or missing kiosk display key." }`).
- `429 Too Many Requests`: Rate limit exceeded (`{ "error": "Too many kiosk display requests. Please try again later." }`).
- `500 Internal Server Error`: Server or database failure.

---

## 2. Geofence Verification (`verifyGeofence`)

Located in [`modules/attendance/verificationSteps.js`](file:///home/aivin/Desktop/GIt/projects/Sentinel-Attendance/modules/attendance/verificationSteps.js).

### 2.1 Mode Toggle Configuration
Configured via environment variables (`shared/config/geofence.js`):
- `GEOFENCE_MODE`: `"off"`, `"log"`, or `"enforce"` (defaults to `"log"`).
- `GEOFENCE_MAX_ACCURACY_M`: Maximum permissible GPS accuracy radius in meters (defaults to `50`).

#### Behavior Matrix per Mode
| Mode | Distance > Allowed Radius | `accuracy_m > GEOFENCE_MAX_ACCURACY_M` | `is_mock_location: true` | `SecurityAlert` Created? | Check-in / Checkout Blocked? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`off`** | Skipped | Ignored | Ignored | No | **No** (proceeds normally) |
| **`log`** *(default)* | Non-blocking | Non-blocking | Non-blocking | **Yes** (records distance, accuracy, mock flag in metadata) | **No** (proceeds normally) |
| **`enforce`** | **Blocked** (403 `OUTSIDE_GEOFENCE`) | **Blocked** (422 `ACCURACY_TOO_LOW`) | **Blocked** (403 `MOCK_LOCATION`) | **Yes** (records violation attempt) | **Yes** (no Attendance record saved) |

### 2.2 Execution Flow & Inputs
1. **Coordinate & Metadata Extraction:** Reads `latitude`, `longitude`, `accuracy_m`, and `is_mock_location` from `ctx.body`. Coordinates are attached to `ctx` for downstream persistence on `Attendance`.
2. **Mode Check:**
   - If `off`: Exits immediately without performing any checks.
   - If `enforce`:
     - If `typeof is_mock_location !== 'boolean'`, throws `400` with body `{ error: "MOCK_LOCATION_FLAG_REQUIRED" }`.
     - If `is_mock_location === true`, throws `403` with body `{ error: "MOCK_LOCATION" }`.
     - If `accuracy_m > GEOFENCE_MAX_ACCURACY_M`, throws `422` with body `{ error: "ACCURACY_TOO_LOW" }`.
   *(Note: `is_mock_location` is a client-reported heuristic, not a server-verified guarantee, and device attestation is a possible future improvement.)*
3. **Missing Location Handling:**
   - In `enforce` mode: If `latitude == null` or `longitude == null`, throws HTTP `400` with body `{ error: "LOCATION_REQUIRED" }`.
   - In `off` and `log` modes: If `latitude == null` or `longitude == null`, the step exits quietly without throwing or flagging an alert.
4. **Department Lookup:** 
   - Retrieves `department_id` from `ctx.employee.department_id` (fallback to `ctx.qrSession.department_id`).
   - Queries `Department.findById(empDeptId).lean()`.
   - Checks the Department model fields:
     - `geofence_lat`: Department latitude center point.
     - `geofence_lng`: Department longitude center point.
     - `geofence_radius_m`: Permissible circular boundary radius in meters (defaults to **`200`** meters if unset or zero).
   - If `geofence_lat` or `geofence_lng` is not configured, the distance check is skipped.
5. **Distance Calculation (Haversine Formula):**
   Calculates geodesic distance between device coordinates and department center.
6. **Violation Handling:**
   - If `distance > radius`:
     - Creates `SecurityAlert` document with `alert_type: 'geofence_violation'`, `severity: 'high'`, and metadata including `distance_m`, `accuracy_m`, and `is_mock_location`.
     - In `log` mode: Logs warning to console, proceeds cleanly without error.
     - In `enforce` mode: Throws HTTP `403` with body `{ error: "OUTSIDE_GEOFENCE", distance_m: Math.round(distance), allowed_radius_m: radius }`. Halts pipeline before Attendance creation.

### 2.3 Distance Calculation (Haversine Formula)
Calculates geodesic distance between device coordinates `(lat1, lng1)` and department center `(lat2, lng2)`:

```javascript
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

---

## 3. Data Models & Schemas

### 3.1 Department Geofence Fields ([`shared/models/Department.js`](file:///home/aivin/Desktop/GIt/projects/Sentinel-Attendance/shared/models/Department.js))

Geofencing is configured on a per-department level:

| Field Name | Mongoose Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `geofence_lat` | `Number` | `null` | Latitude of department's center boundary. |
| `geofence_lng` | `Number` | `null` | Longitude of department's center boundary. |
| `geofence_radius_m` | `Number` | `200` | Allowed radius in meters around the center point. |

### 3.2 SecurityAlert Schema ([`shared/models/SecurityAlert.js`](file:///home/aivin/Desktop/GIt/projects/Sentinel-Attendance/shared/models/SecurityAlert.js))

The complete schema for security alerts:

| Field | Type | Attributes / Constraints |
| :--- | :--- | :--- |
| `employee_id` | `ObjectId` | ref: `'Employee'`, `required: true` |
| `alert_type` | `String` | `required: true`, enum: `['geofence_violation', 'department_mismatch', 'expired_qr', 'duplicate_scan']` *(planned additions: `'face_mismatch'`, `'liveness_failed'`, `'face_proof_invalid'`, `'face_reenrolled'`, `'face_revoked'`, `'face_locked'`)* |
| `severity` | `String` | enum: `['low', 'medium', 'high', 'critical']`, `default: 'medium'` |
| `message` | `String` | `required: true` |
| `metadata` | `Object` | Embedded object: |
| `metadata.latitude` | `Number` | `default: null` |
| `metadata.longitude` | `Number` | `default: null` |
| `metadata.department_id` | `ObjectId` | ref: `'Department'`, `default: null` |
| `metadata.distance_m` | `Number` | `default: null` |
| `metadata.qr_session_id` | `ObjectId` | ref: `'QRSession'`, `default: null` |
| `metadata.accuracy_m` | `Number` | `default: null` |
| `metadata.is_mock_location` | `Boolean` | `default: null` |
| `status` | `String` | enum: `['open', 'acknowledged', 'resolved']`, `default: 'open'` |
| `created_at` | `Date` | `default: Date.now` |

**Indexes:**
- `{ created_at: -1 }`
- `{ status: 1, alert_type: 1 }`

#### Where & How SecurityAlerts Are Created
`SecurityAlert.create()` is invoked strictly within [`modules/attendance/verificationSteps.js`](file:///home/aivin/Desktop/GIt/projects/Sentinel-Attendance/modules/attendance/verificationSteps.js):

1. **`verifyDepartmentMatch`**:
   - `alert_type`: `'department_mismatch'`
   - `severity`: `'high'`
   - `message`: `'Employee attempted to scan QR code from a different department.'`
   - `metadata`: `{ department_id: ctx.qrSession.department_id, qr_session_id: ctx.qrSession._id }`
   - *Blocking: Throws 403 Forbidden.*

2. **`verifyGeofence`**:
   - `alert_type`: `'geofence_violation'`
   - `severity`: `'high'`
   - `message`: `Employee scanned QR ${Math.round(distance)}m outside the ${dept.department_name} geofence (limit: ${radius}m).`
   - `metadata`: `{ latitude, longitude, department_id, distance_m, qr_session_id, accuracy_m, is_mock_location }`
   - *Non-blocking in `log` mode; blocking (403 `OUTSIDE_GEOFENCE`) in `enforce` mode.*

---

### 3.3 Attendance Verification Methods ([`shared/models/Attendance.js`](file:///home/aivin/Desktop/GIt/projects/Sentinel-Attendance/shared/models/Attendance.js))

The `verification_method` schema definition:
- `verification_method`: `{ type: String, enum: ['qr_only', 'qr_geo', 'qr_geo_face'], default: 'qr_only' }`

**Actual Values in Active Use:**
- `'qr_only'`: Used when check-in occurs without device coordinates (`latitude` or `longitude` missing/null).
- `'qr_geo'`: Used when device coordinates (`latitude` and `longitude`) are supplied during check-in, or upgraded during check-out.
- `'qr_geo_face'`: **Reserved today; will be emitted once Face Authentication is implemented** - when a valid `face_proof` is accepted together with device coordinates. *(Open design point for the build: a check-in with a valid face proof but no coordinates has no matching enum value; decide whether to require coordinates whenever a proof is used, or add a value. Do not silently reuse `qr_only`.)*

---

## 4. Administrative Visibility & Reporting

1. **Admin Dashboard Summary (`GET /api/dashboard/summary`):**
   - Exposes read-only `geofence_mode` property reflecting current server configuration (`"off"`, `"log"`, or `"enforce"`).
   - *(planned)* Also exposes read-only `face_mode` with the same three values.
2. **Organisation Report (`GET /api/reports/organisation`):**
   - Wires `SecurityAlert` records of type `geofence_violation` directly into output rows (`status: 'geofence-violation'`), metadata totals (`meta.total_geofence_violations`), summary aggregates (`summary.total_geofence_violations`), and CSV export streams.

---

## 5. Face Authentication *(planned - contract locked, not implemented)*

**Design rules (do not change without updating this document):**
- The SERVER decides pass/fail. The client never sends `face_verified`; it uploads images and forwards the server-issued proof.
- Face is verified **before** the QR scan (the QR expires in ~10 s). The resulting `face_proof` is then sent with `checkin`/`checkout`.
- Reference faces are enrolled by an **admin only**. Employees cannot enrol or replace their own face.
- Liveness = a random head-turn challenge, checked on-device (UX only) and best-effort on the server. It is a heuristic, not a guarantee.
- Rollout via `FACE_MODE` (`off` default, then `log`, then `enforce`), mirroring `GEOFENCE_MODE`.

All endpoints require `Authorization: Bearer <JWT>`. Uploads are `multipart/form-data`, JPEG or PNG, max `FACE_MAX_IMAGE_BYTES` (default 1.5 MB) per image. Error bodies use the same shape as the rest of this document: `{ "error": "CODE", ...extra }`.

### 5.1 GET `/api/face/me`
Any authenticated user with an `employee_id`.

`200 OK`
```json
{ "face_mode": "log", "enrolled": true, "enrolled_at": "2026-10-01T09:00:00.000Z", "locked_until": null }
```
The mobile app uses this to decide whether to show the face step. A `404` from an older server means "face not supported" and is treated as `face_mode: "off"`.

### 5.2 POST `/api/face/enroll` (admin only)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `employee_id` | text | **Yes** | Employee to enrol. |
| `image` | file | **Yes** | Clear frontal face photo. |
| `consent_confirmed` | text | **Yes** | Must be `"true"`. |
| `replace` | text | Optional | `"true"` to replace an existing template (logs `face_reenrolled`). |

- `201 Created`: `{ "employee_id", "enrolled": true, "model_version", "enrolled_at" }`
- `400`: `NO_FACE`, `MULTIPLE_FACES`, `LOW_QUALITY`, `CONSENT_REQUIRED`
- `403` non-admin; `404 EMPLOYEE_NOT_FOUND`; `409 FACE_ALREADY_ENROLLED`; `413`; `415`

### 5.3 DELETE `/api/face/:employee_id` (admin only)
`200 OK`: `{ "revoked": true }`. Deletes the stored template and logs `face_revoked`.

### 5.4 POST `/api/face/challenge`
Employee/manager with an `employee_id`.

`200 OK`
```json
{ "challenge_id": "...", "challenge": "turn_left", "expires_at": "2026-10-01T09:00:30.000Z", "ttl_seconds": 30 }
```
- `403 FACE_NOT_ENROLLED`; `429 FACE_LOCKED` with `{ "retry_after_seconds": 840 }`.
- A new challenge invalidates any earlier active one for the same employee.

### 5.5 POST `/api/face/verify`
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `challenge_id` | text | **Yes** | From 5.4. Single-use, 30 s TTL. |
| `intended_action` | text | Optional | `checkin` or `checkout`; embedded in the proof. Omitted = `any`. |
| `neutral_frame` | file | **Yes** | Facing the camera. |
| `action_frame` | file | **Yes** | After performing the head turn. |

- `200 OK`: `{ "face_proof": "<signed token>", "expires_at": "<ISO>", "intended_action": "checkin|checkout|any" }`
- `400`: `NO_FACE`, `MULTIPLE_FACES`, `CHALLENGE_INVALID`, `CHALLENGE_EXPIRED`
- `403 FACE_MISMATCH` and `403 LIVENESS_FAILED`: both include `{ "attempts_remaining": n }`
- `403 FACE_NOT_ENROLLED`; `429 FACE_LOCKED` (`retry_after_seconds`); `413`; `415`
- **The response never includes a similarity score, distance, or embedding.**

### 5.6 Changes to check-in / check-out
New optional body field `face_proof` (string). Behaviour by `FACE_MODE`:

| Mode | Missing / invalid proof | `SecurityAlert` | Blocked? |
| :--- | :--- | :--- | :--- |
| **`off`** *(default)* | Field ignored | No | **No** |
| **`log`** | Recorded | **Yes** | **No** (proceeds normally) |
| **`enforce`** | `403` with one of the codes below | **Yes** | **Yes** (no Attendance record saved) |

Enforce-mode codes: `FACE_PROOF_REQUIRED`, `FACE_PROOF_INVALID`, `FACE_PROOF_EXPIRED`, `FACE_PROOF_REUSED`, `FACE_PROOF_ACTION_MISMATCH`, `FACE_NOT_ENROLLED`.

Pipeline: new step `verifyFaceProof` runs after `verifyGeofence` and before the duplicate-scan check. The proof's `jti` is consumed atomically as late as possible (right before the Attendance write), so an earlier failing step (e.g. outside geofence) does not burn the proof.

### 5.7 Face proof token
JWT signed with a dedicated `FACE_PROOF_SECRET` (never `JWT_SECRET`). Claims: `sub`, `employee_id`, `purpose: "face_proof"`, `jti`, `intended_action`, `iat`, `exp` (default 120 s). Single-use, enforced via a unique index on `jti`.

### 5.8 Data models *(planned)*
- `FaceTemplate`: `employee_id` (unique), `embedding` (`select: false`), `model_version`, `enrolled_by`, `enrolled_at`, `failed_attempts`, `locked_until`.
- `FaceChallenge`: `challenge_id`, `employee_id`, `challenge`, `expires_at` (TTL), `used`.
- `FaceProofUse`: `jti` (unique), `employee_id`, `consumed_at`, `expires_at` (TTL).
- Raw photos are not stored unless `FACE_STORE_PHOTO=true`. `Employee.reference_face_photo_url` stays null otherwise.
- `GET /api/employees` items gain a boolean `face_enrolled`. No endpoint ever returns an embedding.

### 5.9 Configuration
| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `FACE_MODE` | `off` | `off` / `log` / `enforce` |
| `FACE_PROVIDER` | `local` | `local` or `mock` (mock refuses to load in production) |
| `FACE_MATCH_THRESHOLD` | `0.5` | Max embedding distance for a match |
| `FACE_PROOF_SECRET` | none | **Required** when mode is `log` or `enforce` |
| `FACE_PROOF_TTL_SECONDS` | `120` | Proof lifetime |
| `FACE_CHALLENGE_TTL_SECONDS` | `30` | Challenge lifetime |
| `FACE_MIN_YAW_DELTA` | `15` | Minimum head-turn angle (degrees) checked on the server |
| `FACE_MAX_FAILED_ATTEMPTS` | `5` | Failures before lockout |
| `FACE_LOCKOUT_MINUTES` | `15` | Lockout duration |
| `FACE_STORE_PHOTO` | `false` | Keep raw reference photo |
| `FACE_MAX_IMAGE_BYTES` | `1500000` | Per-image upload limit |

Test-only: `X-Face-Mode` header is honoured only when `NODE_ENV === 'test'` AND `X-Test-Secret === TEST_OVERRIDE_SECRET` (same mechanism as the geofence override).

### 5.10 Known limitations
Head-turn liveness can be defeated by pre-recorded video or a 3D mask; a rooted device can feed synthetic camera frames; on-device ML Kit results are not trusted for security. Stronger options: a managed liveness service or device attestation (Play Integrity / DeviceCheck).