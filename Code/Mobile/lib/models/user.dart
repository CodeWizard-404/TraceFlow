import 'role.dart';

class User {
  final String? userID;
  final String? keycloakId;
  final String? firstName;
  final String? lastName;
  final String? phone;
  final String? email;
  final bool? isOnline;
  final bool? hasGoogleAuth;
  final bool? hasCalendarAccess;
  final String? pfp;
  final List<Role> roles;

  User({
    this.userID,
    this.keycloakId,
    this.firstName,
    this.lastName,
    this.phone,
    this.email,
    this.isOnline,
    this.hasGoogleAuth,
    this.hasCalendarAccess,
    this.pfp,
    this.roles = const [],
  });

  factory User.fromJson(Map<String, dynamic> json) {
    List<Role> rolesList = [];

    // Handle different role formats
    if (json['roles'] != null && json['roles'] is List) {
      final rolesData = json['roles'] as List<dynamic>;
      if (rolesData.isNotEmpty && rolesData.first is String) {
        // Case: roles is a list of strings ["Supervisor", ...]
        rolesList = rolesData
            .asMap()
            .entries
            .map((e) => Role(
          roleID: (e.key + 1).toString(),
          name: e.value.toString(),
          description: null,
        ))
            .toList();
      } else {
        // Case: roles is a list of objects [{"roleID": "", "name": ""}, ...]
        rolesList = rolesData.map((r) => Role.fromJson(r)).toList();
      }
    } else if (json['realm_access'] != null &&
        json['realm_access']['roles'] is List) {
      // Case: roles are nested under realm_access (from JWT)
      final realmRoles = json['realm_access']['roles'] as List<dynamic>;
      rolesList = realmRoles
          .asMap()
          .entries
          .map((e) => Role(
        roleID: (e.key + 1).toString(),
        name: e.value.toString(),
        description: null,
      ))
          .toList();
    }

    return User(
      userID: json['userID']?.toString(),
      keycloakId: json['keycloakId']?.toString(),
      firstName: json['firstname']?.toString(),
      lastName: json['lastname']?.toString(),
      phone: json['phone']?.toString(),
      email: json['email']?.toString(),
      isOnline: json['isOnline'] as bool?,
      hasGoogleAuth: json['hasGoogleAuth'] as bool?,
      hasCalendarAccess: json['hasCalendarAccess'] as bool?,
      pfp: json['PFP']?.toString(),
      roles: rolesList,
    );
  }

  Map<String, dynamic> toJson() => {
    'userID': userID,
    'keycloakId': keycloakId,
    'firstname': firstName,
    'lastname': lastName,
    'phone': phone,
    'email': email,
    'isOnline': isOnline,
    'hasGoogleAuth': hasGoogleAuth,
    'hasCalendarAccess': hasCalendarAccess,
    'PFP': pfp,
    'roles': roles.map((r) => r.toJson()).toList(),
  };
}