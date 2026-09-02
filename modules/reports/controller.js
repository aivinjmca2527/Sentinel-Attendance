const Attendance = require('../../shared/models/Attendance');
const Employee = require('../../shared/models/Employee');
const Department = require('../../shared/models/Department');
const LeaveRequest = require('../../shared/models/LeaveRequest');
const User = require('../../shared/models/User');

/**
 * COORDINATION NOTE (Aivin):
 * We query the Attendance and LeaveRequest models directly via Mongoose rather than calling
 * external HTTP routes.
 * Rationale: Direct database querying allows efficient joins, batch streaming, and CSV export
 * generation without incurring multi-hop HTTP serialization overhead.
 */

/**
 * Helper to escape CSV cell fields safely.
 */
function escapeCsvValue(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Helper to parse range query param (e.g. "2023-10-01,2023-10-31" or query params)
 */
function parseDateRange(query) {
  let start, end;
  if (query.range && typeof query.range === 'string' && query.range.includes(',')) {
    const parts = query.range.split(',');
    start = new Date(parts[0].trim());
    end = new Date(parts[1].trim());
  } else if (query.startDate && query.endDate) {
    start = new Date(query.startDate);
    end = new Date(query.endDate);
  } else {
    // Default to last 30 days
    end = new Date();
    start = new Date();
    start.setDate(end.getDate() - 30);
  }

  if (isNaN(start.getTime())) {
    start = new Date();
    start.setDate(start.getDate() - 30);
  }
  if (isNaN(end.getTime())) {
    end = new Date();
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * GET /api/reports/organisation?range=start,end&format=json|csv
 * Attendance + leave summary for the range, across all employees/departments.
 */
exports.getOrganisationReport = async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const { start, end } = parseDateRange(req.query);

    const startIso = start.toISOString().split('T')[0];
    const endIso = end.toISOString().split('T')[0];

    // Fetch all active employees
    const employees = await Employee.find({ status: 'active' })
      .populate('user_id', 'name email role')
      .populate('department_id', 'department_name')
      .lean();

    // Fetch attendance records in range
    const attendances = await Attendance.find({
      date: { $gte: start, $lte: end }
    })
      .populate({
        path: 'employee_id',
        populate: [
          { path: 'user_id', select: 'name email role' },
          { path: 'department_id', select: 'department_name' }
        ]
      })
      .sort({ date: -1 })
      .lean();

    // Fetch approved leave requests in range
    const leaves = await LeaveRequest.find({
      status: 'approved',
      start_date: { $lte: end },
      end_date: { $gte: start }
    })
      .populate({
        path: 'employee_id',
        populate: [
          { path: 'user_id', select: 'name email role' },
          { path: 'department_id', select: 'department_name' }
        ]
      })
      .sort({ start_date: -1 })
      .lean();

    // Transform attendance records into structured report rows
    let totalPresent = 0;
    let totalLate = 0;
    let totalEarlyLeave = 0;
    let totalIncomplete = 0;
    let totalWorkingHours = 0;
    let countedWorkingHours = 0;

    const reportRows = [];

    attendances.forEach(att => {
      const emp = att.employee_id || {};
      const user = emp.user_id || {};
      const dept = emp.department_id || {};

      const checkInDate = att.check_in_time ? new Date(att.check_in_time) : null;
      const checkOutDate = att.check_out_time ? new Date(att.check_out_time) : null;

      // Handle incomplete status / check_out_time null separately
      let status = att.status || 'unknown';
      if (att.check_in_time && !att.check_out_time && status !== 'incomplete') {
        status = 'incomplete';
      }

      if (status === 'on-time') totalPresent++;
      if (status === 'late') {
        totalLate++;
        totalPresent++;
      }
      if (status === 'early-leave') {
        totalEarlyLeave++;
        totalPresent++;
      }
      if (status === 'incomplete') {
        totalIncomplete++;
        if (att.check_in_time) totalPresent++;
      }

      const workingHours = typeof att.working_hours === 'number' ? att.working_hours : (
        checkInDate && checkOutDate ? Number(((checkOutDate - checkInDate) / (1000 * 60 * 60)).toFixed(2)) : null
      );

      if (workingHours !== null) {
        totalWorkingHours += workingHours;
        countedWorkingHours++;
      }

      const recordDate = att.date ? new Date(att.date).toISOString().split('T')[0] : 'N/A';

      reportRows.push({
        type: 'attendance',
        date: recordDate,
        employee_name: user.name || 'Unknown',
        email: user.email || 'N/A',
        department: dept.department_name || 'N/A',
        designation: emp.designation || 'N/A',
        status: status,
        check_in_time: checkInDate ? checkInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : 'N/A',
        check_out_time: checkOutDate ? checkOutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : 'N/A',
        working_hours: workingHours !== null ? workingHours : (status === 'incomplete' ? 'In Progress' : '0.00'),
        leave_type: 'N/A',
        reason_or_notes: status === 'incomplete' ? 'Pending Check-out' : (status === 'late' ? 'Late Check-in' : '')
      });
    });

    // Add approved leave entries
    leaves.forEach(lv => {
      const emp = lv.employee_id || {};
      const user = emp.user_id || {};
      const dept = emp.department_id || {};

      const lvStart = new Date(lv.start_date).toISOString().split('T')[0];
      const lvEnd = new Date(lv.end_date).toISOString().split('T')[0];

      reportRows.push({
        type: 'leave',
        date: `${lvStart} to ${lvEnd}`,
        employee_name: user.name || 'Unknown',
        email: user.email || 'N/A',
        department: dept.department_name || 'N/A',
        designation: emp.designation || 'N/A',
        status: 'on-leave',
        check_in_time: 'N/A',
        check_out_time: 'N/A',
        working_hours: '0.00',
        leave_type: lv.leave_type || 'General',
        reason_or_notes: lv.reason || 'Approved Leave'
      });
    });

    const avgWorkingHours = countedWorkingHours > 0 ? Number((totalWorkingHours / countedWorkingHours).toFixed(2)) : 0;

    // CSV format requested
    if (format.toLowerCase() === 'csv') {
      const headers = [
        'Date',
        'Employee Name',
        'Email',
        'Department',
        'Designation',
        'Status',
        'Check In Time',
        'Check Out Time',
        'Working Hours',
        'Leave Type',
        'Notes'
      ];

      const csvLines = [];
      csvLines.push(headers.map(escapeCsvValue).join(','));

      reportRows.forEach(row => {
        const line = [
          escapeCsvValue(row.date),
          escapeCsvValue(row.employee_name),
          escapeCsvValue(row.email),
          escapeCsvValue(row.department),
          escapeCsvValue(row.designation),
          escapeCsvValue(row.status),
          escapeCsvValue(row.check_in_time),
          escapeCsvValue(row.check_out_time),
          escapeCsvValue(row.working_hours),
          escapeCsvValue(row.leave_type),
          escapeCsvValue(row.reason_or_notes)
        ].join(',');
        csvLines.push(line);
      });

      const csvData = csvLines.join('\r\n');
      const filename = `organisation_attendance_report_${startIso}_to_${endIso}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csvData);
    }

    // Default JSON format
    return res.status(200).json({
      success: true,
      meta: {
        range: { start: startIso, end: endIso },
        total_employees: employees.length,
        total_records: reportRows.length
      },
      summary: {
        total_present: totalPresent,
        total_late: totalLate,
        total_early_leave: totalEarlyLeave,
        total_incomplete: totalIncomplete,
        total_on_leave: leaves.length,
        avg_working_hours: avgWorkingHours
      },
      data: reportRows
    });
  } catch (error) {
    console.error('Error generating organisation report:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate organisation report',
      error: error.message
    });
  }
};
