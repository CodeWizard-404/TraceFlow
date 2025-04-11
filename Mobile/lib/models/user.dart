import 'package:TraceFlow/models/role.dart';

class User {
  final String? userID;
  final String? firstName;
  final String? lastName;
  final String? phone;
  final String? email;
  final String? wallet;
  final String? pfp;
  final List<Role> roles;

  User({
    this.userID,
    this.firstName,
    this.lastName,
    this.phone,
    this.email,
    this.wallet,
    this.pfp,
    this.roles = const [],
  });

  factory User.fromJson(Map<String, dynamic> json) {
    var rolesList = json['roles'] as List<dynamic>? ?? [];
    List<Role> roles = rolesList.map((roleJson) => Role.fromJson(roleJson)).toList();

    return User(
      userID: json['userID'],
      firstName: json['firstname'],
      lastName: json['lastname'],
      phone: json['phone'],
      email: json['email'],
      wallet: json['wallet'],
      pfp: json['PFP'],
      roles: roles,
    );
  }

  Map<String, dynamic> toJson() => {
    'userID': userID,
    'fisrtname': firstName,
    'lastname': lastName,
    'phone': phone,
    'email': email,
    'wallet': wallet,
    'pfp': pfp,
    'roles': roles.map((role) => role.toJson()).toList(),
  };
}