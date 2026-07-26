/// Employee model representing a user's profile data in the `employees` table.
class Employee {
  /// Supabase auto-generated UUID primary key.
  final String id;

  /// Foreign key linking to `auth.users.id`.
  final String authUserId;

  /// Full name of the employee.
  final String fullName;

  /// Unique employee identifier (e.g., "EMP-001").
  final String employeeId;

  /// Corporate email address.
  final String email;

  /// Phone number with country code.
  final String phone;

  /// Department name (e.g., "Engineering").
  final String department;

  /// Job designation (e.g., "Senior Developer").
  final String designation;

  /// Account creation timestamp.
  final DateTime createdAt;

  const Employee({
    required this.id,
    required this.authUserId,
    required this.fullName,
    required this.employeeId,
    required this.email,
    required this.phone,
    required this.department,
    required this.designation,
    required this.createdAt,
  });

  /// Creates an [Employee] from a Supabase row (JSON map).
  factory Employee.fromJson(Map<String, dynamic> json) {
    return Employee(
      id: json['id'] as String,
      authUserId: json['auth_user_id'] as String,
      fullName: json['full_name'] as String,
      employeeId: json['employee_id'] as String,
      email: json['email'] as String,
      phone: json['phone'] as String? ?? '',
      department: json['department'] as String,
      designation: json['designation'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  /// Converts this [Employee] to a JSON map for Supabase insertion.
  Map<String, dynamic> toJson() {
    return {
      'auth_user_id': authUserId,
      'full_name': fullName,
      'employee_id': employeeId,
      'email': email,
      'phone': phone,
      'department': department,
      'designation': designation,
    };
  }

  /// Returns the initials from the full name (max 2 characters).
  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return fullName.isNotEmpty ? fullName[0].toUpperCase() : '--';
  }
}
