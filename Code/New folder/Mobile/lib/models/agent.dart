import 'package:TraceFlow/models/user.dart';

class Agent {
  final String agentID;
  final String name;
  final String lastname;
  final String? email;
  final String? phone;
  final String? location;
  final double? latitude;
  final double? longitude;
  final String? supervisorID;
  final String delegationID;
  final User? Supervisor;


  Agent({
    required this.agentID,
    required this.name,
    required this.lastname,
    this.email,
    this.phone,
    this.location,
    this.latitude,
    this.longitude,
    this.supervisorID,
    required this.delegationID,
    this.Supervisor,

  });

  factory Agent.fromJson(Map<String, dynamic> json) {
    return Agent(
      agentID: json['agentID'] as String? ?? '',
      name: json['name'] as String? ?? 'Unknown',
      lastname: json['lastname'] as String? ?? 'Unknown',
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      location: json['location'] as String?,
      latitude: json['latitude'] != null
          ? double.tryParse(json['latitude'].toString())
          : null,
      longitude: json['longitude'] != null
          ? double.tryParse(json['longitude'].toString())
          : null,
      supervisorID: json['supervisorID'] as String?,
      delegationID: json['delegationID'] as String? ?? '',
      Supervisor:
      json['Supervisor'] != null ? User.fromJson(json['Supervisor']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'agentID': agentID,
      'name': name,
      'lastname': lastname,
      'email': email,
      'phone': phone,
      'location': location,
      'latitude': latitude,
      'longitude': longitude,
      'supervisorID': supervisorID,
      'delegationID': delegationID,
      'Supervisor': Supervisor?.toJson(),
    };
  }
}