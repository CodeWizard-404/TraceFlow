class Delegation {
  final String delegationID;
  final String name;
  final String? nameAr;
  final String? nameFr;
  final String? governorateID;

  Delegation({
    required this.delegationID,
    required this.name,
    this.nameAr,
    this.nameFr,
    this.governorateID,
  });

  factory Delegation.fromJson(Map<String, dynamic> json) {
    return Delegation(
      delegationID: json['delegationID'] as String,
      name: json['name'] as String,
      nameAr: json['nameAr'] as String?,
      nameFr: json['nameFr'] as String?,
      governorateID: json['governorateID'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'delegationID': delegationID,
      'name': name,
      'nameAr': nameAr,
      'nameFr': nameFr,
      'governorateID': governorateID,
    };
  }
}