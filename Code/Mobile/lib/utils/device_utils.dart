import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';

class DeviceUtils {
  static Future<String> getDeviceIdentifier() async {
    try {
      final deviceInfo = DeviceInfoPlugin();
      if (defaultTargetPlatform == TargetPlatform.android) {
        final androidInfo = await deviceInfo.androidInfo;
        return androidInfo.id;
      } else if (defaultTargetPlatform == TargetPlatform.iOS) {
        final iosInfo = await deviceInfo.iosInfo;
        return iosInfo.identifierForVendor ?? 'unknown_ios_device';
      }
      return 'unknown_device';
    } catch (e) {
      if (kDebugMode) print('Failed to get device identifier: $e');
      return 'unknown_device_${DateTime.now().millisecondsSinceEpoch}';
    }
  }
}