import 'package:flutter/material.dart';

import '../styles/app_colors.dart';
import '../styles/app_constants.dart';

/// Scaffold wrapper for authentication screens (Login, Register).
///
/// Provides the Sentinel background treatment:
/// - Light grey `#F7F9FB` background
/// - Subtle grid pattern overlay (via [CustomPainter])
/// - Top gradient overlay matching the web design
/// - Centered, scrollable content
class SentinelScaffold extends StatelessWidget {
  /// The content to display within the scaffold.
  final Widget child;

  const SentinelScaffold({
    super.key,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Stack(
        children: [
          // ── Grid Pattern Background ────────────────────────────
          Positioned.fill(
            child: Opacity(
              opacity: 0.4,
              child: CustomPaint(
                painter: _GridPatternPainter(),
              ),
            ),
          ),

          // ── Top Gradient Overlay ───────────────────────────────
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: AppConstants.gradientHeight,
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    AppColors.gradientTop,
                    AppColors.gradientBottom,
                  ],
                ),
              ),
            ),
          ),

          // ── Scrollable Content ─────────────────────────────────
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppConstants.spacingXl,
                  vertical: 80,
                ),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(
                    maxWidth: AppConstants.loginCardMaxWidth,
                  ),
                  child: child,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Paints a subtle grid pattern matching the Sentinel `.login-bg-grid` CSS.
class _GridPatternPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.gridLine
      ..strokeWidth = 1;

    const gridSize = AppConstants.gridPatternSize;

    // Vertical lines
    for (double x = 0; x <= size.width; x += gridSize) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }

    // Horizontal lines
    for (double y = 0; y <= size.height; y += gridSize) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
