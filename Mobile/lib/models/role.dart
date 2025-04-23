// lib/models/role.dart
/// Represents a user role with an ID, name, and optional description.
/// Matches backend schema for roles managed by Keycloak.
class Role {
  final String? roleID;
  final String name;
  final String? description;

  Role({
    this.roleID,
    required this.name,
    this.description,
  });

  factory Role.fromJson(Map<String, dynamic> json) {
    return Role(
      roleID: json['roleID'] as String?,
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'roleID': roleID,
    'name': name,
    'description': description,
  };
}