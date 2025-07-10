class NotificationPreference {
  final String preferenceID;
  final String userID;
  final Map<String, dynamic> preferences;
  final DateTime createdAt;
  final DateTime updatedAt;

  NotificationPreference({
    required this.preferenceID,
    required this.userID,
    required this.preferences,
    required this.createdAt,
    required this.updatedAt,
  });

  factory NotificationPreference.fromJson(Map<String, dynamic> json) {
    return NotificationPreference(
      preferenceID: json['preferenceID'] as String,
      userID: json['userID'] as String,
      preferences: json['preferences'] as Map<String, dynamic>,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'preferenceID': preferenceID,
      'userID': userID,
      'preferences': preferences,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}