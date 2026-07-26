/// Leave balance model representing a row in the `leave_balance` table.
class LeaveBalance {
  /// Supabase auto-generated UUID primary key.
  final String id;

  /// Foreign key to `employees.id`.
  final String employeeId;

  /// Type of leave (e.g., "Casual Leave", "Sick Leave").
  final String leaveType;

  /// Total allocated days for the year.
  final int totalDays;

  /// Days already used.
  final int usedDays;

  /// Calendar year this balance applies to.
  final int year;

  const LeaveBalance({
    required this.id,
    required this.employeeId,
    required this.leaveType,
    required this.totalDays,
    required this.usedDays,
    required this.year,
  });

  /// Creates a [LeaveBalance] from a Supabase row (JSON map).
  factory LeaveBalance.fromJson(Map<String, dynamic> json) {
    return LeaveBalance(
      id: json['id'] as String,
      employeeId: json['employee_id'] as String,
      leaveType: json['leave_type'] as String,
      totalDays: json['total_days'] as int,
      usedDays: json['used_days'] as int,
      year: json['year'] as int,
    );
  }

  /// Remaining leave days.
  int get remainingDays => totalDays - usedDays;

  /// Usage percentage (0.0 – 1.0).
  double get usageRatio =>
      totalDays > 0 ? usedDays / totalDays : 0.0;
}
