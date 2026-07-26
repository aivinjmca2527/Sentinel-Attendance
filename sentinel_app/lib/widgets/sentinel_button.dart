import 'package:flutter/material.dart';

import '../styles/app_colors.dart';
import '../styles/app_constants.dart';
import '../styles/app_text_styles.dart';

/// Primary action button matching the Sentinel `.submit-btn` design.
///
/// Features:
/// - Full-width by default
/// - `#0F172A` dark navy background
/// - JetBrains Mono 500/13px white text
/// - Loading state with circular progress indicator
/// - Disabled state with reduced opacity
/// - Double-tap prevention while loading
class SentinelButton extends StatelessWidget {
  /// The button label text.
  final String label;

  /// Called when the button is pressed (null = disabled).
  final VoidCallback? onPressed;

  /// Whether the button is in a loading state.
  final bool isLoading;

  /// Whether the button stretches to full width.
  final bool fullWidth;

  /// Optional icon shown before the label.
  final IconData? icon;

  const SentinelButton({
    super.key,
    required this.label,
    this.onPressed,
    this.isLoading = false,
    this.fullWidth = true,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: fullWidth ? double.infinity : null,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.white,
          disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.5),
          disabledForegroundColor: AppColors.white.withValues(alpha: 0.7),
          padding: const EdgeInsets.symmetric(
            horizontal: 17,
            vertical: 11,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppConstants.radiusMd),
          ),
          elevation: 1,
          shadowColor: Colors.black.withValues(alpha: 0.05),
        ),
        child: isLoading
            ? const SizedBox(
                height: 18,
                width: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(AppColors.white),
                ),
              )
            : Row(
                mainAxisSize:
                    fullWidth ? MainAxisSize.max : MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: AppConstants.iconSizeMd),
                    const SizedBox(width: AppConstants.spacingSm),
                  ],
                  Text(label, style: AppTextStyles.buttonText),
                ],
              ),
      ),
    );
  }
}
