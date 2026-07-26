/// Form validation utilities for the Sentinel Attendance app.
///
/// Every validator returns `null` on success or an error message string
/// on failure, matching the `FormField.validator` signature.
class Validators {
  Validators._();

  /// Validates that a field is not empty.
  static String? validateRequired(String? value, {String fieldName = 'This field'}) {
    if (value == null || value.trim().isEmpty) {
      return '$fieldName is required';
    }
    return null;
  }

  /// Validates email format using a standard regex.
  static String? validateEmail(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Email is required';
    }
    final email = value.trim();
    // RFC 5322 simplified email regex
    final emailRegex = RegExp(
      r'^[a-zA-Z0-9.!#$%&*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$',
    );
    if (!emailRegex.hasMatch(email)) {
      return 'Please enter a valid email address';
    }
    return null;
  }

  /// Validates password with comprehensive rules:
  /// - Minimum 8 characters
  /// - At least one uppercase letter
  /// - At least one lowercase letter
  /// - At least one digit
  /// - At least one special character
  static String? validatePassword(String? value) {
    if (value == null || value.isEmpty) {
      return 'Password is required';
    }
    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!RegExp(r'[A-Z]').hasMatch(value)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!RegExp(r'[a-z]').hasMatch(value)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!RegExp(r'[0-9]').hasMatch(value)) {
      return 'Password must contain at least one number';
    }
    if (!RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(value)) {
      return 'Password must contain at least one special character';
    }
    return null;
  }

  /// Validates that the login password is non-empty and ≥8 characters
  /// (without the full complexity requirements used in registration).
  static String? validateLoginPassword(String? value) {
    if (value == null || value.isEmpty) {
      return 'Password is required';
    }
    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }
    return null;
  }

  /// Validates that the confirm password matches the original password.
  static String? validateConfirmPassword(String? value, String password) {
    if (value == null || value.isEmpty) {
      return 'Please confirm your password';
    }
    if (value != password) {
      return 'Passwords do not match';
    }
    return null;
  }

  /// Validates phone number format (digits only, 10-15 chars).
  static String? validatePhone(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Phone number is required';
    }
    final phone = value.trim().replaceAll(RegExp(r'[\s\-\(\)\+]'), '');
    if (phone.length < 10 || phone.length > 15) {
      return 'Phone number must be 10-15 digits';
    }
    if (!RegExp(r'^[0-9]+$').hasMatch(phone)) {
      return 'Phone number must contain only digits';
    }
    return null;
  }

  /// Validates Employee ID format (non-empty, alphanumeric + hyphens).
  static String? validateEmployeeId(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Employee ID is required';
    }
    final id = value.trim();
    if (!RegExp(r'^[a-zA-Z0-9\-]+$').hasMatch(id)) {
      return 'Employee ID must be alphanumeric (hyphens allowed)';
    }
    return null;
  }

  /// Validates that a dropdown selection is not null or empty.
  static String? validateDropdown(String? value, {String fieldName = 'This field'}) {
    if (value == null || value.isEmpty) {
      return 'Please select a $fieldName';
    }
    return null;
  }
}
