import 'dart:convert';
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
    print('Parsing user JSON: $json'); // Debug

    List<Role> rolesList = [];
    if (json['roles'] is List) {
      rolesList = (json['roles'] as List<dynamic>)
          .map((r) {
        try {
          return Role.fromJson(r);
        } catch (e) {
          print('Error parsing role $r: $e'); // Debug
          return Role(name: ''); // Fallback role
        }
      })
          .toList();
    }

    return User(
      userID: json['userID']?.toString(),
      keycloakId: json['keycloakId']?.toString() ?? '',
      firstName: json['firstname']?.toString() ?? '',
      lastName: json['lastname']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      isOnline: json['isOnline'] as bool? ?? false,
      hasGoogleAuth: json['hasGoogleAuth'] as bool? ?? false,
      hasCalendarAccess: json['hasCalendarAccess'] as bool? ?? false,
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