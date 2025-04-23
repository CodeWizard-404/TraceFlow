// lib/models/permission.dart
/// Represents a permission with an ID, name, class, and optional description.
/// Used for role-based access control.
class Permission {
  final String? permissionID;
  final String name;
  final String className;
  final String? description;

  Permission({
    this.permissionID,
    required this.name,
    required this.className,
    this.description,
  });

  factory Permission.fromJson(Map<String, dynamic> json) {
    return Permission(
      permissionID: json['permissionID'] as String?,
      name: json['name'] as String? ?? '',
      className: json['class'] as String? ?? '',
      description: json['description'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'permissionID': permissionID,
    'name': name,
    'class': className,
    'description': description,
  };
}