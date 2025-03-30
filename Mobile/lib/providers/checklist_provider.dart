import 'package:flutter/foundation.dart';
import '../models/checklist.dart';
import '../services/checklist_service.dart';

class ChecklistProvider with ChangeNotifier {
  List<Checklist> _checklists = [];
  List<Checklist> _allChecklists = [];
  bool _isLoading = false;

  List<Checklist> get checklists => _checklists;
  List<Checklist> get allChecklists => _allChecklists;
  bool get isLoading => _isLoading;

  Future<void> getChecklistsByVisitId(String visitId, String token) async {
    _isLoading = true;
    try {
      _checklists = await ChecklistService.getChecklistsByVisitId(
        visitId,
        token,
      );
    } catch (e) {
      _checklists = [];
      throw Exception('Failed to fetch checklists: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> getAllChecklists(String token) async {
    if (_allChecklists.isNotEmpty) return; // Avoid refetching if data exists
    _isLoading = true;
    try {
      _allChecklists = await ChecklistService.getAllChecklists(token);
    } catch (e) {
      _allChecklists = [];
      throw Exception('Failed to fetch all checklists: $e');
    } finally {
      _isLoading = false;
      notifyListeners(); // Only notify after the operation completes
    }
  }
}
