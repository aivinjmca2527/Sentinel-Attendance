const Attendance = require('../../shared/models/Attendance');
const Employee = require('../../shared/models/Employee');
const Department = require('../../shared/models/Department');
const LeaveRequest = require('../../shared/models/LeaveRequest');
const User = require('../../shared/models/User');

/**
 * COORDINATION NOTE (Aivin):
 * We query the Attendance model directly via Mongoose aggregation and queries rather than
 * making HTTP calls to GET /api/attendance.
 * Rationale: Direct database querying inside the backend offers optimal performance,
 * avoids redundant internal network roundtrips, enables powerful joins ($lookup across
 * Employee, Department, and LeaveRequest collections), and provides atomic aggregation
 * necessary for dashboard analytics and reports.
 */

/**
 * Helper to get normalized start & end Date objects for a day.
 */
function getDayDateRange(targetDate = new Date()) {
  const dateObj = new Date(targetDate);
  const startOfDay = new Date(dateObj);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dateObj);
  endOfDay.setHours(23, 59, 59, 999);
  return { startOfDay, endOfDay };
}

/**
 * GET /api/dashboard/summary
 * Returns today's summary metrics: total employees, present, absent, on leave, late arrivals, incomplete check-outs.
 */
exports.getSummary = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const { startOfDay, endOfDay } = getDayDateRange(targetDate);

    // 1. Total Active Employees
    const totalEmployees = await Employee.countDocuments({ status: 'active' });

    // 2. Fetch today's Attendance records with populated Employee & User & Department
    const attendances = await Attendance.find({
      date: { $gte: startOfDay, $lte: endOfDay }
    }).populate({
      path: 'employee_id',
      populate: [
        { path: 'user_id', select: 'name email role' },
        { path: 'department_id', select: 'department_name' }
      ]
    });

    // 3. Approved Leaves for today
    const approvedLeaves = await LeaveRequest.find({
      status: 'approved',
      start_date: { $lte: endOfDay },
      end_date: { $gte: startOfDay }
    }).select('employee_id leave_type reason');

    const leaveEmployeeIds = new Set(approvedLeaves.map(l => l.employee_id.toString()));

    let onTimeCount = 0;
    let lateCount = 0;
    let earlyLeaveCount = 0;
    let incompleteCount = 0;
    let onLeaveFromAttendanceCount = 0;
    const presentEmployeeIds = new Set();
    const lateArrivalsList = [];

    attendances.forEach(att => {
      if (!att.employee_id) return;
      const empIdStr = att.employee_id._id ? att.employee_id._id.toString() : att.employee_id.toString();

      // Check if check_out_time is null / status is incomplete - bucketed separately
      const isIncomplete = att.status === 'incomplete' || (att.check_in_time && !att.check_out_time);

      if (att.status === 'on-time') {
        onTimeCount++;
        presentEmployeeIds.add(empIdStr);
      } else if (att.status === 'late') {
        lateCount++;
        presentEmployeeIds.add(empIdStr);

        // Format late arrival details for dashboard widget
        const emp = att.employee_id;
        const user = emp.user_id || {};
        const dept = emp.department_id || {};
        const checkIn = att.check_in_time ? new Date(att.check_in_time) : null;
        
        let lateMinutes = 0;
        if (checkIn) {
          const shiftStart = new Date(checkIn);
          shiftStart.setHours(9, 0, 0, 0); // standard 9:00 AM shift start
          if (checkIn > shiftStart) {
            lateMinutes = Math.round((checkIn.getTime() - shiftStart.getTime()) / (1000 * 60));
          }
        }

        lateArrivalsList.push({
          employee_id: emp._id,
          employee_name: user.name || 'Employee',
          department_name: dept.department_name || 'General',
          designation: emp.designation || 'Staff',
          check_in_time: checkIn ? checkIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A',
          late_minutes: lateMinutes,
          late_text: lateMinutes > 0 ? `+${lateMinutes}m late` : 'Late'
        });
      } else if (att.status === 'early-leave') {
        earlyLeaveCount++;
        presentEmployeeIds.add(empIdStr);
      } else if (att.status === 'on-leave') {
        onLeaveFromAttendanceCount++;
        leaveEmployeeIds.add(empIdStr);
      }

      if (isIncomplete) {
        incompleteCount++;
        if (att.check_in_time) {
          presentEmployeeIds.add(empIdStr);
        }
      }
    });

    const presentCount = presentEmployeeIds.size;
    const onLeaveCount = leaveEmployeeIds.size;
    const absentCount = Math.max(0, totalEmployees - presentCount - onLeaveCount);
    const attendanceRate = totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0;

    return res.status(200).json({
      success: true,
      data: {
        date: startOfDay.toISOString().split('T')[0],
        total_employees: totalEmployees,
        present: presentCount,
        absent: absentCount,
        on_leave: onLeaveCount,
        late_arrivals: lateCount,
        incomplete: incompleteCount,
        on_time: onTimeCount,
        early_leave: earlyLeaveCount,
        attendance_rate: attendanceRate,
        late_arrivals_list: lateArrivalsList
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard summary',
      error: error.message
    });
  }
};

/**
 * GET /api/dashboard/attendance-trends?range=7d|30d
 * Returns time-series attendance trends for charting.
 */
exports.getAttendanceTrends = async (req, res) => {
  try {
    const { range = '7d' } = req.query;
    const daysCount = range === '30d' ? 30 : (parseInt(range, 10) || 7);

    const totalEmployees = await Employee.countDocuments({ status: 'active' });
    const now = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const trends = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const { startOfDay, endOfDay } = getDayDateRange(d);

      const dayAttendances = await Attendance.find({
        date: { $gte: startOfDay, $lte: endOfDay }
      });

      const approvedLeaves = await LeaveRequest.find({
        status: 'approved',
        start_date: { $lte: endOfDay },
        end_date: { $gte: startOfDay }
      }).select('employee_id');

      const leaveEmpIds = new Set(approvedLeaves.map(l => l.employee_id.toString()));
      let onTime = 0;
      let late = 0;
      let earlyLeave = 0;
      let incomplete = 0;
      const presentEmpIds = new Set();

      dayAttendances.forEach(att => {
        const empId = att.employee_id ? att.employee_id.toString() : null;
        if (att.status === 'on-time') {
          onTime++;
          if (empId) presentEmpIds.add(empId);
        } else if (att.status === 'late') {
          late++;
          if (empId) presentEmpIds.add(empId);
        } else if (att.status === 'early-leave') {
          earlyLeave++;
          if (empId) presentEmpIds.add(empId);
        } else if (att.status === 'on-leave') {
          if (empId) leaveEmpIds.add(empId);
        }

        if (att.status === 'incomplete' || (att.check_in_time && !att.check_out_time)) {
          incomplete++;
          if (att.check_in_time && empId) presentEmpIds.add(empId);
        }
      });

      const presentCount = presentEmpIds.size;
      const onLeaveCount = leaveEmpIds.size;
      const absentCount = Math.max(0, totalEmployees - presentCount - onLeaveCount);
      const attendanceRate = totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0;

      trends.push({
        date: startOfDay.toISOString().split('T')[0],
        label: `${monthNames[startOfDay.getMonth()]} ${startOfDay.getDate()}`,
        day_name: dayNames[startOfDay.getDay()],
        on_time_count: onTime,
        late_count: late,
        early_leave_count: earlyLeave,
        incomplete_count: incomplete,
        on_leave_count: onLeaveCount,
        present_count: presentCount,
        absent_count: absentCount,
        attendance_rate: attendanceRate
      });
    }

    return res.status(200).json({
      success: true,
      range: `${daysCount}d`,
      data: trends
    });
  } catch (error) {
    console.error('Error fetching attendance trends:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve attendance trends',
      error: error.message
    });
  }
};

/**
 * GET /api/dashboard/department-comparison
 * Per-department attendance rates via Attendance -> Employee -> Department joins.
 */
exports.getDepartmentComparison = async (req, res) => {
  try {
    const { startOfDay, endOfDay } = getDayDateRange(new Date());

    const departments = await Department.find().lean();
    const departmentStats = [];

    for (const dept of departments) {
      // Find active employees in this department
      const employees = await Employee.find({
        department_id: dept._id,
        status: 'active'
      }).select('_id');

      const totalEmployeesInDept = employees.length;
      const empIds = employees.map(e => e._id);

      if (totalEmployeesInDept === 0) {
        departmentStats.push({
          department_id: dept._id,
          department_name: dept.department_name,
          total_employees: 0,
          present_count: 0,
          late_count: 0,
          on_leave_count: 0,
          absent_count: 0,
          attendance_rate: 0,
          avg_late_count: 0
        });
        continue;
      }

      // Attendances today for these employees
      const attendances = await Attendance.find({
        employee_id: { $in: empIds },
        date: { $gte: startOfDay, $lte: endOfDay }
      });

      // Approved leaves today
      const leaves = await LeaveRequest.find({
        employee_id: { $in: empIds },
        status: 'approved',
        start_date: { $lte: endOfDay },
        end_date: { $gte: startOfDay }
      }).select('employee_id');

      const leaveList = Array.isArray(leaves) ? leaves : [];
      const leaveEmpIds = new Set(leaveList.map(l => (l.employee_id ? l.employee_id.toString() : '')));
      const presentEmpIds = new Set();
      let lateCount = 0;
      let incompleteCount = 0;

      attendances.forEach(att => {
        const idStr = att.employee_id ? att.employee_id.toString() : '';
        if (['on-time', 'late', 'early-leave'].includes(att.status) || att.check_in_time) {
          presentEmpIds.add(idStr);
        }
        if (att.status === 'late') {
          lateCount++;
        }
        if (att.status === 'on-leave') {
          leaveEmpIds.add(idStr);
        }
        if (att.status === 'incomplete' || (att.check_in_time && !att.check_out_time)) {
          incompleteCount++;
        }
      });

      const presentCount = presentEmpIds.size;
      const onLeaveCount = leaveEmpIds.size;
      const absentCount = Math.max(0, totalEmployeesInDept - presentCount - onLeaveCount);
      const attendanceRate = totalEmployeesInDept > 0 ? Math.round((presentCount / totalEmployeesInDept) * 100) : 0;
      const avgLateCount = totalEmployeesInDept > 0 ? Number((lateCount / totalEmployeesInDept).toFixed(2)) : 0;

      departmentStats.push({
        department_id: dept._id,
        department_name: dept.department_name,
        total_employees: totalEmployeesInDept,
        present_count: presentCount,
        late_count: lateCount,
        incomplete_count: incompleteCount,
        on_leave_count: onLeaveCount,
        absent_count: absentCount,
        attendance_rate: attendanceRate,
        avg_late_count: avgLateCount
      });
    }

    return res.status(200).json({
      success: true,
      data: departmentStats
    });
  } catch (error) {
    console.error('Error fetching department comparison:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve department comparison',
      error: error.message
    });
  }
};
