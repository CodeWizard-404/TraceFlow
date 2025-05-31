class Role {
  final String? roleID;
  final String name;
  final String description; // Non-nullable, with default

  Role({
    this.roleID,
    required this.name,
    this.description = '', // Default to empty string
  });

  factory Role.fromJson(dynamic json) {
    if (json is String) {
      return Role(name: json);
    } else if (json is Map<String, dynamic>) {
      return Role(
        roleID: json['roleID']?.toString(),
        name: json['name']?.toString() ?? '', // Default to empty string
        description: json['description']?.toString() ?? '', // Handle null explicitly
      );
    }
    return Role(name: ''); // Fallback
  }

  Map<String, dynamic> toJson() {
    return {
      'roleID': roleID,
      'name': name,
      'description': description,
    };
  }
}