import 'package:flutter/material.dart';

import '../styles/app_colors.dart';
import '../styles/app_constants.dart';
import '../styles/app_text_styles.dart';

/// Dashboard summary stat card matching the Sentinel `.stat-card` design.
///
/// Displays:
/// - Uppercase label with icon
/// - Large value number
/// - Optional delta/trend indicator
/// - Optional description note
/// - Optional progress bar
class StatCard extends StatelessWidget {
  /// The uppercase label (e.g., "PRESENT TODAY").
  final String label;

  /// The main value to display (e.g., "8h 30m").
  final String value;

  /// Icon shown in the top-right corner.
  final IconData icon;

  /// Background color for the icon container.
  final Color iconBgColor;

  /// Icon color.
  final Color iconColor;

  /// Optional note text below the value.
  final String? note;

  /// Optional progress bar value (0.0 – 1.0).
  final double? progressValue;

  /// Optional progress bar color.
  final Color? progressColor;

  const StatCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.iconBgColor,
    required this.iconColor,
    this.note,
    this.progressValue,
    this.progressColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(21),
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
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 1,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Top Row: Label + Icon ──────────────────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  label.toUpperCase(),
                  style: AppTextStyles.statLabel,
                ),
              ),
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: iconBgColor,
                  borderRadius:
                      BorderRadius.circular(AppConstants.radiusSm),
                ),
                child: Icon(icon, size: AppConstants.iconSizeMd, color: iconColor),
              ),
            ],
          ),

          const SizedBox(height: AppConstants.spacingLg),

          // ── Value ──────────────────────────────────────────────
          Text(value, style: AppTextStyles.statValue),

          // ── Note ───────────────────────────────────────────────
          if (note != null) ...[
            const SizedBox(height: AppConstants.spacingXs),
            Text(note!, style: AppTextStyles.statNote),
          ],

          // ── Progress Bar ───────────────────────────────────────
          if (progressValue != null) ...[
            const SizedBox(height: AppConstants.spacingMd),
            ClipRRect(
              borderRadius:
                  BorderRadius.circular(AppConstants.radiusFull),
              child: LinearProgressIndicator(
                value: progressValue!.clamp(0.0, 1.0),
                minHeight: AppConstants.statBarHeight,
                backgroundColor: AppColors.greyBg,
                valueColor: AlwaysStoppedAnimation<Color>(
                  progressColor ?? AppColors.green,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
