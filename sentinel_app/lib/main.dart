import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'providers/auth_provider.dart';
import 'providers/dashboard_provider.dart';
import 'routes/app_router.dart';
import 'styles/app_theme.dart';
import 'utils/app_config.dart';

/// Entry point for the Sentinel Attendance Management System.
///
/// Initialization order:
/// 1. Flutter bindings
/// 2. Environment variables (.env)
/// 3. Supabase client
/// 4. Providers + GoRouter
/// 5. MaterialApp.router
void main() async {
  // Ensure Flutter bindings are initialized before async work.
  WidgetsFlutterBinding.ensureInitialized();

  // Lock to portrait orientation for consistent mobile UI.
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Load environment variables from the .env file.
  await dotenv.load(fileName: '.env');

  // Initialize the Supabase client with credentials from .env.
  await Supabase.initialize(
    url: AppConfig.supabaseUrl,
    publishableKey: AppConfig.supabaseAnonKey,
  );

  runApp(const SentinelApp());
}

/// Root widget for the Sentinel Attendance application.
///
/// Sets up [MultiProvider] with all application providers,
/// then builds [MaterialApp.router] with GoRouter and the Sentinel theme.
///
/// **Important**: The [GoRouter] instance is created once in [initState]
/// and reused across rebuilds. Recreating it on every build would destroy
/// navigation state and cause redirect loops.
class SentinelApp extends StatefulWidget {
  const SentinelApp({super.key});

  @override
  State<SentinelApp> createState() => _SentinelAppState();
}

class _SentinelAppState extends State<SentinelApp> {
  late final AuthProvider _authProvider;
  late final DashboardProvider _dashboardProvider;
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _authProvider = AuthProvider();
    _dashboardProvider = DashboardProvider();

    // Create the router ONCE with the auth provider for redirect logic.
    // GoRouter's refreshListenable already listens to AuthProvider changes.
    _router = AppRouter.router(_authProvider);

    // Initialize auth state (check for existing session / stored credentials).
    _authProvider.initialize();
  }

  @override
  void dispose() {
    _router.dispose();
    _authProvider.dispose();
    _dashboardProvider.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>.value(value: _authProvider),
        ChangeNotifierProvider<DashboardProvider>.value(
            value: _dashboardProvider),
      ],
      child: MaterialApp.router(
        title: 'Sentinel Attendance',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        routerConfig: _router,
      ),
    );
  }
}
