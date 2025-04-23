import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';
import 'package:flutter/foundation.dart';

class DeviceUtils {
  static const _storage = FlutterSecureStorage();
  static const _deviceIdKey = 'deviceIdentifier';

  static Future<String> getDeviceIdentifier() async {
    try {
      // Check if device ID is already stored
      String? deviceId = await _storage.read(key: _deviceIdKey);
      if (deviceId != null && deviceId.isNotEmpty) {
        if (kDebugMode) print('Loaded deviceIdentifier: $deviceId');
        return deviceId;
      }

      // Generate a new device ID
      final deviceInfo = DeviceInfoPlugin();
      String uniqueId;

      if (defaultTargetPlatform == TargetPlatform.android) {
        final androidInfo = await deviceInfo.androidInfo;
        uniqueId = androidInfo.id ?? const Uuid().v4();
      } else if (defaultTargetPlatform == TargetPlatform.iOS) {
        final iosInfo = await deviceInfo.iosInfo;
        uniqueId = iosInfo.identifierForVendor ?? const Uuid().v4();
      } else {
        uniqueId = const Uuid().v4();
      }

      deviceId = 'device_${uniqueId.replaceAll('-', '')}';
      await _storage.write(key: _deviceIdKey, value: deviceId);
      if (kDebugMode) print('Generated deviceIdentifier: $deviceId');
      return deviceId;
    } catch (e) {
      if (kDebugMode) print('Error generating deviceIdentifier: $e');
      return 'device_${const Uuid().v4().replaceAll('-', '')}';
    }
  }
}