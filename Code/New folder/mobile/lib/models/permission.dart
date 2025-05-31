class Permission {
  final String permissionID;
  final String name;
  final String? className;
  final String? description;

  Permission({
    required this.permissionID,
    required this.name,
    this.className,
    this.description,
  });

  factory Permission.fromJson(Map<String, dynamic> json) {
    return Permission(
      permissionID: json['permissionID']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      className: json['class']?.toString(),
      description: json['description']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'permissionID': permissionID,
    'name': name,
    'class': className,
    'description': description,
  };
}