import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

class DeviceUtils {
  static const _storage = FlutterSecureStorage();
  static const _deviceIdKey = 'device_identifier';
  static const _uuid = Uuid();

  static Future<String> getDeviceIdentifier() async {
    try {
      final cachedId = await _storage.read(key: _deviceIdKey);
      if (cachedId != null) return cachedId;

      final deviceInfo = DeviceInfoPlugin();
      String deviceId;
      if (defaultTargetPlatform == TargetPlatform.android) {
        final androidInfo = await deviceInfo.androidInfo;
        deviceId = androidInfo.id;
      } else if (defaultTargetPlatform == TargetPlatform.iOS) {
        final iosInfo = await deviceInfo.iosInfo;
        deviceId = iosInfo.identifierForVendor ?? 'unknown_ios_device';
      } else {
        deviceId = 'unknown_device_${_uuid.v4()}';
      }

      await _storage.write(key: _deviceIdKey, value: deviceId);
      return deviceId;
    } catch (e) {
      if (kDebugMode) print('Failed to get device identifier: $e');
      return 'unknown_device_${_uuid.v4()}';
    }
  }
}