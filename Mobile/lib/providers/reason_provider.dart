import 'package:flutter/foundation.dart';
import '../models/reason.dart';
import '../services/reason_service.dart';

class ReasonProvider with ChangeNotifier {
  Future<List<Reason>> getReasonsByVisit(String visitID) async {
    final response = await ReasonService.getReasonsByVisitId(visitID);
    return response.map((reason) => Reason.fromJson(reason as Map<String, dynamic>)).toList();
  }

  Future<List<Reason>> getAllReasons() async {
    final response = await ReasonService.getAllReasons();
    return response.map((reason) => Reason.fromJson(reason as Map<String, dynamic>)).toList();
  }
}
