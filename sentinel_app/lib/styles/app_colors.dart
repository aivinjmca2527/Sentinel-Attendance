import 'package:flutter/material.dart';

/// All color constants for the Sentinel Attendance app.
///
/// Extracted from the Sentinel web CSS design tokens (`:root` variables).
/// No color value should be hardcoded outside this file.
class AppColors {
  AppColors._();

  // ── Background & Surface ──────────────────────────────────────────────
  static const Color background = Color(0xFFF7F9FB);
  static const Color white = Color(0xFFFFFFFF);
  static const Color surface = Color(0xFFF2F4F6);

  // ── Borders ───────────────────────────────────────────────────────────
  static const Color border = Color(0xFFC0C8CD);
  static const Color borderLight = Color(0xFFE2E8F0);

  // ── Text ──────────────────────────────────────────────────────────────
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF475569);
  static const Color textMuted = Color(0xFF45464D);
  static const Color textBody = Color(0xFF191C1E);

  // ── Brand / Primary ───────────────────────────────────────────────────
  static const Color primary = Color(0xFF0F172A);
  static const Color primaryHover = Color(0xFF1E293B);
  static const Color brandIconBg = Color(0xFF131B2E);

  // ── Indigo Accent ─────────────────────────────────────────────────────
  static const Color indigo = Color(0xFF4F46E5);
  static const Color indigoBg = Color(0xFFEEF2FF);

  // ── Semantic: Green ───────────────────────────────────────────────────
  static const Color green = Color(0xFF22C55E);
  static const Color greenBg = Color(0xFFF0FDF4);
  static const Color greenText = Color(0xFF16A34A);

  // ── Semantic: Red ─────────────────────────────────────────────────────
  static const Color red = Color(0xFFEF4444);
  static const Color redBg = Color(0xFFFEF2F2);
  static const Color redText = Color(0xFFDC2626);
  static const Color redBorder = Color(0xFFFECACA);

  // ── Semantic: Blue ────────────────────────────────────────────────────
  static const Color blue = Color(0xFF2563EB);
  static const Color blueBg = Color(0xFFEFF6FF);
  static const Color blueText = Color(0xFF1D4ED8);
  static const Color blueLight = Color(0xFFDBEAFE);

  // ── Semantic: Yellow ──────────────────────────────────────────────────
  static const Color yellowBg = Color(0xFFFEFCE8);
  static const Color yellowText = Color(0xFFCA8A04);

  // ── Semantic: Orange ──────────────────────────────────────────────────
  static const Color orange = Color(0xFFF97316);

  // ── Input / Interactive ───────────────────────────────────────────────
  static const Color inputIcon = Color(0xFF9AA1AC);
  static const Color linkBlue = Color(0xFF0051D5);
  static const Color focusOutline = indigo;
  static const Color checkboxAccent = textPrimary;

  // ── Info Note ─────────────────────────────────────────────────────────
  static const Color infoNoteBg = Color(0xFFF2F4F6);
  static const Color infoNoteBorder = Color(0x4DC6C6CD); // rgba(198,198,205,0.3)

  // ── Grid Background ───────────────────────────────────────────────────
  static const Color gridLine = Color(0xFFE2E8F0);
  static const Color gradientTop = Color(0x33DAE2FD); // rgba(218,226,253,0.2)
  static const Color gradientBottom = Color(0x00DAE2FD); // rgba(218,226,253,0)

  // ── Notification Dot ──────────────────────────────────────────────────
  static const Color notificationDot = Color(0xFFBA1A1A);

  // ── Grey Background ───────────────────────────────────────────────────
  static const Color greyBg = Color(0xFFECEFEE);
}
