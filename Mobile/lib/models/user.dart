class User {
  final String? userID;
  final String? firstname;
  final String? lastname;
  final String? phone;
  final String? email;

  User({
    this.userID,
    this.firstname,
    this.lastname,
    this.phone,
    this.email,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      userID: json['userID'],
      firstname: json['firstname'],
      lastname: json['lastname'],
      phone: json['phone'],
      email: json['email'],
    );
  }
}