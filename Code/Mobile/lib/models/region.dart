class Region {
  final String regionID;
  final String name;
  final String? nameAr;
  final String? nameFr;

  Region({
    required this.regionID,
    required this.name,
    this.nameAr,
    this.nameFr,
  });

  factory Region.fromJson(Map<String, dynamic> json) {
    return Region(
      regionID: json['regionID'] as String,
      name: json['name'] as String,
      nameAr: json['nameAr'] as String?,
      nameFr: json['nameFr'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'regionID': regionID,
      'name': name,
      'nameAr': nameAr,
      'nameFr': nameFr,
    };
  }
}