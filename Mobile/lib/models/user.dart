class User {
  final String? userID;
  final String? firstname;
  final String? lastname;
  final String? phone;
  final String? email;
  final String? password;

  User({
    this.userID,
    this.firstname,
    this.lastname,
    this.phone,
    this.email,
    this.password,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      userID: json['userID'] as String?,
      firstname: json['firstname'] as String?,
      lastname: json['lastname'] as String?,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      password: json['password'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'userID': userID,
      'firstname': firstname,
      'lastname': lastname,
      'phone': phone,
      'email': email,
      'password': password,
    };
  }
}