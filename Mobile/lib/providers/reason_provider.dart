import 'package:flutter/cupertino.dart';

import '../models/reason.dart';
import '../services/reason_service.dart';

class ReasonProvider extends ChangeNotifier {
  Future<List<Reason>> getReasonsByVisit(String visitID) async {
    final response = await ReasonService.getReasonsByVisitId(visitID);
    return response.map((reason) => Reason.fromJson(reason as Map<String, dynamic>)).toList();
  }
}