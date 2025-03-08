import 'package:flutter/foundation.dart';
import '../models/checklist.dart';
import '../services/checklist_service.dart';

class ChecklistProvider with ChangeNotifier {
  Future<List<Checklist>> getChecklistByVisit(String visitID) async {
    final response = await ChecklistService.getChecklistsByVisitId(visitID);
    return response; // Already a List<Checklist>
  }

  Future<List<Checklist>> getAllChecklists() async {
    final response = await ChecklistService.getAllChecklists();
    return response; // Already a List<Checklist>
  }
}