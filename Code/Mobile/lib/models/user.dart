import 'package:TraceFlow/models/role.dart';

class User {
  final String userID;
  final String? keycloakId;
  final String? firstName;
  final String? lastName;
  final String? phone;
  final String email;
  final bool? isOnline;
  final bool? hasGoogleAuth;
  final bool? hasCalendarAccess;
  final String? pfp;
  final List<Role> roles;
  final List<String>? regionIDs;
  final List<String>? governorateIDs;
  final List<String>? delegationIDs;
  final List<String>? supervisorIDs;
  final List<String>? regionalManagerIDs;
  final String? directorID;

  User({
    required this.userID,
    this.keycloakId,
    this.firstName,
    this.lastName,
    this.phone,
    required this.email,
    this.isOnline,
    this.hasGoogleAuth,
    this.hasCalendarAccess,
    this.pfp,
    this.roles = const [],
    this.regionIDs,
    this.governorateIDs,
    this.delegationIDs,
    this.supervisorIDs,
    this.regionalManagerIDs,
    this.directorID,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    print('Parsing User from JSON: $json');
    try {
      List<Role> rolesList = (json['roles'] as List<dynamic>? ?? [])
          .where((r) => r != null)
          .map((r) => Role.fromJson(r as Map<String, dynamic>))
          .toList();
      return User(
        userID: json['userID']?.toString() ?? 'unknown',
        email: json['email']?.toString() ?? 'unknown@example.com',
        phone: json['phone']?.toString(),
        firstName: json['firstname']?.toString(),
        lastName: json['lastname']?.toString(),
        roles: rolesList,
        keycloakId: json['keycloakId']?.toString(),
        isOnline: json['isOnline'] as bool? ?? false,
        hasGoogleAuth: json['hasGoogleAuth'] as bool? ?? false,
        hasCalendarAccess: json['hasCalendarAccess'] as bool? ?? false,
        pfp: json['PFP']?.toString(),
        regionIDs: (json['regionIDs'] as List<dynamic>? ?? [])
            .where((e) => e != null)
            .map((e) => e.toString())
            .toList(),
        governorateIDs: (json['governorateIDs'] as List<dynamic>? ?? [])
            .where((e) => e != null)
            .map((e) => e.toString())
            .toList(),
        delegationIDs: (json['delegationIDs'] as List<dynamic>? ?? [])
            .where((e) => e != null)
            .map((e) => e.toString())
            .toList(),
        supervisorIDs: (json['supervisorIDs'] as List<dynamic>? ?? [])
            .where((e) => e != null)
            .map((e) => e.toString())
            .toList(),
        regionalManagerIDs: (json['regionalManagerIDs'] as List<dynamic>? ?? [])
            .where((e) => e != null)
            .map((e) => e.toString())
            .toList(),
        directorID: json['directorID']?.toString(),
      );
    } catch (e) {
      print('Error in User.fromJson: $e');
      rethrow;
    }
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
    'regionIDs': regionIDs,
    'governorateIDs': governorateIDs,
    'delegationIDs': delegationIDs,
    'supervisorIDs': supervisorIDs,
    'regionalManagerIDs': regionalManagerIDs,
    'directorID': directorID,
  };
}