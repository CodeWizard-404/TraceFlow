class Notification {
  final String notificationID;
  final String userID;
  final String type;
  final String message;
  final String status;
  final String channel;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  Notification({
    required this.notificationID,
    required this.userID,
    required this.type,
    required this.message,
    required this.status,
    required this.channel,
    this.createdAt,
    this.updatedAt,
  });

  factory Notification.fromJson(Map<String, dynamic> json) {
    return Notification(
      notificationID: json['notificationID'] as String,
      userID: json['userID'] as String,
      type: json['type'] as String,
      message: json['message'] as String,
      status: json['status'] as String,
      channel: json['channel'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'notificationID': notificationID,
      'userID': userID,
      'type': type,
      'message': message,
      'status': status,
      'channel': channel,
      'createdAt': createdAt?.toIso8601String() ,
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }
}