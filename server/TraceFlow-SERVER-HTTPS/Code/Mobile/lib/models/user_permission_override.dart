class UserPermissionOverride {
  final String? overrideID;
  final String userID;
  final String permissionID;
  final String roleID;
  final String action;

  UserPermissionOverride({
    this.overrideID,
    required this.userID,
    required this.permissionID,
    required this.roleID,
    required this.action,
  });

  factory UserPermissionOverride.fromJson(Map<String, dynamic> json) {
    return UserPermissionOverride(
      overrideID: json['overrideID'] as String?,
      userID: json['userID'] as String,
      permissionID: json['permissionID'] as String,
      roleID: json['roleID'] as String,
      action: json['action'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'overrideID': overrideID,
      'userID': userID,
      'permissionID': permissionID,
      'roleID': roleID,
      'action': action,
    };
  }
}