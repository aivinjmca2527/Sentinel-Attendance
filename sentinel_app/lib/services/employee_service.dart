import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/employee.dart';

/// Handles CRUD operations on the `employees` table in Supabase.
class EmployeeService {
  final SupabaseClient _client;

  EmployeeService({SupabaseClient? client})
      : _client = client ?? Supabase.instance.client;

  /// Creates a new employee record in the database.
  ///
  /// Called after successful user registration in Supabase Auth.
  Future<Employee> createEmployee(Employee employee) async {
    final response = await _client
        .from('employees')
        .insert(employee.toJson())
        .select()
        .single();
    return Employee.fromJson(response);
  }

  /// Fetches the employee profile for the currently authenticated user.
  Future<Employee?> getEmployeeByAuthId(String authUserId) async {
    final response = await _client
        .from('employees')
        .select()
        .eq('auth_user_id', authUserId)
        .maybeSingle();

    if (response == null) return null;
    return Employee.fromJson(response);
  }

  /// Checks whether an employee ID is already taken.
  ///
  /// Returns `true` if the ID is available (unique).
  Future<bool> isEmployeeIdUnique(String employeeId) async {
    final response = await _client
        .from('employees')
        .select('id')
        .eq('employee_id', employeeId.trim())
        .maybeSingle();
    return response == null;
  }

  /// Checks whether an email is already registered.
  ///
  /// Returns `true` if the email is available (unique).
  Future<bool> isEmailUnique(String email) async {
    final response = await _client
        .from('employees')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();
    return response == null;
  }
}
