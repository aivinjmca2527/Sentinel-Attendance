import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/employee.dart';
import '../services/auth_service.dart';
import '../services/employee_service.dart';
import '../utils/app_config.dart';

/// Manages authentication state across the app.
///
/// Wraps [AuthService] and [EmployeeService], handles login/register flows,
/// persists "remember me" via [FlutterSecureStorage], and notifies listeners
/// of state changes.
class AuthProvider extends ChangeNotifier {
  final AuthService _authService;
  final EmployeeService _employeeService;
  final FlutterSecureStorage _secureStorage;

  // ── State ───────────────────────────────────────────────────────────
  bool _isLoading = false;
  bool _isAuthenticated = false;
  String? _errorMessage;
  Employee? _currentEmployee;
  bool _rememberMe = false;

  // ── Getters ─────────────────────────────────────────────────────────
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _isAuthenticated;
  String? get errorMessage => _errorMessage;
  Employee? get currentEmployee => _currentEmployee;
  bool get rememberMe => _rememberMe;

  AuthProvider({
    AuthService? authService,
    EmployeeService? employeeService,
    FlutterSecureStorage? secureStorage,
  })  : _authService = authService ?? AuthService(),
        _employeeService = employeeService ?? EmployeeService(),
        _secureStorage = secureStorage ?? const FlutterSecureStorage();

  /// Whether secure storage is available on this platform.
  /// Web has limited support; avoid crashes by guarding reads/writes.
  bool get _canUseSecureStorage => !kIsWeb;

  /// Initializes auth state by checking for an existing session.
  ///
  /// Called once at app startup.
  Future<void> initialize() async {
    _isLoading = true;
    notifyListeners();

    try {
      // Skip initialization if Supabase is not configured
      if (!AppConfig.isConfigured) {
        _isLoading = false;
        notifyListeners();
        return;
      }

      if (_authService.isAuthenticated) {
        // Session still valid from Supabase's own persistence
        await _loadEmployeeProfile();
        _isAuthenticated = true;
      } else if (_canUseSecureStorage) {
        // Try auto-login with stored credentials (mobile only)
        final storedEmail = await _secureStorage.read(key: 'sentinel_email');
        final storedPassword =
            await _secureStorage.read(key: 'sentinel_password');
        if (storedEmail != null && storedPassword != null) {
          await _authService.signIn(
              email: storedEmail, password: storedPassword);
          await _loadEmployeeProfile();
          _isAuthenticated = true;
        }
      }
    } catch (e) {
      // Silent failure — user will be directed to login screen
      debugPrint('Auth initialization error: $e');
      _isAuthenticated = false;
      try {
        if (_canUseSecureStorage) await _clearStoredCredentials();
      } catch (_) {
        // Ignore storage cleanup errors
      }
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Sets the remember-me flag.
  void setRememberMe(bool value) {
    _rememberMe = value;
    notifyListeners();
  }

  /// Signs in with email and password via Supabase Auth.
  ///
  /// On success, loads the employee profile and optionally stores credentials.
  Future<bool> login({
    required String email,
    required String password,
  }) async {
    // Check Supabase configuration first
    if (!AppConfig.isConfigured) {
      _errorMessage = AppConfig.notConfiguredMessage;
      notifyListeners();
      return false;
    }

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _authService.signIn(
        email: email.trim(),
        password: password,
      );

      debugPrint('Login response user: ${response.user?.id}');

      // Load the employee profile from the database
      await _loadEmployeeProfile();

      // Persist credentials if "Remember Me" is checked (mobile only)
      if (_rememberMe && _canUseSecureStorage) {
        await _secureStorage.write(
            key: 'sentinel_email', value: email.trim());
        await _secureStorage.write(
            key: 'sentinel_password', value: password);
      } else if (_canUseSecureStorage) {
        await _clearStoredCredentials();
      }

      _isAuthenticated = true;
      _isLoading = false;
      notifyListeners();
      return true;
    } on AuthException catch (e) {
      debugPrint('Auth error on login: ${e.message}');
      _errorMessage = _sanitize(e.message);
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      debugPrint('Unexpected error on login: ${e.runtimeType}: $e');
      _errorMessage = _sanitize(
        'An unexpected error occurred. Please check your connection and try again.',
      );
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Registers a new user with Supabase Auth and creates an employee record.
  Future<bool> register({
    required String fullName,
    required String employeeId,
    required String email,
    required String phone,
    required String department,
    required String designation,
    required String password,
  }) async {
    // Check Supabase configuration first
    if (!AppConfig.isConfigured) {
      _errorMessage = AppConfig.notConfiguredMessage;
      notifyListeners();
      return false;
    }

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // 1. Check uniqueness before creating the user
      final isIdUnique =
          await _employeeService.isEmployeeIdUnique(employeeId);
      if (!isIdUnique) {
        _errorMessage = 'This Employee ID is already in use';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      final isEmailAvailable =
          await _employeeService.isEmailUnique(email);
      if (!isEmailAvailable) {
        _errorMessage = 'This email is already registered';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      // 2. Create the auth user
      final authResponse = await _authService.signUp(
        email: email.trim(),
        password: password,
      );

      final authUser = authResponse.user;
      if (authUser == null) {
        _errorMessage = 'Registration failed. Please try again.';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      debugPrint('Registered auth user: ${authUser.id}');

      // No email verification required — sign in immediately if no session.
      if (authResponse.session == null) {
        await _authService.signIn(
          email: email.trim(),
          password: password,
        );
      }

      // 3. Create the employee profile in the database
      final employee = Employee(
        id: '', // Auto-generated by Supabase
        authUserId: authUser.id,
        fullName: fullName.trim(),
        employeeId: employeeId.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        department: department,
        designation: designation,
        createdAt: DateTime.now(),
      );

      _currentEmployee = await _employeeService.createEmployee(employee);
      _isAuthenticated = true;
      _isLoading = false;
      notifyListeners();
      return true;
    } on AuthException catch (e) {
      debugPrint('Auth error on register: ${e.message}');
      _errorMessage = _sanitize(e.message);
      _isLoading = false;
      notifyListeners();
      return false;
    } on PostgrestException catch (e) {
      debugPrint('DB error on register: ${e.message}');
      _errorMessage = _sanitize(e.message);
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      debugPrint('Unexpected error on register: $e');
      _errorMessage = _sanitize(
        'An unexpected error occurred. Please check your connection and try again.',
      );
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Signs out the current user and clears all state.
  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    try {
      await _authService.signOut();
      if (_canUseSecureStorage) {
        await _clearStoredCredentials();
      }
    } catch (_) {
      // Sign out locally regardless of network errors
    }

    _isAuthenticated = false;
    _currentEmployee = null;
    _errorMessage = null;
    _isLoading = false;
    notifyListeners();
  }

  /// Clears any authentication error message.
  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  /// Sends a password reset email.
  Future<bool> resetPassword(String email) async {
    if (!AppConfig.isConfigured) {
      _errorMessage = AppConfig.notConfiguredMessage;
      notifyListeners();
      return false;
    }
    try {
      await _authService.resetPassword(email);
      return true;
    } catch (e) {
      _errorMessage = 'Failed to send reset email. Please try again.';
      notifyListeners();
      return false;
    }
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  /// Loads the employee profile from the database using the current auth user.
  ///
  /// If the profile doesn't exist yet (e.g. user signed up outside the app,
  /// or the employees table hasn't been created), this method will:
  /// 1. Try to auto-create the employee record from auth metadata.
  /// 2. Fall back to a local-only Employee object so the app can proceed.
  Future<void> _loadEmployeeProfile() async {
    final user = _authService.currentUser;
    if (user == null) return;

    try {
      _currentEmployee =
          await _employeeService.getEmployeeByAuthId(user.id);

      // If no row exists, try creating one automatically
      if (_currentEmployee == null) {
        debugPrint('No employee profile found — auto-creating one.');
        _currentEmployee = await _tryCreateEmployeeProfile(user);
      }
    } catch (e) {
      // Database error (table missing, RLS, network, etc.)
      debugPrint('Failed to load employee profile: ${e.runtimeType}: $e');
      // Build a fallback so the user is not blocked from the dashboard
      _currentEmployee = _buildFallbackEmployee(user);
    }
  }

  /// Attempts to insert an employee record derived from the auth user.
  ///
  /// Returns the created [Employee] on success, or a local fallback on failure.
  Future<Employee> _tryCreateEmployeeProfile(User user) async {
    final email = user.email ?? '';
    final meta = user.userMetadata ?? {};
    final fullName = (meta['full_name'] as String?) ??
        (meta['name'] as String?) ??
        email.split('@').first;

    final employee = Employee(
      id: '',
      authUserId: user.id,
      fullName: fullName,
      employeeId: 'EMP-${user.id.substring(0, 6).toUpperCase()}',
      email: email.toLowerCase(),
      phone: (meta['phone'] as String?) ?? '',
      department: (meta['department'] as String?) ?? 'General',
      designation: (meta['designation'] as String?) ?? 'Employee',
      createdAt: DateTime.now(),
    );

    try {
      return await _employeeService.createEmployee(employee);
    } catch (e) {
      debugPrint('Auto-create employee failed: ${e.runtimeType}: $e');
      // Return a local-only fallback
      return _buildFallbackEmployee(user);
    }
  }

  /// Builds a local-only [Employee] from auth user data.
  ///
  /// Used when the database is unreachable or the table doesn't exist.
  Employee _buildFallbackEmployee(User user) {
    final email = user.email ?? '';
    final meta = user.userMetadata ?? {};
    final fullName = (meta['full_name'] as String?) ??
        (meta['name'] as String?) ??
        email.split('@').first;

    return Employee(
      id: user.id,
      authUserId: user.id,
      fullName: fullName,
      employeeId: 'EMP-${user.id.substring(0, 6).toUpperCase()}',
      email: email.toLowerCase(),
      phone: (meta['phone'] as String?) ?? '',
      department: (meta['department'] as String?) ?? 'General',
      designation: (meta['designation'] as String?) ?? 'Employee',
      createdAt: DateTime.now(),
    );
  }

  /// Removes stored credentials from secure storage.
  Future<void> _clearStoredCredentials() async {
    await _secureStorage.delete(key: 'sentinel_email');
    await _secureStorage.delete(key: 'sentinel_password');
  }

  /// Strips HTML tags and excess whitespace from error messages.
  ///
  /// When Supabase is misconfigured, API calls can return HTML error pages
  /// instead of JSON. This prevents raw HTML from being shown to the user.
  static String _sanitize(String message) {
    // If the message contains HTML tags, it's not a real error message
    if (message.contains('<html') || message.contains('<!DOCTYPE')) {
      return 'Unable to connect to the server. '
          'Please check your Supabase configuration in the .env file.';
    }
    // Strip any stray HTML tags
    final stripped = message.replaceAll(RegExp(r'<[^>]*>'), '').trim();
    // Collapse multiple whitespace/newlines
    return stripped.replaceAll(RegExp(r'\s+'), ' ');
  }
}
