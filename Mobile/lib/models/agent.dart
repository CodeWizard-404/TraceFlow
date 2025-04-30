// models/agent.dart
class Agent {
  final String agentID;
  final String name;
  final String lastname;
  final String? email;
  final String? phone;
  final String location;

  Agent({
    required this.agentID,
    required this.name,
    required this.lastname,
    this.email,
    this.phone,
    required this.location,
  });

  // Convert JSON to Agent object
  factory Agent.fromJson(Map<String, dynamic> json) {
    return Agent(
      agentID: json['agentID'],
      name: json['name'],
      lastname: json['lastname'],
      email: json['email'],
      phone: json['phone'],
      location: json['location'],
    );
  }

  // Convert Agent object to JSON
  Map<String, dynamic> toJson() {
    return {
      'agentID': agentID,
      'name': name,
      'lastname': lastname,
      'email': email,
      'phone': phone,
      'location': location,
    };
  }
}
