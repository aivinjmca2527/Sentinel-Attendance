import 'package:flutter/material.dart';

import '../models/attendance.dart';
import '../models/employee.dart';
import '../models/leave_balance.dart';
import '../services/attendance_service.dart';
import '../services/leave_service.dart';

/// Manages dashboard data state.
///
/// Fetches attendance records and leave balance from Supabase
/// and exposes them to dashboard widgets.
class DashboardProvider extends ChangeNotifier {
  final AttendanceService _attendanceService;
  final LeaveService _leaveService;

  // ── State ───────────────────────────────────────────────────────────
  bool _isLoading = false;
  String? _errorMessage;
  AttendanceRecord? _todayAttendance;
  List<AttendanceRecord> _recentAttendance = [];
  List<LeaveBalance> _leaveBalances = [];
  int _totalRemainingLeave = 0;
  int _totalAllocatedLeave = 0;

  // ── Getters ─────────────────────────────────────────────────────────
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  AttendanceRecord? get todayAttendance => _todayAttendance;
  List<AttendanceRecord> get recentAttendance => _recentAttendance;
  List<LeaveBalance> get leaveBalances => _leaveBalances;
  int get totalRemainingLeave => _totalRemainingLeave;
  int get totalAllocatedLeave => _totalAllocatedLeave;

  /// Today's working hours formatted or "—" if no data.
  double get todayWorkingHours => _todayAttendance?.workingHours ?? 0.0;

  /// Today's attendance status or "Not Marked" if no record.
  String get todayStatus => _todayAttendance?.status ?? 'Not Marked';

  DashboardProvider({
    AttendanceService? attendanceService,
    LeaveService? leaveService,
  })  : _attendanceService = attendanceService ?? AttendanceService(),
        _leaveService = leaveService ?? LeaveService();

  /// Loads all dashboard data for the given employee.
  ///
  /// Called after navigation to the dashboard screen.
  Future<void> loadDashboardData(Employee employee) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // Fetch all data concurrently for performance
      final results = await Future.wait([
        _attendanceService.getTodayAttendance(employee.id),
        _attendanceService.getRecentAttendance(employee.id, days: 7),
        _leaveService.getLeaveBalance(employee.id),
        _leaveService.getTotalRemainingLeave(employee.id),
        _leaveService.getTotalAllocatedLeave(employee.id),
      ]);

      _todayAttendance = results[0] as AttendanceRecord?;
      _recentAttendance = results[1] as List<AttendanceRecord>;
      _leaveBalances = results[2] as List<LeaveBalance>;
      _totalRemainingLeave = results[3] as int;
      _totalAllocatedLeave = results[4] as int;
    } catch (e) {
      _errorMessage = 'Failed to load dashboard data. Pull to refresh.';
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Refreshes all dashboard data.
  Future<void> refresh(Employee employee) async {
    await loadDashboardData(employee);
  }
}
