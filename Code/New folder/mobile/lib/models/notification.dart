// Represents a notification in the TraceFlow system.
class Notification {
  final String notificationID;
  final String type;
  final String message;
  final String? title;
  final DateTime createdAt;
  final bool isRead;
  final Map<String, dynamic>? metadata;

  Notification({
    required this.notificationID,
    required this.type,
    required this.message,
    this.title,
    required this.createdAt,
    this.isRead = false,
    this.metadata,
  });

  // Creates a Notification from JSON data.
  factory Notification.fromJson(Map<String, dynamic> json) {
    return Notification(
      notificationID: json['notificationID'] as String,
      type: json['type'] as String,
      message: json['message'] as String,
      title: json['title'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      isRead: json['isRead'] as bool? ?? false,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  // Converts the Notification to JSON.
  Map<String, dynamic> toJson() => {
    'notificationID': notificationID,
    'type': type,
    'message': message,
    'title': title,
    'createdAt': createdAt.toIso8601String(),
    'isRead': isRead,
    'metadata': metadata,
  };

  // Creates a copy with updated fields.
  Notification copyWith({bool? isRead}) {
    return Notification(
      notificationID: notificationID,
      type: type,
      message: message,
      title: title,
      createdAt: createdAt,
      isRead: isRead ?? this.isRead,
      metadata: metadata,
    );
  }
}