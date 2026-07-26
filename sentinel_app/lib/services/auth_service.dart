import 'package:supabase_flutter/supabase_flutter.dart';

/// Handles all Supabase Authentication operations.
///
/// This service wraps the Supabase Auth client and provides clean methods
/// for sign-in, sign-up, sign-out, and session management.
class AuthService {
  final SupabaseClient _client;

  AuthService({SupabaseClient? client})
      : _client = client ?? Supabase.instance.client;

  /// Returns the current Supabase auth user, or null if not authenticated.
  User? get currentUser => _client.auth.currentUser;

  /// Returns the current session, or null if expired/not present.
  Session? get currentSession => _client.auth.currentSession;

  /// Whether a user is currently authenticated.
  bool get isAuthenticated => currentUser != null;

  /// Stream of auth state changes (sign-in, sign-out, token refresh).
  Stream<AuthState> get onAuthStateChange =>
      _client.auth.onAuthStateChange;

  /// Signs in a user with email and password.
  ///
  /// Returns the [AuthResponse] on success.
  /// Throws an [AuthException] on failure.
  Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) async {
    return await _client.auth.signInWithPassword(
      email: email.trim(),
      password: password,
    );
  }

  /// Creates a new user account with email and password.
  ///
  /// Returns the [AuthResponse] on success.
  /// Throws an [AuthException] on failure.
  Future<AuthResponse> signUp({
    required String email,
    required String password,
  }) async {
    return await _client.auth.signUp(
      email: email.trim(),
      password: password,
    );
  }

  /// Signs out the current user and clears the session.
  Future<void> signOut() async {
    await _client.auth.signOut();
  }

  /// Sends a password reset email to the given address.
  Future<void> resetPassword(String email) async {
    await _client.auth.resetPasswordForEmail(email.trim());
  }
}
