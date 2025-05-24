// Represents a permission in the TraceFlow system.
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

  // Creates a Permission from JSON data.
  factory Permission.fromJson(Map<String, dynamic> json) {
    return Permission(
      permissionID: json['permissionID'] as String?,
      name: json['name'] as String,
      className: json['class'] as String,
      description: json['description'] as String?,
    );
  }

  // Converts the Permission to JSON.
  Map<String, dynamic> toJson() => {
    'permissionID': permissionID,
    'name': name,
    'class': className,
    'description': description,
  };
}