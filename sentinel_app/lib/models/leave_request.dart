/// Leave request model representing a row in the `leave_requests` table.
class LeaveRequest {
  /// Supabase auto-generated UUID primary key.
  final String id;

  /// Foreign key to `employees.id`.
  final String employeeId;

  /// Type of leave (e.g., "Casual Leave", "Sick Leave").
  final String leaveType;

  /// Start date of the leave period.
  final DateTime startDate;

  /// End date of the leave period.
  final DateTime endDate;

  /// Reason for the leave request.
  final String? reason;

  /// Status: pending, approved, rejected.
  final String status;

  /// Request creation timestamp.
  final DateTime createdAt;

  const LeaveRequest({
    required this.id,
    required this.employeeId,
    required this.leaveType,
    required this.startDate,
    required this.endDate,
    this.reason,
    required this.status,
    required this.createdAt,
  });

  /// Creates a [LeaveRequest] from a Supabase row (JSON map).
  factory LeaveRequest.fromJson(Map<String, dynamic> json) {
    return LeaveRequest(
      id: json['id'] as String,
      employeeId: json['employee_id'] as String,
      leaveType: json['leave_type'] as String,
      startDate: DateTime.parse(json['start_date'] as String),
      endDate: DateTime.parse(json['end_date'] as String),
      reason: json['reason'] as String?,
      status: json['status'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  /// Converts this [LeaveRequest] to a JSON map for Supabase.
  Map<String, dynamic> toJson() {
    return {
      'employee_id': employeeId,
      'leave_type': leaveType,
      'start_date': startDate.toIso8601String().split('T').first,
      'end_date': endDate.toIso8601String().split('T').first,
      'reason': reason,
      'status': status,
    };
  }

  /// Total number of days for this leave request.
  int get totalDays => endDate.difference(startDate).inDays + 1;
}
