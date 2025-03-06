// models/agent.dart
class Agent {
  final String? agentID;
  final String? name;
  final String? lastname;
  final String? cin;
  final String? email;
  final String? phone;
  final String? wallet;
  final String? location;

  Agent({
    this.agentID,
    this.name,
    this.lastname,
    this.cin,
    this.email,
    this.phone,
    this.wallet,
    this.location,
  });

  // Convert JSON to Agent object
  factory Agent.fromJson(Map<String, dynamic> json) {
    return Agent(
      agentID: json['agentID'],
      name: json['name'],
      lastname: json['lastname'],
      cin: json['cin'],
      email: json['email'],
      phone: json['phone'],
      wallet: json['wallet'],
      location: json['location'],
    );
  }

  // Convert Agent object to JSON
  Map<String, dynamic> toJson() {
    return {
      'agentID': agentID,
      'name': name,
      'lastname': lastname,
      'cin': cin,
      'email': email,
      'phone': phone,
      'wallet': wallet,
      'location': location,
    };
  }
}