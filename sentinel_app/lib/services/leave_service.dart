import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/leave_balance.dart';
import '../models/leave_request.dart';

/// Handles read operations on `leave_requests` and `leave_balance` tables.
class LeaveService {
  final SupabaseClient _client;

  LeaveService({SupabaseClient? client})
      : _client = client ?? Supabase.instance.client;

  /// Fetches the current year's leave balance for the employee.
  Future<List<LeaveBalance>> getLeaveBalance(String employeeId) async {
    final currentYear = DateTime.now().year;
    final response = await _client
        .from('leave_balance')
        .select()
        .eq('employee_id', employeeId)
        .eq('year', currentYear);

    return (response as List)
        .map((row) => LeaveBalance.fromJson(row))
        .toList();
  }

  /// Fetches all leave requests for the employee, ordered by creation date.
  Future<List<LeaveRequest>> getLeaveRequests(String employeeId) async {
    final response = await _client
        .from('leave_requests')
        .select()
        .eq('employee_id', employeeId)
        .order('created_at', ascending: false);

    return (response as List)
        .map((row) => LeaveRequest.fromJson(row))
        .toList();
  }

  /// Calculates total remaining leave days across all leave types.
  Future<int> getTotalRemainingLeave(String employeeId) async {
    final balances = await getLeaveBalance(employeeId);
    return balances.fold<int>(0, (sum, b) => sum + b.remainingDays);
  }

  /// Calculates total allocated leave days across all leave types.
  Future<int> getTotalAllocatedLeave(String employeeId) async {
    final balances = await getLeaveBalance(employeeId);
    return balances.fold<int>(0, (sum, b) => sum + b.totalDays);
  }
}
