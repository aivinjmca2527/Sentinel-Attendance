import 'package:intl/intl.dart';

/// General-purpose helper utilities.
class Helpers {
  Helpers._();

  /// Extracts initials from a full name (max 2 characters).
  ///
  /// Examples:
  /// - "John Doe" → "JD"
  /// - "Sarah" → "S"
  /// - "" → "--"
  static String getInitials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return name.isNotEmpty ? name[0].toUpperCase() : '--';
  }

  /// Formats a [DateTime] to "Jul 25, 2026" style.
  static String formatDate(DateTime date) {
    return DateFormat('MMM d, yyyy').format(date);
  }

  /// Formats a [DateTime] to "09:30 AM" style.
  static String formatTime(DateTime dateTime) {
    return DateFormat('hh:mm a').format(dateTime);
  }

  /// Formats a [DateTime] to "Mon, Jul 25" style.
  static String formatShortDate(DateTime date) {
    return DateFormat('EEE, MMM d').format(date);
  }

  /// Formats working hours as "8h 30m".
  static String formatWorkingHours(double? hours) {
    if (hours == null || hours <= 0) return '0h 0m';
    final h = hours.floor();
    final m = ((hours - h) * 60).round();
    return '${h}h ${m}m';
  }

  /// Returns a greeting based on the time of day.
  static String getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  /// Capitalizes the first letter of a string.
  static String capitalize(String text) {
    if (text.isEmpty) return text;
    return '${text[0].toUpperCase()}${text.substring(1)}';
  }

  /// Returns a human-readable status label from a status key.
  static String formatStatus(String status) {
    return status
        .replaceAll('_', ' ')
        .split(' ')
        .map((word) => capitalize(word))
        .join(' ');
  }

  /// Returns today's date with time set to midnight.
  static DateTime get today {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day);
  }
}
