import 'package:flutter/foundation.dart';

class Role {
  final String name;

  Role({required this.name});

  factory Role.fromJson(dynamic json) {
    if (json is String) {
      return Role(name: json);
    } else if (json is Map<String, dynamic>) {
      return Role(name: json['name'] ?? '');
    }
    return Role(name: '');
  }

  Map<String, dynamic> toJson() => {'name': name};
}

class User {
  final String? userID;
  final String? firstName;
  final String? lastName;
  final String? phone;
  final String? email;
  final String? wallet;
  final String? pfp;
  final List<Role> roles;
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
    this.token,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    var rolesList = json['roles'] as List<dynamic>? ?? [];
    List<Role> roles = rolesList.map((roleJson) => Role.fromJson(roleJson)).toList();

    // Handle PFP field
    dynamic pfpData = json['PFP'] ?? json['pfp'];
    String? pfp;
    if (pfpData is String) {
      pfp = pfpData;
    } else if (pfpData is Map<String, dynamic>) {
      pfp = null;
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
      roles: roles,
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
    'token': token,
  };
}