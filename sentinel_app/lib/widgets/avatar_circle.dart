import 'package:flutter/material.dart';

import '../styles/app_colors.dart';
import '../styles/app_constants.dart';
import '../styles/app_text_styles.dart';

/// Circular avatar displaying the user's initials.
///
/// Matches the Sentinel `.avatar-circle` and `.avatar-initials` CSS.
class AvatarCircle extends StatelessWidget {
  /// The initials to display (e.g., "JD").
  final String initials;

  /// Size of the avatar circle.
  final double size;

  /// Background color of the circle.
  final Color backgroundColor;

  /// Text color for the initials.
  final Color textColor;

  /// Whether to show a border.
  final bool showBorder;

  const AvatarCircle({
    super.key,
    required this.initials,
    this.size = AppConstants.avatarSizeSm,
    this.backgroundColor = AppColors.indigoBg,
    this.textColor = AppColors.blueText,
    this.showBorder = true,
  });

  /// Creates a small (32px) avatar suitable for app bars.
  const AvatarCircle.small({
    super.key,
    required this.initials,
  })  : size = AppConstants.avatarSizeSm,
        backgroundColor = AppColors.indigoBg,
        textColor = AppColors.blueText,
        showBorder = true;

  /// Creates a medium (40px) avatar suitable for list items.
  const AvatarCircle.medium({
    super.key,
    required this.initials,
  })  : size = AppConstants.avatarSizeMd,
        backgroundColor = AppColors.blueLight,
        textColor = AppColors.blueText,
        showBorder = false;

  /// Creates a large (64px) avatar suitable for profile headers.
  const AvatarCircle.large({
    super.key,
    required this.initials,
  })  : size = AppConstants.avatarSizeLg,
        backgroundColor = AppColors.indigoBg,
        textColor = AppColors.blueText,
        showBorder = true;

  @override
  Widget build(BuildContext context) {
    // Scale font size proportionally to the avatar size
    final fontSize = size <= AppConstants.avatarSizeSm
        ? 12.0
        : size <= AppConstants.avatarSizeMd
            ? 14.0
            : 22.0;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: backgroundColor,
        shape: BoxShape.circle,
        border: showBorder
            ? Border.all(color: AppColors.border, width: 1)
            : null,
      ),
      child: Center(
        child: Text(
          initials,
          style: AppTextStyles.heading(
            fontSize: fontSize,
            fontWeight: FontWeight.w700,
            color: textColor,
          ),
        ),
      ),
    );
  }
}
