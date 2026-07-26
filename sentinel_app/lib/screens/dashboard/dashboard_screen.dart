import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/employee.dart';
import '../../providers/auth_provider.dart';
import '../../providers/dashboard_provider.dart';
import '../../routes/app_router.dart';
import '../../styles/app_colors.dart';
import '../../styles/app_constants.dart';
import '../../styles/app_text_styles.dart';
import '../../utils/helpers.dart';
import '../../widgets/avatar_circle.dart';
import '../../widgets/stat_card.dart';

/// Main dashboard screen displaying employee data from Supabase.
///
/// Recreates the Sentinel dashboard layout adapted for mobile:
/// - Navigation drawer (sidebar on web → drawer on mobile)
/// - Welcome header with employee info
/// - Summary stat cards (2-column grid)
/// - Recent attendance list
/// - Quick action buttons
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    // Load dashboard data after the widget is built
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  void _loadData() {
    final employee = context.read<AuthProvider>().currentEmployee;
    if (employee != null) {
      context.read<DashboardProvider>().loadDashboardData(employee);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer2<AuthProvider, DashboardProvider>(
      builder: (context, auth, dashboard, _) {
        final employee = auth.currentEmployee;

        return Scaffold(
          backgroundColor: AppColors.background,
          appBar: _buildAppBar(employee),
          drawer: _buildNavigationDrawer(context, employee),
          body: dashboard.isLoading
              ? const Center(
                  child: CircularProgressIndicator(
                    color: AppColors.primary,
                  ),
                )
              : RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: () async {
                    if (employee != null) {
                      await dashboard.refresh(employee);
                    }
                  },
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(AppConstants.spacingXl),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // ── Welcome Header ───────────────────────
                        _buildWelcomeHeader(employee),
                        const SizedBox(height: AppConstants.spacingXl),

                        // ── Summary Cards ────────────────────────
                        _buildSummaryCards(dashboard),
                        const SizedBox(height: AppConstants.spacingXl),

                        // ── Employee Info Card ───────────────────
                        _buildEmployeeInfoCard(employee),
                        const SizedBox(height: AppConstants.spacingXl),

                        // ── Recent Attendance ────────────────────
                        _buildRecentAttendanceCard(dashboard),
                        const SizedBox(height: AppConstants.spacingXl),

                        // ── Quick Actions ────────────────────────
                        _buildQuickActions(),
                        const SizedBox(height: AppConstants.spacingXl),

                        // ── Error Message ────────────────────────
                        if (dashboard.errorMessage != null)
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(13),
                            decoration: BoxDecoration(
                              color: AppColors.redBg,
                              border: Border.all(color: AppColors.redBorder),
                              borderRadius: BorderRadius.circular(
                                  AppConstants.radiusMd),
                            ),
                            child: Text(
                              dashboard.errorMessage!,
                              style: AppTextStyles.errorText,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
        );
      },
    );
  }

  /// Builds the app bar with title, notification icon, and avatar.
  PreferredSizeWidget _buildAppBar(Employee? employee) {
    return AppBar(
      title: Text('Sentinel Attendance', style: AppTextStyles.topBarTitle),
      backgroundColor: AppColors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Container(
          color: AppColors.border,
          height: 1,
        ),
      ),
      actions: [
        // Notification bell with dot
        Stack(
          children: [
            IconButton(
              icon: const Icon(Icons.notifications_outlined,
                  color: AppColors.textSecondary),
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Notifications coming soon')),
                );
              },
            ),
            Positioned(
              top: 10,
              right: 10,
              child: Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: AppColors.notificationDot,
                  shape: BoxShape.circle,
                ),
              ),
            ),
          ],
        ),
        // User avatar
        Padding(
          padding: const EdgeInsets.only(right: AppConstants.spacingLg),
          child: AvatarCircle.small(
            initials: employee?.initials ?? '--',
          ),
        ),
      ],
    );
  }

  /// Builds the navigation drawer (mobile adaptation of sidebar).
  Widget _buildNavigationDrawer(BuildContext context, Employee? employee) {
    return Drawer(
      child: Column(
        children: [
          // ── Drawer Header ──────────────────────────────────────
          Container(
            width: double.infinity,
            padding: EdgeInsets.only(
              top: MediaQuery.of(context).padding.top + AppConstants.spacingXl,
              left: AppConstants.spacingXl,
              right: AppConstants.spacingXl,
              bottom: AppConstants.spacingXl,
            ),
            decoration: const BoxDecoration(
              color: AppColors.white,
              border: Border(
                bottom: BorderSide(color: AppColors.border),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Brand row
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.greyBg,
                        border: Border.all(color: AppColors.border),
                        borderRadius:
                            BorderRadius.circular(AppConstants.radiusSm),
                      ),
                      child: const Icon(
                        Icons.shield,
                        color: AppColors.textPrimary,
                        size: 18,
                      ),
                    ),
                    const SizedBox(width: AppConstants.spacingMd),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Sentinel', style: AppTextStyles.sidebarTitle),
                        Text('Attendance System',
                            style: AppTextStyles.sidebarSubtitle),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),

          // ── Navigation Links ──────────────────────────────────
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppConstants.spacingMd,
                vertical: AppConstants.spacingSm,
              ),
              child: Column(
                children: [
                  const SizedBox(height: AppConstants.spacingSm),
                  _buildNavLink(
                    icon: Icons.dashboard_outlined,
                    label: 'Dashboard',
                    isActive: true,
                    onTap: () {
                      Navigator.of(context).pop();
                    },
                  ),
                  _buildNavLink(
                    icon: Icons.calendar_today_outlined,
                    label: 'Attendance',
                    onTap: () {
                      Navigator.of(context).pop();
                      context.push(AppRouter.attendance);
                    },
                  ),
                  _buildNavLink(
                    icon: Icons.flight_takeoff_outlined,
                    label: 'Leave Requests',
                    onTap: () {
                      Navigator.of(context).pop();
                      context.push(AppRouter.leave);
                    },
                  ),
                  _buildNavLink(
                    icon: Icons.person_outline,
                    label: 'Profile',
                    onTap: () {
                      Navigator.of(context).pop();
                      context.push(AppRouter.profile);
                    },
                  ),
                ],
              ),
            ),
          ),

          // ── Bottom Actions ────────────────────────────────────
          Container(
            decoration: const BoxDecoration(
              border: Border(
                top: BorderSide(color: AppColors.border),
              ),
            ),
            padding: const EdgeInsets.all(AppConstants.spacingLg),
            child: _buildNavLink(
              icon: Icons.logout,
              label: 'Sign Out',
              textColor: AppColors.redText,
              onTap: () async {
                final goRouter = GoRouter.of(context);
                final authProvider = context.read<AuthProvider>();
                Navigator.of(context).pop();
                await authProvider.logout();
                if (mounted) goRouter.go(AppRouter.login);
              },
            ),
          ),
        ],
      ),
    );
  }

  /// Builds a single navigation link for the drawer.
  Widget _buildNavLink({
    required IconData icon,
    required String label,
    bool isActive = false,
    Color? textColor,
    required VoidCallback onTap,
  }) {
    final color = textColor ??
        (isActive ? AppColors.indigo : AppColors.textSecondary);
    final bgColor = isActive ? AppColors.indigoBg : Colors.transparent;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppConstants.spacingXs),
      child: Material(
        color: bgColor,
        borderRadius: BorderRadius.circular(AppConstants.radiusMd),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppConstants.radiusMd),
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppConstants.spacingMd,
              vertical: 10,
            ),
            decoration: isActive
                ? BoxDecoration(
                    borderRadius:
                        BorderRadius.circular(AppConstants.radiusMd),
                    border: Border(
                      right: BorderSide(color: color, width: 4),
                    ),
                  )
                : null,
            child: Row(
              children: [
                Icon(icon, size: AppConstants.iconSizeXl, color: color),
                const SizedBox(width: AppConstants.spacingMd),
                Text(
                  label,
                  style: AppTextStyles.navLink(isActive: isActive).copyWith(
                    color: color,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Builds the welcome header section.
  Widget _buildWelcomeHeader(Employee? employee) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${Helpers.getGreeting()}, ${employee?.fullName.split(' ').first ?? 'User'}',
          style: AppTextStyles.pageTitle,
        ),
        const SizedBox(height: AppConstants.spacingXs),
        Text(
          'Live attendance tracking • ${Helpers.formatDate(DateTime.now())}',
          style: AppTextStyles.pageSubtitle,
        ),
      ],
    );
  }

  /// Builds the 2x2 grid of summary stat cards.
  Widget _buildSummaryCards(DashboardProvider dashboard) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: AppConstants.spacingLg,
      mainAxisSpacing: AppConstants.spacingLg,
      childAspectRatio: 1.35,
      children: [
        // Today's Status
        StatCard(
          label: "Today's Status",
          value: Helpers.capitalize(
              Helpers.formatStatus(dashboard.todayStatus)),
          icon: dashboard.todayStatus == 'present' ||
                  dashboard.todayStatus == 'late'
              ? Icons.check_circle_outline
              : Icons.cancel_outlined,
          iconBgColor: dashboard.todayStatus == 'present'
              ? AppColors.greenBg
              : dashboard.todayStatus == 'late'
                  ? AppColors.yellowBg
                  : AppColors.redBg,
          iconColor: dashboard.todayStatus == 'present'
              ? AppColors.greenText
              : dashboard.todayStatus == 'late'
                  ? AppColors.yellowText
                  : AppColors.redText,
          note: dashboard.todayAttendance?.hasCheckedIn == true
              ? 'Checked in at ${Helpers.formatTime(dashboard.todayAttendance!.checkIn!)}'
              : 'Not checked in yet',
        ),

        // Working Hours
        StatCard(
          label: 'Working Hours',
          value: Helpers.formatWorkingHours(dashboard.todayWorkingHours),
          icon: Icons.access_time,
          iconBgColor: AppColors.blueBg,
          iconColor: AppColors.blueText,
          note: 'Today',
          progressValue: dashboard.todayWorkingHours / 8.0,
          progressColor: AppColors.blue,
        ),

        // Recent Attendance
        StatCard(
          label: 'This Week',
          value: '${dashboard.recentAttendance.where((a) => a.status == 'present' || a.status == 'late').length}/7',
          icon: Icons.calendar_today,
          iconBgColor: AppColors.indigoBg,
          iconColor: AppColors.indigo,
          note: 'Days present',
        ),

        // Leave Balance
        StatCard(
          label: 'Leave Balance',
          value: '${dashboard.totalRemainingLeave}',
          icon: Icons.flight_takeoff,
          iconBgColor: AppColors.yellowBg,
          iconColor: AppColors.yellowText,
          note: 'of ${dashboard.totalAllocatedLeave} days remaining',
          progressValue: dashboard.totalAllocatedLeave > 0
              ? dashboard.totalRemainingLeave /
                  dashboard.totalAllocatedLeave
              : 0,
          progressColor: AppColors.orange,
        ),
      ],
    );
  }

  /// Builds the employee info card.
  Widget _buildEmployeeInfoCard(Employee? employee) {
    if (employee == null) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.white,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppConstants.radiusLg),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 1.5,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Employee Details', style: AppTextStyles.cardTitle),
          const SizedBox(height: AppConstants.spacingLg),
          _buildInfoRow('Employee ID', employee.employeeId),
          _buildInfoRow('Department', employee.department),
          _buildInfoRow('Designation', employee.designation),
          _buildInfoRow('Email', employee.email),
        ],
      ),
    );
  }

  /// Builds a single info row with label and value.
  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppConstants.spacingMd),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: AppTextStyles.body(
                fontSize: 13,
                color: AppColors.textSecondary,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: AppTextStyles.heading(
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Builds the recent attendance list card.
  Widget _buildRecentAttendanceCard(DashboardProvider dashboard) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.white,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppConstants.radiusLg),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 1.5,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        children: [
          // ── Card Header ────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: 20,
              vertical: 20,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Recent Attendance', style: AppTextStyles.cardTitle),
                Text(
                  'LAST 7 DAYS',
                  style: AppTextStyles.viewAllLink,
                ),
              ],
            ),
          ),
          const Divider(),

          // ── Attendance List ────────────────────────────────────
          if (dashboard.recentAttendance.isEmpty)
            Padding(
              padding: const EdgeInsets.all(AppConstants.spacingXxl),
              child: Column(
                children: [
                  const Icon(
                    Icons.event_note_outlined,
                    size: 48,
                    color: AppColors.inputIcon,
                  ),
                  const SizedBox(height: AppConstants.spacingMd),
                  Text(
                    'No attendance records found',
                    style: AppTextStyles.body(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: dashboard.recentAttendance.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final record = dashboard.recentAttendance[index];
                return _buildAttendanceListItem(record);
              },
            ),
        ],
      ),
    );
  }

  /// Builds a single attendance list item matching the Sentinel late-item style.
  Widget _buildAttendanceListItem(dynamic record) {
    final statusColor = record.status == 'present'
        ? AppColors.greenText
        : record.status == 'late'
            ? AppColors.yellowText
            : record.status == 'on_leave'
                ? AppColors.blueText
                : AppColors.redText;

    final statusBg = record.status == 'present'
        ? AppColors.greenBg
        : record.status == 'late'
            ? AppColors.yellowBg
            : record.status == 'on_leave'
                ? AppColors.blueBg
                : AppColors.redBg;

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppConstants.spacingLg,
        vertical: AppConstants.spacingMd,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Left side: Date
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                Helpers.formatShortDate(record.date),
                style: AppTextStyles.listItemName,
              ),
              const SizedBox(height: 2),
              Text(
                record.hasCheckedIn
                    ? 'Check-in: ${Helpers.formatTime(record.checkIn!)}'
                    : 'No check-in',
                style: AppTextStyles.listItemSubtitle,
              ),
            ],
          ),
          // Right side: Status badge + hours
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius:
                      BorderRadius.circular(AppConstants.radiusFull),
                ),
                child: Text(
                  Helpers.formatStatus(record.status),
                  style: AppTextStyles.heading(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: statusColor,
                  ),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                Helpers.formatWorkingHours(record.workingHours),
                style: AppTextStyles.listItemSubtitle,
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Builds the quick actions row.
  Widget _buildQuickActions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Quick Actions', style: AppTextStyles.cardTitle),
        const SizedBox(height: AppConstants.spacingLg),
        Row(
          children: [
            Expanded(
              child: _buildActionButton(
                icon: Icons.fingerprint,
                label: 'Mark\nAttendance',
                color: AppColors.primary,
                onTap: () => context.push(AppRouter.attendance),
              ),
            ),
            const SizedBox(width: AppConstants.spacingMd),
            Expanded(
              child: _buildActionButton(
                icon: Icons.event_note_outlined,
                label: 'Request\nLeave',
                color: AppColors.blue,
                onTap: () => context.push(AppRouter.leave),
              ),
            ),
            const SizedBox(width: AppConstants.spacingMd),
            Expanded(
              child: _buildActionButton(
                icon: Icons.person_outline,
                label: 'View\nProfile',
                color: AppColors.indigo,
                onTap: () => context.push(AppRouter.profile),
              ),
            ),
          ],
        ),
      ],
    );
  }

  /// Builds a single quick action button.
  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Material(
      color: AppColors.white,
      borderRadius: BorderRadius.circular(AppConstants.radiusLg),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppConstants.radiusLg),
        child: Container(
          padding: const EdgeInsets.all(AppConstants.spacingLg),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppConstants.radiusLg),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius:
                      BorderRadius.circular(AppConstants.radiusMd),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(height: AppConstants.spacingSm),
              Text(
                label,
                textAlign: TextAlign.center,
                style: AppTextStyles.heading(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
