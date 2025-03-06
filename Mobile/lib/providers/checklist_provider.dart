

import 'package:flutter/cupertino.dart';

import '../models/checklist.dart';
import '../services/checklist_service.dart';

class ChecklistProvider extends ChangeNotifier {
  Future<List<Checklist>> getChecklistByVisit(String visitID) async {
    final response = await ChecklistService.getChecklistsByVisitId(visitID);
    return response.map((item) => Checklist.fromJson(item as Map<String, dynamic>)).toList();
  }
}