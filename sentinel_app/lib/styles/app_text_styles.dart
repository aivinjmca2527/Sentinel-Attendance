import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

/// Typography system matching the Sentinel web design.
///
/// Three font families are used:
/// - **Hanken Grotesk** — Headings, brand text, navigation, card titles
/// - **Inter** — Body text, descriptions
/// - **JetBrains Mono** — Labels, buttons, monospaced elements
class AppTextStyles {
  AppTextStyles._();

  // ── Font Family Factories ─────────────────────────────────────────────

  /// Hanken Grotesk text style (heading font).
  static TextStyle heading({
    double fontSize = 16,
    FontWeight fontWeight = FontWeight.w600,
    Color color = AppColors.textPrimary,
    double? letterSpacing,
    double? height,
  }) {
    return GoogleFonts.hankenGrotesk(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      letterSpacing: letterSpacing,
      height: height,
    );
  }

  /// Inter text style (body font).
  static TextStyle body({
    double fontSize = 14,
    FontWeight fontWeight = FontWeight.w400,
    Color color = AppColors.textBody,
    double? letterSpacing,
    double? height,
  }) {
    return GoogleFonts.inter(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      letterSpacing: letterSpacing,
      height: height,
    );
  }

  /// JetBrains Mono text style (monospace font).
  static TextStyle mono({
    double fontSize = 13,
    FontWeight fontWeight = FontWeight.w500,
    Color color = AppColors.textBody,
    double? letterSpacing,
    double? height,
  }) {
    return GoogleFonts.jetBrainsMono(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      letterSpacing: letterSpacing,
      height: height,
    );
  }

  // ── Preset Combinations ───────────────────────────────────────────────

  /// Brand title — "Sentinel" on login page (Hanken Grotesk 700 / 32px).
  static TextStyle get brandTitle => heading(
        fontSize: 32,
        fontWeight: FontWeight.w700,
        color: Colors.black,
      );

  /// Brand subtitle — "Enterprise Attendance Security" (Inter 400 / 14px).
  static TextStyle get brandSubtitle => body(
        fontSize: 14,
        color: AppColors.textMuted,
      );

  /// Sidebar brand title (Hanken Grotesk 700 / 18px).
  static TextStyle get sidebarTitle => heading(
        fontSize: 18,
        fontWeight: FontWeight.w700,
      );

  /// Sidebar subtitle (Inter 400 / 12px).
  static TextStyle get sidebarSubtitle => body(
        fontSize: 12,
        color: AppColors.textSecondary,
      );

  /// Page header title — "Real-time Overview" (Hanken Grotesk 700 / 24px).
  static TextStyle get pageTitle => heading(
        fontSize: 24,
        fontWeight: FontWeight.w700,
      );

  /// Page subtitle (Inter 400 / 14px).
  static TextStyle get pageSubtitle => body(
        fontSize: 14,
        color: AppColors.textSecondary,
      );

  /// Card title — (Hanken Grotesk 700 / 18px).
  static TextStyle get cardTitle => heading(
        fontSize: 18,
        fontWeight: FontWeight.w700,
      );

  /// Card subtitle (Inter 400 / 14px).
  static TextStyle get cardSubtitle => body(
        fontSize: 14,
        color: AppColors.textSecondary,
      );

  /// Stat label — uppercase, tracked (Hanken Grotesk 600 / 12px).
  static TextStyle get statLabel => heading(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: AppColors.textSecondary,
        letterSpacing: 0.6,
      );

  /// Stat value — large number (Hanken Grotesk 700 / 30px).
  static TextStyle get statValue => heading(
        fontSize: 30,
        fontWeight: FontWeight.w700,
      );

  /// Stat delta — trend indicator (Inter 500 / 12px).
  static TextStyle statDelta({required Color color}) => body(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        color: color,
      );

  /// Stat note — small description (Inter 400 / 12px).
  static TextStyle get statNote => body(
        fontSize: 12,
        color: AppColors.textSecondary,
      );

  /// Form field label (JetBrains Mono 500 / 13px).
  static TextStyle get fieldLabel => mono(
        fontSize: 13,
        fontWeight: FontWeight.w500,
        color: AppColors.textBody,
      );

  /// Input text (Inter 400 / 16px).
  static TextStyle get inputText => body(
        fontSize: 16,
        color: AppColors.textMuted,
      );

  /// Password field input (JetBrains Mono 400 / 16px, tracked).
  static TextStyle get passwordInput => mono(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        color: AppColors.textMuted,
        letterSpacing: 1.6,
      );

  /// Primary button text (JetBrains Mono 500 / 13px, white).
  static TextStyle get buttonText => mono(
        fontSize: 13,
        fontWeight: FontWeight.w500,
        color: AppColors.white,
      );

  /// Small link — "Forgot Password?" (Inter 400 / 12px, blue).
  static TextStyle get linkSmall => body(
        fontSize: 12,
        color: AppColors.linkBlue,
      );

  /// Remember-me label (Inter 400 / 12px, muted).
  static TextStyle get checkboxLabel => body(
        fontSize: 12,
        color: AppColors.textMuted,
      );

  /// Info note text (Inter 400 / 12px, muted).
  static TextStyle get infoNote => body(
        fontSize: 12,
        color: AppColors.textMuted,
        height: 1.25, // 15px line-height ÷ 12px
      );

  /// Error message text (Inter 400 / 13px, red).
  static TextStyle get errorText => body(
        fontSize: 13,
        color: AppColors.redText,
      );

  /// Footer link (Inter 400 / 12px, muted).
  static TextStyle get footerLink => body(
        fontSize: 12,
        color: AppColors.textMuted,
      );

  /// Navigation link (Hanken Grotesk 500 / 14px).
  static TextStyle navLink({bool isActive = false}) => heading(
        fontSize: 14,
        fontWeight: FontWeight.w500,
        color: isActive ? AppColors.indigo : AppColors.textSecondary,
      );

  /// Top bar title (Hanken Grotesk 700 / 18px).
  static TextStyle get topBarTitle => heading(
        fontSize: 18,
        fontWeight: FontWeight.w700,
      );

  /// List item name (Hanken Grotesk 600 / 14px).
  static TextStyle get listItemName => heading(
        fontSize: 14,
        fontWeight: FontWeight.w600,
      );

  /// List item department (Inter 400 / 12px, secondary).
  static TextStyle get listItemSubtitle => body(
        fontSize: 12,
        color: AppColors.textSecondary,
      );

  /// View all link (Hanken Grotesk 600 / 12px, blue, uppercase).
  static TextStyle get viewAllLink => heading(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: AppColors.blue,
        letterSpacing: 0.3,
      );

  /// Avatar initials (Hanken Grotesk 700 / 12px, blue text).
  static TextStyle get avatarInitials => heading(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        color: AppColors.blueText,
      );

  /// Large avatar initials (Hanken Grotesk 700 / 14px, blue text).
  static TextStyle get avatarInitialsLarge => heading(
        fontSize: 14,
        fontWeight: FontWeight.w700,
        color: AppColors.blueText,
      );
}
