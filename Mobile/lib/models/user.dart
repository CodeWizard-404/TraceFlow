// lib/models/user.dart
import 'package:TraceFlow/models/role.dart';
import 'package:TraceFlow/models/permission.dart';

/// Represents a user with authentication and role/permission data.
class User {
  final String? userID;
  final String? firstName;
  final String? lastName;
  final String? phone;
  final String? email;
  final String? wallet;
  final String? pfp;
  final List<Role> roles;
  final List<Permission> permissions;
  final String? token;

  User({
    this.userID,
    this.firstName,
    this.lastName,
    this.phone,
    this.email,
    this.wallet,
    this.pfp,
    this.roles = const [],
    this.permissions = const [],
    this.token,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    final rolesList = (json['roles'] as List<dynamic>? ?? []).map((role) => Role.fromJson(role)).toList();
    final permissionsList = (json['permissions'] as List<dynamic>? ?? []).map((perm) => Permission.fromJson(perm)).toList();

    // Handle PFP field flexibly (fixes type mismatch issue from April 13, 2025)
    String? pfp;
    final pfpData = json['pfp'] ?? json['PFP'];
    if (pfpData is String) {
      pfp = pfpData;
    } else {
      pfp = null;
    }

    return User(
      userID: json['userID']?.toString(),
      firstName: json['firstname'] ?? json['given_name'] ?? '',
      lastName: json['lastname'] ?? json['family_name'] ?? '',
      phone: json['phone']?.toString(),
      email: json['email']?.toString(),
      wallet: json['wallet']?.toString(),
      pfp: pfp,
      roles: rolesList,
      permissions: permissionsList,
      token: json['token']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'userID': userID,
    'firstname': firstName,
    'lastname': lastName,
    'phone': phone,
    'email': email,
    'wallet': wallet,
    'pfp': pfp,
    'roles': roles.map((role) => role.toJson()).toList(),
    'permissions': permissions.map((perm) => perm.toJson()).toList(),
    'token': token,
  };
}