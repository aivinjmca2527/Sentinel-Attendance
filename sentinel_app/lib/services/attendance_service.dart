import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/attendance.dart';

/// Handles read operations on the `attendance` table in Supabase.
class AttendanceService {
  final SupabaseClient _client;

  AttendanceService({SupabaseClient? client})
      : _client = client ?? Supabase.instance.client;

  /// Fetches today's attendance record for the given employee.
  ///
  /// Returns `null` if no record exists for today.
  Future<AttendanceRecord?> getTodayAttendance(String employeeId) async {
    final today = DateTime.now().toIso8601String().split('T').first;
    final response = await _client
        .from('attendance')
        .select()
        .eq('employee_id', employeeId)
        .eq('date', today)
        .maybeSingle();

    if (response == null) return null;
    return AttendanceRecord.fromJson(response);
  }

  /// Fetches the most recent [days] attendance records for the employee.
  ///
  /// Ordered by date descending.
  Future<List<AttendanceRecord>> getRecentAttendance(
    String employeeId, {
    int days = 7,
  }) async {
    final startDate = DateTime.now()
        .subtract(Duration(days: days))
        .toIso8601String()
        .split('T')
        .first;

    final response = await _client
        .from('attendance')
        .select()
        .eq('employee_id', employeeId)
        .gte('date', startDate)
        .order('date', ascending: false);

    return (response as List)
        .map((row) => AttendanceRecord.fromJson(row))
        .toList();
  }

  /// Calculates total working hours for a specific date.
  Future<double> getWorkingHours(String employeeId, DateTime date) async {
    final dateStr = date.toIso8601String().split('T').first;
    final response = await _client
        .from('attendance')
        .select('working_hours')
        .eq('employee_id', employeeId)
        .eq('date', dateStr)
        .maybeSingle();

    if (response == null || response['working_hours'] == null) return 0.0;
    return (response['working_hours'] as num).toDouble();
  }
}
