import 'role.dart';

// Represents a user in the TraceFlow system.
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

  // Creates a User from JSON data.
  factory User.fromJson(Map<String, dynamic> json) {
    final rolesList = json['roles'] as List<dynamic>? ?? [];
    final roles = rolesList.map((roleJson) => Role.fromJson(roleJson)).toList();

    // Handle PFP field safely
    String? pfp;
    final pfpData = json['PFP'] ?? json['pfp'];
    if (pfpData is String && pfpData.isNotEmpty) {
      pfp = pfpData;
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

  // Converts the User to JSON.
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