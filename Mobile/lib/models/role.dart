class Role {
  final String? roleID;
  final String name;          // Required
  final String? description;

  Role({
    this.roleID,
    required this.name,
    this.description,
  });

  factory Role.fromJson(Map<String, dynamic> json) {
    return Role(
      roleID: json['roleID'] as String?,
      name: json['name'] as String,
      description: json['description'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'roleID': roleID,
      'name': name,
      'description': description,
    };
  }
}