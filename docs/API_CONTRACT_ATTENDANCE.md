# API Contract & Geofencing Specification: Attendance Module

**Document Version:** 1.1.0  
**Status:** Implemented (Geofence Toggle & Accuracy Validation Active)  
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
| `latitude` | `number` | Optional | Current device latitude (e.g. `12.9716`). |
| `longitude` | `number` | Optional | Current device longitude (e.g. `77.5946`). |
| `accuracy_m` | `number` | Optional | Horizontal GPS accuracy in meters (e.g. `15.5`). |
| `is_mock_location` | `boolean` | Optional | Mock/spoofed location indicator from client device. |

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
- `400 Bad Request`: Missing required fields (`qr_session_id`, `code_value`, `signature`, or `employee_id`).
- `401 Unauthorized`: QR session not found, `code_value` mismatch, or signature tampering detected.
- `403 Forbidden`: 
  - Department mismatch (`"Department mismatch: you cannot check in with another department's QR code."`).
  - Mock location detected in enforce mode (`{ "error": "MOCK_LOCATION" }`).
  - Outside department geofence in enforce mode (`{ "error": "OUTSIDE_GEOFENCE", "distance_m": 350, "allowed_radius_m": 200 }`).
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
| `latitude` | `number` | Optional | Current device latitude. |
| `longitude` | `number` | Optional | Current device longitude. |
| `accuracy_m` | `number` | Optional | Horizontal GPS accuracy in meters. |
| `is_mock_location` | `boolean` | Optional | Mock/spoofed location indicator. |

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
- `400 Bad Request`: Missing required fields, or no check-in record found for today.
- `401 Unauthorized`: Invalid QR session or signature.
- `403 Forbidden`: Department mismatch, mock location in enforce mode, or outside geofence boundary in enforce mode.
- `404 Not Found`: Employee not found.
- `409 Conflict`: Employee has already checked out today.
- `410 Gone`: Expired QR code.
- `422 Unprocessable Entity`: GPS accuracy exceeds `GEOFENCE_MAX_ACCURACY_M` threshold in enforce mode.
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
     - If `is_mock_location === true`, throws `403` with body `{ error: "MOCK_LOCATION" }`.
     - If `accuracy_m > GEOFENCE_MAX_ACCURACY_M`, throws `422` with body `{ error: "ACCURACY_TOO_LOW" }`.
3. **Missing Location Handling:** If `latitude == null` or `longitude == null`, the step exits quietly without throwing or flagging an alert.
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
| `alert_type` | `String` | `required: true`, enum: `['geofence_violation', 'department_mismatch', 'expired_qr', 'duplicate_scan']` |
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
- `'qr_geo_face'`: **Unused / Reserved**. Not emitted by any pipeline step or controller.

---

## 4. Administrative Visibility & Reporting

1. **Admin Dashboard Summary (`GET /api/dashboard/summary`):**
   - Exposes read-only `geofence_mode` property reflecting current server configuration (`"off"`, `"log"`, or `"enforce"`).
2. **Organisation Report (`GET /api/reports/organisation`):**
   - Wires `SecurityAlert` records of type `geofence_violation` directly into output rows (`status: 'geofence-violation'`), metadata totals (`meta.total_geofence_violations`), summary aggregates (`summary.total_geofence_violations`), and CSV export streams.
