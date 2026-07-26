import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../routes/app_router.dart';
import '../../styles/app_colors.dart';
import '../../styles/app_constants.dart';
import '../../styles/app_text_styles.dart';
import '../../utils/helpers.dart';
import '../../widgets/avatar_circle.dart';
import '../../widgets/sentinel_button.dart';

/// Profile screen displaying employee details and logout.
///
/// Reads employee data from [AuthProvider] (fetched from Supabase).
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, auth, _) {
        final employee = auth.currentEmployee;

        return Scaffold(
          backgroundColor: AppColors.background,
          appBar: AppBar(
            title: Text('Profile', style: AppTextStyles.topBarTitle),
            backgroundColor: AppColors.white,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(1),
              child: Container(color: AppColors.border, height: 1),
            ),
          ),
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(AppConstants.spacingXl),
            child: Column(
              children: [
                const SizedBox(height: AppConstants.spacingLg),

                // ── Avatar & Name ──────────────────────────────────
                AvatarCircle.large(
                  initials: employee?.initials ?? '--',
                ),
                const SizedBox(height: AppConstants.spacingLg),
                Text(
                  employee?.fullName ?? 'Unknown User',
                  style: AppTextStyles.pageTitle,
                ),
                const SizedBox(height: AppConstants.spacingXs),
                Text(
                  employee?.designation ?? '',
                  style: AppTextStyles.pageSubtitle,
                ),
                const SizedBox(height: AppConstants.spacingXs),
                // Role badge
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppConstants.spacingSm,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.indigoBg,
                    borderRadius:
                        BorderRadius.circular(AppConstants.radiusFull),
                  ),
                  child: Text(
                    employee?.department ?? '',
                    style: AppTextStyles.heading(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.indigo,
                    ),
                  ),
                ),

                const SizedBox(height: AppConstants.spacingXxl),

                // ── Details Card ────────────────────────────────────
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppColors.white,
                    border: Border.all(color: AppColors.border),
                    borderRadius:
                        BorderRadius.circular(AppConstants.radiusLg),
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
                      Text('Employee Information',
                          style: AppTextStyles.cardTitle),
                      const SizedBox(height: AppConstants.spacingLg),
                      _buildDetailRow(
                          'Full Name', employee?.fullName ?? '—'),
                      _buildDetailRow(
                          'Employee ID', employee?.employeeId ?? '—'),
                      _buildDetailRow(
                          'Email', employee?.email ?? '—'),
                      _buildDetailRow(
                          'Phone', employee?.phone ?? '—'),
                      _buildDetailRow(
                          'Department', employee?.department ?? '—'),
                      _buildDetailRow(
                          'Designation', employee?.designation ?? '—'),
                      _buildDetailRow(
                        'Member Since',
                        employee != null
                            ? Helpers.formatDate(employee.createdAt)
                            : '—',
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: AppConstants.spacingXxl),

                // ── Logout Button ───────────────────────────────────
                SentinelButton(
                  label: 'Sign Out',
                  icon: Icons.logout,
                  isLoading: auth.isLoading,
                  onPressed: () async {
                    await auth.logout();
                    if (context.mounted) {
                      context.go(AppRouter.login);
                    }
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  /// Builds a single detail row with label and value.
  Widget _buildDetailRow(String label, String value) {
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
}
