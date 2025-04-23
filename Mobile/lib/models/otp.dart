// lib/models/otp.dart
/// Represents a one-time password (OTP) for 2FA or password reset.
class OTP {
  final String? otpID;
  final String code;
  final DateTime expiresAt;
  final DateTime createdAt;
  final String? userID;
  final String? agentID;

  OTP({
    this.otpID,
    required this.code,
    required this.expiresAt,
    required this.createdAt,
    this.userID,
    this.agentID,
  });

  factory OTP.fromJson(Map<String, dynamic> json) {
    return OTP(
      otpID: json['otpID'] as String?,
      code: json['code'] as String? ?? '',
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      createdAt: DateTime.parse(json['createdAt'] as String),
      userID: json['userID'] as String?,
      agentID: json['agentID'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'otpID': otpID,
    'code': code,
    'expiresAt': expiresAt.toIso8601String(),
    'createdAt': createdAt.toIso8601String(),
    'userID': userID,
    'agentID': agentID,
  };
}