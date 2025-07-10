class NotificationRule {
  final String ruleID;
  final String event;
  final String type;
  final Map<String, dynamic> recipients;
  final Map<String, dynamic> channels;
  final Map<String, dynamic>? conditions;
  final String messageTemplate;
  final bool enabled;
  final String priority;
  final DateTime createdAt;
  final DateTime updatedAt;

  NotificationRule({
    required this.ruleID,
    required this.event,
    required this.type,
    required this.recipients,
    required this.channels,
    this.conditions,
    required this.messageTemplate,
    required this.enabled,
    required this.priority,
    required this.createdAt,
    required this.updatedAt,
  });

  factory NotificationRule.fromJson(Map<String, dynamic> json) {
    return NotificationRule(
      ruleID: json['ruleID'] as String,
      event: json['event'] as String,
      type: json['type'] as String,
      recipients: json['recipients'] as Map<String, dynamic>,
      channels: json['channels'] as Map<String, dynamic>,
      conditions: json['conditions'] as Map<String, dynamic>?,
      messageTemplate: json['messageTemplate'] as String,
      enabled: json['enabled'] as bool,
      priority: json['priority'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'ruleID': ruleID,
      'event': event,
      'type': type,
      'recipients': recipients,
      'channels': channels,
      'conditions': conditions,
      'messageTemplate': messageTemplate,
      'enabled': enabled,
      'priority': priority,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}