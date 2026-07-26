import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../routes/app_router.dart';
import '../../styles/app_colors.dart';
import '../../styles/app_constants.dart';
import '../../styles/app_text_styles.dart';
import '../../utils/validators.dart';
import '../../widgets/sentinel_button.dart';
import '../../widgets/sentinel_scaffold.dart';
import '../../widgets/sentinel_text_field.dart';

/// Login screen faithfully recreating the Sentinel web login design.
///
/// Layout:
/// - Grid background + gradient overlay (via [SentinelScaffold])
/// - Brand header: shield icon, "Sentinel" title, subtitle
/// - Login card: email, password, remember me, info note, sign-in button
/// - Footer: Privacy Policy • IT Support
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _obscurePassword = true;
  bool _isFormValid = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  /// Validates the form and updates the button-enabled state.
  void _validateForm() {
    final emailValid = Validators.validateEmail(_emailController.text) == null;
    final passwordValid =
        Validators.validateLoginPassword(_passwordController.text) == null;

    setState(() {
      _isFormValid = emailValid && passwordValid;
    });
  }

  /// Handles the sign-in button press.
  Future<void> _handleSignIn() async {
    if (!_formKey.currentState!.validate()) return;

    final authProvider = context.read<AuthProvider>();
    final success = await authProvider.login(
      email: _emailController.text.trim(),
      password: _passwordController.text,
    );

    if (success && mounted) {
      context.go(AppRouter.dashboard);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SentinelScaffold(
      child: Consumer<AuthProvider>(
        builder: (context, auth, _) {
          return Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── Brand Header ───────────────────────────────────────
              _buildBrandHeader(),
              const SizedBox(height: AppConstants.spacingXl),

              // ── Login Card ─────────────────────────────────────────
              _buildLoginCard(auth),
              const SizedBox(height: AppConstants.spacingXl),

              // ── Footer Links ───────────────────────────────────────
              _buildFooterLinks(),
            ],
          );
        },
      ),
    );
  }

  /// Builds the brand header with shield icon, title, and subtitle.
  Widget _buildBrandHeader() {
    return Column(
      children: [
        // Shield icon in dark navy rounded container
        Container(
          width: AppConstants.brandIconWidth,
          height: AppConstants.brandIconHeight,
          decoration: BoxDecoration(
            color: AppColors.brandIconBg,
            borderRadius: BorderRadius.circular(AppConstants.radiusLg),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 1,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: const Icon(
            Icons.shield,
            color: AppColors.white,
            size: AppConstants.iconSizeXxl,
          ),
        ),
        const SizedBox(height: AppConstants.spacingLg),
        Text('Sentinel', style: AppTextStyles.brandTitle),
        const SizedBox(height: AppConstants.spacingSm),
        Text('Enterprise Attendance Security',
            style: AppTextStyles.brandSubtitle),
      ],
    );
  }

  /// Builds the white login card containing the form.
  Widget _buildLoginCard(AuthProvider auth) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppConstants.spacingXxxl),
      decoration: BoxDecoration(
        color: AppColors.white,
        border: Border.all(color: AppColors.borderLight),
        borderRadius: BorderRadius.circular(AppConstants.radiusLg),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 1,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Email Field ──────────────────────────────────────
            SentinelTextField(
              label: 'Corporate Email',
              hintText: 'user@company.com',
              prefixIcon: Icons.email_outlined,
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.username],
              validator: Validators.validateEmail,
              onChanged: (_) => _validateForm(),
              enabled: !auth.isLoading,
            ),
            const SizedBox(height: AppConstants.spacingXl),

            // ── Password Field ───────────────────────────────────
            SentinelTextField(
              label: 'Password',
              hintText: '••••••••',
              prefixIcon: Icons.lock_outline,
              controller: _passwordController,
              obscureText: _obscurePassword,
              isPasswordField: true,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.password],
              validator: Validators.validateLoginPassword,
              onChanged: (_) => _validateForm(),
              enabled: !auth.isLoading,
              labelTrailing: GestureDetector(
                onTap: () {
                  // Forgot password functionality
                  _showForgotPasswordDialog();
                },
                child: Text('Forgot Password?', style: AppTextStyles.linkSmall),
              ),
              suffixWidget: IconButton(
                icon: Icon(
                  _obscurePassword
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                  size: 15,
                  color: AppColors.inputIcon,
                ),
                onPressed: () {
                  setState(() {
                    _obscurePassword = !_obscurePassword;
                  });
                },
              ),
            ),
            const SizedBox(height: AppConstants.spacingXl),

            // ── Remember Me ──────────────────────────────────────
            Row(
              children: [
                SizedBox(
                  width: 16,
                  height: 16,
                  child: Checkbox(
                    value: auth.rememberMe,
                    onChanged: auth.isLoading
                        ? null
                        : (value) => auth.setRememberMe(value ?? false),
                  ),
                ),
                const SizedBox(width: AppConstants.spacingSm),
                Text('Remember me', style: AppTextStyles.checkboxLabel),
              ],
            ),
            const SizedBox(height: AppConstants.spacingXl),

            // ── Info Note ────────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(13),
              decoration: BoxDecoration(
                color: AppColors.infoNoteBg,
                border: Border.all(color: AppColors.infoNoteBorder),
                borderRadius: BorderRadius.circular(AppConstants.radiusSm),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 2),
                    child: Icon(
                      Icons.info_outline,
                      size: AppConstants.iconSizeSm,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(width: AppConstants.spacingMd),
                  Expanded(
                    child: Text(
                      'Managers and Admin roles will be required to provide a TOTP code on the next step.',
                      style: AppTextStyles.infoNote,
                    ),
                  ),
                ],
              ),
            ),

            // ── Error Message ────────────────────────────────────
            if (auth.errorMessage != null) ...[
              const SizedBox(height: AppConstants.spacingXl),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 13,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: AppColors.redBg,
                  border: Border.all(color: AppColors.redBorder),
                  borderRadius:
                      BorderRadius.circular(AppConstants.radiusMd),
                ),
                child: Text(
                  auth.errorMessage!,
                  style: AppTextStyles.errorText,
                ),
              ),
            ],
            const SizedBox(height: AppConstants.spacingXl),

            // ── Sign In Button ───────────────────────────────────
            SentinelButton(
              label: 'Sign In to Portal',
              onPressed: _isFormValid && !auth.isLoading
                  ? _handleSignIn
                  : null,
              isLoading: auth.isLoading,
            ),

            // ── Register Link ────────────────────────────────────
            const SizedBox(height: AppConstants.spacingXl),
            Container(
              padding: const EdgeInsets.only(top: 20),
              decoration: const BoxDecoration(
                border: Border(
                  top: BorderSide(
                    color: AppColors.borderLight,
                    style: BorderStyle.solid,
                  ),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    "Don't have an account? ",
                    style: AppTextStyles.body(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  GestureDetector(
                    onTap: () => context.go(AppRouter.register),
                    child: Text(
                      'Register here',
                      style: AppTextStyles.linkSmall.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Builds the footer with Privacy Policy and IT Support links.
  Widget _buildFooterLinks() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text('Privacy Policy', style: AppTextStyles.footerLink),
        Padding(
          padding:
              const EdgeInsets.symmetric(horizontal: AppConstants.spacingLg),
          child: Text('•', style: AppTextStyles.footerLink),
        ),
        Text('IT Support', style: AppTextStyles.footerLink),
      ],
    );
  }

  /// Shows a dialog for the forgot password flow.
  void _showForgotPasswordDialog() {
    final emailCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Reset Password', style: AppTextStyles.cardTitle),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Enter your corporate email and we\'ll send you a reset link.',
              style: AppTextStyles.body(
                fontSize: 14,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: AppConstants.spacingLg),
            TextField(
              controller: emailCtrl,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                hintText: 'user@company.com',
                prefixIcon: Icon(Icons.email_outlined),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final auth = context.read<AuthProvider>();
              final messenger = ScaffoldMessenger.of(context);
              final navigator = Navigator.of(ctx);
              await auth.resetPassword(emailCtrl.text.trim());
              if (ctx.mounted) {
                navigator.pop();
                messenger.showSnackBar(
                  const SnackBar(
                    content: Text('If an account exists, a reset link has been sent.'),
                  ),
                );
              }
            },
            child: const Text('Send Reset Link'),
          ),
        ],
      ),
    );
  }
}
