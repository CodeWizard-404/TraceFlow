class Agent {
  final String? agentID;
  final String? name;
  final String? lastname;
  final String? email;
  final String? phone;
  final String? cin;
  final String? location;

  Agent({
    this.agentID,
    this.name,
    this.lastname,
    this.location,
    this.email,
    this.phone,
    this.cin,
  });

  factory Agent.fromJson(Map<String, dynamic> json) {
    return Agent(
      agentID: json['agentID'],
      name: json['name'],
      lastname: json['lastname'],
      location: json['location'],
      email: json['email'],
      phone: json['phone'],
      cin: json['cin'],

    );
  }
}