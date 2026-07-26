/// Attendance record model representing a row in the `attendance` table.
class AttendanceRecord {
  /// Supabase auto-generated UUID primary key.
  final String id;

  /// Foreign key to `employees.id`.
  final String employeeId;

  /// Date of the attendance record.
  final DateTime date;

  /// Check-in timestamp (null if not yet checked in).
  final DateTime? checkIn;

  /// Check-out timestamp (null if not yet checked out).
  final DateTime? checkOut;

  /// Status: present, absent, late, half_day, on_leave.
  final String status;

  /// Total working hours for the day.
  final double? workingHours;

  /// Record creation timestamp.
  final DateTime createdAt;

  const AttendanceRecord({
    required this.id,
    required this.employeeId,
    required this.date,
    this.checkIn,
    this.checkOut,
    required this.status,
    this.workingHours,
    required this.createdAt,
  });

  /// Creates an [AttendanceRecord] from a Supabase row (JSON map).
  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    return AttendanceRecord(
      id: json['id'] as String,
      employeeId: json['employee_id'] as String,
      date: DateTime.parse(json['date'] as String),
      checkIn: json['check_in'] != null
          ? DateTime.parse(json['check_in'] as String)
          : null,
      checkOut: json['check_out'] != null
          ? DateTime.parse(json['check_out'] as String)
          : null,
      status: json['status'] as String,
      workingHours: json['working_hours'] != null
          ? (json['working_hours'] as num).toDouble()
          : null,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  /// Converts this [AttendanceRecord] to a JSON map for Supabase.
  Map<String, dynamic> toJson() {
    return {
      'employee_id': employeeId,
      'date': date.toIso8601String().split('T').first,
      'check_in': checkIn?.toIso8601String(),
      'check_out': checkOut?.toIso8601String(),
      'status': status,
      'working_hours': workingHours,
    };
  }

  /// Whether the employee has checked in today.
  bool get hasCheckedIn => checkIn != null;

  /// Whether the employee has completed the day (checked in and out).
  bool get isComplete => checkIn != null && checkOut != null;
}
