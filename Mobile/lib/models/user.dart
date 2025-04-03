import 'package:TraceFlow/models/role.dart';

class User {
  final String? userID;
  final String? firstname;
  final String? lastname;
  final String? phone;
  final String? email;
  final List<Role> roles; // Add roles list

  User({
    this.userID,
    this.firstname,
    this.lastname,
    this.phone,
    this.email,
    this.roles = const [], // Default to empty list if no roles
  });

  factory User.fromJson(Map<String, dynamic> json) {
    var rolesList = json['roles'] as List<dynamic>? ?? [];
    List<Role> roles = rolesList.map((roleJson) => Role.fromJson(roleJson)).toList();

    return User(
      userID: json['userID'],
      firstname: json['firstname'],
      lastname: json['lastname'],
      phone: json['phone'],
      email: json['email'],
      roles: roles,
    );
  }
}