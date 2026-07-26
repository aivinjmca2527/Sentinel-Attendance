import 'package:flutter/material.dart';

import '../../styles/app_colors.dart';
import '../../styles/app_constants.dart';
import '../../styles/app_text_styles.dart';

/// Leave Management placeholder screen.
///
/// Displays a coming-soon message with back navigation.
/// Full leave request/approval functionality will be added in a future release.
class LeaveScreen extends StatelessWidget {
  const LeaveScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text('Leave Management', style: AppTextStyles.topBarTitle),
        backgroundColor: AppColors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: AppColors.border, height: 1),
        ),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppConstants.spacingXxl),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Icon container
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: AppColors.blueBg,
                  borderRadius: BorderRadius.circular(AppConstants.radiusLg),
                ),
                child: const Icon(
                  Icons.flight_takeoff_outlined,
                  size: 40,
                  color: AppColors.blue,
                ),
              ),
              const SizedBox(height: AppConstants.spacingXl),

              // Title
              Text(
                'Leave Management',
                style: AppTextStyles.pageTitle,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppConstants.spacingSm),

              // Description
              Text(
                'Submit leave requests, view leave balance, and track approval status. This feature is coming soon.',
                style: AppTextStyles.pageSubtitle,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppConstants.spacingXxl),

              // Status badge
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppConstants.spacingLg,
                  vertical: AppConstants.spacingSm,
                ),
                decoration: BoxDecoration(
                  color: AppColors.yellowBg,
                  borderRadius: BorderRadius.circular(AppConstants.radiusFull),
                ),
                child: Text(
                  'Under Development',
                  style: AppTextStyles.heading(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.yellowText,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
