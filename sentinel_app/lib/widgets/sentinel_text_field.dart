import 'package:flutter/material.dart';

import '../styles/app_colors.dart';
import '../styles/app_constants.dart';
import '../styles/app_text_styles.dart';

/// A text field matching the Sentinel `.input-wrap` design.
///
/// Features:
/// - Left prefix icon (envelope, lock, etc.)
/// - Optional right suffix action button (show/hide password)
/// - Label in JetBrains Mono 500/13px
/// - Indigo focus border
/// - Inline error display
class SentinelTextField extends StatelessWidget {
  /// The label text shown above the field.
  final String label;

  /// The placeholder/hint text inside the field.
  final String? hintText;

  /// The prefix icon (shown at the left of the input).
  final IconData? prefixIcon;

  /// Optional suffix widget (e.g., a password toggle button).
  final Widget? suffixWidget;

  /// The text editing controller.
  final TextEditingController? controller;

  /// Validation function returning null or an error string.
  final String? Function(String?)? validator;

  /// Whether the text is obscured (for password fields).
  final bool obscureText;

  /// Keyboard input type.
  final TextInputType keyboardType;

  /// Autocomplete hints.
  final Iterable<String>? autofillHints;

  /// Called when the text changes.
  final ValueChanged<String>? onChanged;

  /// Text input action (next, done, etc.).
  final TextInputAction? textInputAction;

  /// Whether this is a password-style field (uses mono font).
  final bool isPasswordField;

  /// An optional secondary widget shown to the right of the label
  /// (e.g., "Forgot Password?" link).
  final Widget? labelTrailing;

  /// Whether the field is enabled.
  final bool enabled;

  const SentinelTextField({
    super.key,
    required this.label,
    this.hintText,
    this.prefixIcon,
    this.suffixWidget,
    this.controller,
    this.validator,
    this.obscureText = false,
    this.keyboardType = TextInputType.text,
    this.autofillHints,
    this.onChanged,
    this.textInputAction,
    this.isPasswordField = false,
    this.labelTrailing,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // ── Label Row ─────────────────────────────────────────────
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: AppTextStyles.fieldLabel),
            ?labelTrailing,
          ],
        ),
        const SizedBox(height: AppConstants.spacingSm),

        // ── Input Field ───────────────────────────────────────────
        TextFormField(
          controller: controller,
          validator: validator,
          obscureText: obscureText,
          keyboardType: keyboardType,
          autofillHints: autofillHints,
          onChanged: onChanged,
          textInputAction: textInputAction,
          enabled: enabled,
          style: isPasswordField
              ? AppTextStyles.passwordInput
              : AppTextStyles.inputText,
          decoration: InputDecoration(
            hintText: hintText,
            prefixIcon: prefixIcon != null
                ? Padding(
                    padding: const EdgeInsets.only(left: 14, right: 12),
                    child: Icon(
                      prefixIcon,
                      size: AppConstants.iconSizeMd,
                      color: AppColors.inputIcon,
                    ),
                  )
                : null,
            prefixIconConstraints: prefixIcon != null
                ? const BoxConstraints(minWidth: 41, minHeight: 0)
                : null,
            suffixIcon: suffixWidget,
          ),
        ),
      ],
    );
  }
}
