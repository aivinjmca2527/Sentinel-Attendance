/// Design constants for the Sentinel Attendance app.
///
/// All spacing, radius, sizing, and static data lists are defined here.
/// Nothing should be hardcoded in screens or widgets.
class AppConstants {
  AppConstants._();

  // ── Border Radii ──────────────────────────────────────────────────────
  static const double radiusSm = 4.0;
  static const double radiusMd = 6.0;
  static const double radiusLg = 8.0;
  static const double radiusFull = 9999.0;

  // ── Spacing ───────────────────────────────────────────────────────────
  static const double spacingXs = 4.0;
  static const double spacingSm = 8.0;
  static const double spacingMd = 12.0;
  static const double spacingLg = 16.0;
  static const double spacingXl = 24.0;
  static const double spacingXxl = 32.0;
  static const double spacingXxxl = 41.0; // Login card padding

  // ── Sizing ────────────────────────────────────────────────────────────
  static const double sidebarWidth = 256.0;
  static const double topBarHeight = 64.0;
  static const double loginCardMaxWidth = 448.0;
  static const double brandIconWidth = 64.0;
  static const double brandIconHeight = 48.0;
  static const double inputHeight = 48.0;
  static const double avatarSizeSm = 32.0;
  static const double avatarSizeMd = 40.0;
  static const double avatarSizeLg = 64.0;
  static const double gridPatternSize = 40.0;
  static const double gradientHeight = 384.0;
  static const double statBarHeight = 6.0;
  static const double deptBarHeight = 8.0;

  // ── Icon Sizes ────────────────────────────────────────────────────────
  static const double iconSizeSm = 13.0;
  static const double iconSizeMd = 14.0;
  static const double iconSizeLg = 16.0;
  static const double iconSizeXl = 18.0;
  static const double iconSizeXxl = 24.0;

  // ── Animation Durations ───────────────────────────────────────────────
  static const Duration animFast = Duration(milliseconds: 150);
  static const Duration animNormal = Duration(milliseconds: 300);
  static const Duration animSlow = Duration(milliseconds: 500);

  // ── Department List ───────────────────────────────────────────────────
  static const List<String> departments = [
    'Engineering',
    'Sales',
    'Marketing',
    'Human Resources',
    'Operations',
    'Finance',
    'Design',
    'Product',
    'Legal',
    'Customer Support',
  ];

  // ── Designation List ──────────────────────────────────────────────────
  static const List<String> designations = [
    'Junior Developer',
    'Senior Developer',
    'Lead Developer',
    'Engineering Manager',
    'Product Manager',
    'Designer',
    'Analyst',
    'Executive',
    'Director',
    'Vice President',
    'Intern',
    'Consultant',
  ];

  // ── Leave Types ───────────────────────────────────────────────────────
  static const List<String> leaveTypes = [
    'Casual Leave',
    'Sick Leave',
    'Earned Leave',
    'Maternity Leave',
    'Paternity Leave',
    'Compensatory Off',
  ];

  // ── Attendance Statuses ───────────────────────────────────────────────
  static const String statusPresent = 'present';
  static const String statusAbsent = 'absent';
  static const String statusLate = 'late';
  static const String statusHalfDay = 'half_day';
  static const String statusOnLeave = 'on_leave';

  // ── Leave Request Statuses ────────────────────────────────────────────
  static const String leaveStatusPending = 'pending';
  static const String leaveStatusApproved = 'approved';
  static const String leaveStatusRejected = 'rejected';
}
