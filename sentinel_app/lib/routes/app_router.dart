import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../providers/auth_provider.dart';
import '../screens/attendance/attendance_screen.dart';
import '../screens/dashboard/dashboard_screen.dart';
import '../screens/leave/leave_screen.dart';
import '../screens/login/login_screen.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/register/register_screen.dart';

/// Application route configuration using GoRouter.
///
/// Handles:
/// - Route definitions for all screens
/// - Authentication-based redirects
/// - Navigation guards (unauthenticated → login, authenticated → dashboard)
class AppRouter {
  /// Route path constants.
  static const String login = '/login';
  static const String register = '/register';
  static const String dashboard = '/dashboard';
  static const String attendance = '/attendance';
  static const String leave = '/leave';
  static const String profile = '/profile';

  /// Creates the GoRouter instance with auth redirect logic.
  static GoRouter router(AuthProvider authProvider) {
    return GoRouter(
      initialLocation: login,
      refreshListenable: authProvider,
      redirect: (BuildContext context, GoRouterState state) {
        final isAuthenticated = authProvider.isAuthenticated;
        final isLoggingIn = state.matchedLocation == login;
        final isRegistering = state.matchedLocation == register;
        final isAuthRoute = isLoggingIn || isRegistering;

        // If not authenticated and trying to access a protected route
        if (!isAuthenticated && !isAuthRoute) {
          return login;
        }

        // If authenticated and on an auth route, redirect to dashboard
        if (isAuthenticated && isAuthRoute) {
          return dashboard;
        }

        // No redirect needed
        return null;
      },
      routes: [
        // ── Auth Routes ──────────────────────────────────────────
        GoRoute(
          path: login,
          name: 'login',
          builder: (context, state) => const LoginScreen(),
        ),
        GoRoute(
          path: register,
          name: 'register',
          builder: (context, state) => const RegisterScreen(),
        ),

        // ── Protected Routes ─────────────────────────────────────
        GoRoute(
          path: dashboard,
          name: 'dashboard',
          builder: (context, state) => const DashboardScreen(),
        ),
        GoRoute(
          path: attendance,
          name: 'attendance',
          builder: (context, state) => const AttendanceScreen(),
        ),
        GoRoute(
          path: leave,
          name: 'leave',
          builder: (context, state) => const LeaveScreen(),
        ),
        GoRoute(
          path: profile,
          name: 'profile',
          builder: (context, state) => const ProfileScreen(),
        ),
      ],
    );
  }
}
