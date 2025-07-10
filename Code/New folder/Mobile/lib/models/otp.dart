class OTP {
  final String otpID;
  final String code;
  final DateTime expiresAt;
  final DateTime createdAt;
  final String userID;

  OTP({
    required this.otpID,
    required this.code,
    required this.expiresAt,
    required this.createdAt,
    required this.userID,
  });

  factory OTP.fromJson(Map<String, dynamic> json) {
    return OTP(
      otpID: json['otpID'] as String,
      code: json['code'] as String,
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      createdAt: DateTime.parse(json['createdAt'] as String),
      userID: json['userID'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'otpID': otpID,
      'code': code,
      'expiresAt': expiresAt.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
      'userID': userID,
    };
  }
}