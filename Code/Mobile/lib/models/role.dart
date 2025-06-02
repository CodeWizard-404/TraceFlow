import 'permission.dart';

class Role {
  final String? roleID;
  final String? name;
  final String? description;
  final List<Permission>? permissions;

  Role({
    this.roleID,
    this.name,
    this.description,
    this.permissions,
  });

  factory Role.fromJson(Map<String, dynamic> json) {
    print('Parsing Role from JSON: $json');
    try {
      List<Permission>? permissionsList = (json['permissions'] as List<dynamic>? ?? [])
          .where((p) => p != null)
          .map((p) => Permission.fromJson(p as Map<String, dynamic>))
          .toList();
      return Role(
        roleID: json['roleID']?.toString(),
        name: json['name']?.toString() ?? '',
        description: json['description']?.toString(),
        permissions: permissionsList,
      );
    } catch (e) {
      print('Error in Role.fromJson: $e');
      rethrow;
    }
  }

  Map<String, dynamic> toJson() => {
    'roleID': roleID,
    'name': name,
    'description': description,
    'permissions': permissions?.map((p) => p.toJson()).toList(),
  };
}