class Governorate {
  final String governorateID;
  final String name;
  final String? nameAr;
  final String? nameFr;
  final String regionID;

  Governorate({
    required this.governorateID,
    required this.name,
    this.nameAr,
    this.nameFr,
    required this.regionID,
  });

  factory Governorate.fromJson(Map<String, dynamic> json) {
    return Governorate(
      governorateID: json['governorateID'] as String,
      name: json['name'] as String,
      nameAr: json['nameAr'] as String?,
      nameFr: json['nameFr'] as String?,
      regionID: json['regionID'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'governorateID': governorateID,
      'name': name,
      'nameAr': nameAr,
      'nameFr': nameFr,
      'regionID': regionID,
    };
  }
}