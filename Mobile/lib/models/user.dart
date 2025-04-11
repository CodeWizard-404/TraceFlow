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
      firstName: json['fisrtName'], // Note: Keeping typo to match backend response
      lastName: json['lastName'],
      phone: json['phone'],
      email: json['email'],
      wallet: json['wallet'],
      pfp: json['pfp'], // Lowercase to match existing code
      roles: roles,
    );
  }

  Map<String, dynamic> toJson() => {
    'userID': userID,
    'fisrtName': firstName, // Match backend typo
    'lastName': lastName,
    'phone': phone,
    'email': email,
    'wallet': wallet,
    'pfp': pfp,
    'roles': roles.map((role) => role.toJson()).toList(),
  };
}