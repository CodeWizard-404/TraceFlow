import 'package:flutter/foundation.dart';
import '../models/reason.dart';
import '../services/reason_service.dart';

class ReasonProvider with ChangeNotifier {
  Future<List<Reason>> getReasonsByVisit(String visitID) async {
    final response = await ReasonService.getReasonsByVisitId(visitID);
    return response; // Already a List<Reason>
  }

  Future<List<Reason>> getAllReasons() async {
    final response = await ReasonService.getAllReasons();
    return response; // Already a List<Reason>
  }
}