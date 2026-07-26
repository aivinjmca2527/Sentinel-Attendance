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

/// Registration screen for new employee accounts.
///
/// All fields are validated before submission. Employee ID and email
/// uniqueness are checked against Supabase before creating the account.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();

  // ── Controllers ────────────────────────────────────────────────────
  final _fullNameController = TextEditingController();
  final _employeeIdController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  // ── State ──────────────────────────────────────────────────────────
  String? _selectedDepartment;
  String? _selectedDesignation;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _isFormValid = false;

  @override
  void dispose() {
    _fullNameController.dispose();
    _employeeIdController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  /// Validates all fields and updates the register button state.
  void _validateForm() {
    final nameValid =
        Validators.validateRequired(_fullNameController.text, fieldName: 'Full Name') == null;
    final idValid =
        Validators.validateEmployeeId(_employeeIdController.text) == null;
    final emailValid =
        Validators.validateEmail(_emailController.text) == null;
    final phoneValid =
        Validators.validatePhone(_phoneController.text) == null;
    final deptValid = _selectedDepartment != null;
    final desigValid = _selectedDesignation != null;
    final passwordValid =
        Validators.validatePassword(_passwordController.text) == null;
    final confirmValid = Validators.validateConfirmPassword(
            _confirmPasswordController.text, _passwordController.text) ==
        null;

    setState(() {
      _isFormValid = nameValid &&
          idValid &&
          emailValid &&
          phoneValid &&
          deptValid &&
          desigValid &&
          passwordValid &&
          confirmValid;
    });
  }

  /// Handles the register button press.
  Future<void> _handleRegister() async {
    if (!_formKey.currentState!.validate()) return;

    final authProvider = context.read<AuthProvider>();
    final success = await authProvider.register(
      fullName: _fullNameController.text.trim(),
      employeeId: _employeeIdController.text.trim(),
      email: _emailController.text.trim(),
      phone: _phoneController.text.trim(),
      department: _selectedDepartment!,
      designation: _selectedDesignation!,
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
              // ── Brand Header (compact) ─────────────────────────
              _buildBrandHeader(),
              const SizedBox(height: AppConstants.spacingXl),

              // ── Registration Card ──────────────────────────────
              _buildRegistrationCard(auth),
              const SizedBox(height: AppConstants.spacingXl),

              // ── Footer Links ───────────────────────────────────
              _buildFooterLinks(),
            ],
          );
        },
      ),
    );
  }

  /// Brand header — compact variant for the registration screen.
  Widget _buildBrandHeader() {
    return Column(
      children: [
        Container(
          width: 56,
          height: 42,
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
            size: 22,
          ),
        ),
        const SizedBox(height: AppConstants.spacingMd),
        Text(
          'Create Account',
          style: AppTextStyles.heading(
            fontSize: 26,
            fontWeight: FontWeight.w700,
            color: Colors.black,
          ),
        ),
        const SizedBox(height: AppConstants.spacingXs),
        Text(
          'Register for Sentinel Attendance',
          style: AppTextStyles.brandSubtitle,
        ),
      ],
    );
  }

  /// Builds the registration form card.
  Widget _buildRegistrationCard(AuthProvider auth) {
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
            // ── Full Name ────────────────────────────────────────
            SentinelTextField(
              label: 'Full Name',
              hintText: 'John Doe',
              prefixIcon: Icons.person_outline,
              controller: _fullNameController,
              textInputAction: TextInputAction.next,
              validator: (v) =>
                  Validators.validateRequired(v, fieldName: 'Full Name'),
              onChanged: (_) => _validateForm(),
              enabled: !auth.isLoading,
            ),
            const SizedBox(height: AppConstants.spacingXl),

            // ── Employee ID ──────────────────────────────────────
            SentinelTextField(
              label: 'Employee ID',
              hintText: 'EMP-001',
              prefixIcon: Icons.badge_outlined,
              controller: _employeeIdController,
              textInputAction: TextInputAction.next,
              validator: Validators.validateEmployeeId,
              onChanged: (_) => _validateForm(),
              enabled: !auth.isLoading,
            ),
            const SizedBox(height: AppConstants.spacingXl),

            // ── Email ────────────────────────────────────────────
            SentinelTextField(
              label: 'Corporate Email',
              hintText: 'user@company.com',
              prefixIcon: Icons.email_outlined,
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              validator: Validators.validateEmail,
              onChanged: (_) => _validateForm(),
              enabled: !auth.isLoading,
            ),
            const SizedBox(height: AppConstants.spacingXl),

            // ── Phone Number ─────────────────────────────────────
            SentinelTextField(
              label: 'Phone Number',
              hintText: '1234567890',
              prefixIcon: Icons.phone_outlined,
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.next,
              validator: Validators.validatePhone,
              onChanged: (_) => _validateForm(),
              enabled: !auth.isLoading,
            ),
            const SizedBox(height: AppConstants.spacingXl),

            // ── Department Dropdown ──────────────────────────────
            _buildDropdown(
              label: 'Department',
              icon: Icons.business_outlined,
              value: _selectedDepartment,
              items: AppConstants.departments,
              onChanged: auth.isLoading
                  ? null
                  : (v) {
                      setState(() => _selectedDepartment = v);
                      _validateForm();
                    },
              validator: (v) =>
                  Validators.validateDropdown(v, fieldName: 'department'),
            ),
            const SizedBox(height: AppConstants.spacingXl),

            // ── Designation Dropdown ─────────────────────────────
            _buildDropdown(
              label: 'Designation',
              icon: Icons.work_outline,
              value: _selectedDesignation,
              items: AppConstants.designations,
              onChanged: auth.isLoading
                  ? null
                  : (v) {
                      setState(() => _selectedDesignation = v);
                      _validateForm();
                    },
              validator: (v) =>
                  Validators.validateDropdown(v, fieldName: 'designation'),
            ),
            const SizedBox(height: AppConstants.spacingXl),

            // ── Password ─────────────────────────────────────────
            SentinelTextField(
              label: 'Password',
              hintText: '••••••••',
              prefixIcon: Icons.lock_outline,
              controller: _passwordController,
              obscureText: _obscurePassword,
              isPasswordField: true,
              textInputAction: TextInputAction.next,
              validator: Validators.validatePassword,
              onChanged: (_) => _validateForm(),
              enabled: !auth.isLoading,
              suffixWidget: IconButton(
                icon: Icon(
                  _obscurePassword
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                  size: 15,
                  color: AppColors.inputIcon,
                ),
                onPressed: () {
                  setState(() => _obscurePassword = !_obscurePassword);
                },
              ),
            ),
            const SizedBox(height: AppConstants.spacingXl),

            // ── Confirm Password ─────────────────────────────────
            SentinelTextField(
              label: 'Confirm Password',
              hintText: '••••••••',
              prefixIcon: Icons.lock_outline,
              controller: _confirmPasswordController,
              obscureText: _obscureConfirmPassword,
              isPasswordField: true,
              textInputAction: TextInputAction.done,
              validator: (v) => Validators.validateConfirmPassword(
                  v, _passwordController.text),
              onChanged: (_) => _validateForm(),
              enabled: !auth.isLoading,
              suffixWidget: IconButton(
                icon: Icon(
                  _obscureConfirmPassword
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                  size: 15,
                  color: AppColors.inputIcon,
                ),
                onPressed: () {
                  setState(() =>
                      _obscureConfirmPassword = !_obscureConfirmPassword);
                },
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
                child: Text(auth.errorMessage!, style: AppTextStyles.errorText),
              ),
            ],
            const SizedBox(height: AppConstants.spacingXl),

            // ── Register Button ──────────────────────────────────
            SentinelButton(
              label: 'Create Account',
              onPressed: _isFormValid && !auth.isLoading
                  ? _handleRegister
                  : null,
              isLoading: auth.isLoading,
            ),

            // ── Login Link ──────────────────────────────────────
            const SizedBox(height: AppConstants.spacingXl),
            Container(
              padding: const EdgeInsets.only(top: 20),
              decoration: const BoxDecoration(
                border: Border(
                  top: BorderSide(color: AppColors.borderLight),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Already have an account? ',
                    style: AppTextStyles.body(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  GestureDetector(
                    onTap: () => context.go(AppRouter.login),
                    child: Text(
                      'Sign in',
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

  /// Builds a styled dropdown field matching the Sentinel input design.
  Widget _buildDropdown({
    required String label,
    required IconData icon,
    required String? value,
    required List<String> items,
    required void Function(String?)? onChanged,
    required String? Function(String?)? validator,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppTextStyles.fieldLabel),
        const SizedBox(height: AppConstants.spacingSm),
        DropdownButtonFormField<String>(
          initialValue: value,
          onChanged: onChanged,
          validator: validator,
          isExpanded: true,
          icon: const Icon(Icons.keyboard_arrow_down,
              color: AppColors.inputIcon),
          decoration: InputDecoration(
            prefixIcon: Padding(
              padding: const EdgeInsets.only(left: 14, right: 12),
              child: Icon(icon,
                  size: AppConstants.iconSizeMd, color: AppColors.inputIcon),
            ),
            prefixIconConstraints:
                const BoxConstraints(minWidth: 41, minHeight: 0),
            hintText: 'Select $label',
          ),
          style: AppTextStyles.inputText,
          items: items
              .map((item) => DropdownMenuItem(
                    value: item,
                    child: Text(item, style: AppTextStyles.inputText),
                  ))
              .toList(),
        ),
      ],
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
}
