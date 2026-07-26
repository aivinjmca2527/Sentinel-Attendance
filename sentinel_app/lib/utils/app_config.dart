import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Supabase configuration.
///
/// **Option 1 (Recommended for web):** Paste your credentials directly below.
/// **Option 2:** Use the `.env` file in the project root.
///
/// Find these values in: Supabase Dashboard → Settings → API.
class AppConfig {
  AppConfig._();

  // ═══════════════════════════════════════════════════════════════════
  // ▶▶▶  YOUR SUPABASE CREDENTIALS  ◀◀◀
  // ═══════════════════════════════════════════════════════════════════

  static const String _directUrl = 'https://qgibbgfoncuiqwyrahqw.supabase.co';
  static const String _directKey = 'sb_publishable_mfZ3Au4FXTRmMLs58mXimg_u7iuDFEk';

  // ═══════════════════════════════════════════════════════════════════

  /// Supabase project URL — uses direct value if set, else falls back to .env.
  static String get supabaseUrl {
    if (_directUrl.isNotEmpty) return _directUrl;
    return dotenv.env['SUPABASE_URL'] ?? '';
  }

  /// Supabase anonymous/publishable key — uses direct value if set, else .env.
  static String get supabaseAnonKey {
    if (_directKey.isNotEmpty) return _directKey;
    return dotenv.env['SUPABASE_ANON_KEY'] ?? '';
  }

  /// Returns `true` if credentials are properly configured.
  static bool get isConfigured {
    final url = supabaseUrl;
    final key = supabaseAnonKey;
    return url.isNotEmpty &&
        key.isNotEmpty &&
        url.startsWith('https://') &&
        !url.contains('YOUR_SUPABASE');
  }

  /// Human-readable error message when credentials are not configured.
  static const String notConfiguredMessage =
      'Supabase is not configured. Open lib/utils/app_config.dart '
      'and paste your SUPABASE_URL and SUPABASE_ANON_KEY.\n\n'
      'Find these values in: Supabase Dashboard → Settings → API.';
}
