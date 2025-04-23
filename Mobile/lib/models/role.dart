import 'package:flutter/foundation.dart';

// Represents a user role in the TraceFlow system.
class Role {
  final String? roleID;
  final String name;
  final String? description;

  Role({
    this.roleID,
    required this.name,
    this.description,
  });

  // Creates a Role from JSON data.
  factory Role.fromJson(dynamic json) {
    if (json is String) {
      return Role(name: json);
    } else if (json is Map<String, dynamic>) {
      return Role(
        roleID: json['roleID'] as String?,
        name: json['name'] as String? ?? '',
        description: json['description'] as String?,
      );
    }
    return Role(name: '');
  }

  // Converts the Role to JSON.
  Map<String, dynamic> toJson() => {
    'roleID': roleID,
    'name': name,
    'description': description,
  };
}