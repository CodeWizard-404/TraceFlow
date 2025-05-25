class Role {
  final String? roleID;
  final String name;
  final String? description;

  Role({
    this.roleID,
    required this.name,
    this.description,
  });

  factory Role.fromJson(dynamic json) {
    if (json is String) {
      return Role(name: json);
    } else if (json is Map<String, dynamic>) {
      return Role(
        roleID: json['roleID']?.toString(),
        name: json['name']?.toString() ?? '',
        description: json['description']?.toString(),
      );
    }
    return Role(name: '');
  }

  Map<String, dynamic> toJson() => {
    'roleID': roleID,
    'name': name,
    'description': description,
  };
}