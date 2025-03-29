// lib/providers/checklist_provider.dart
import 'package:flutter/foundation.dart';
import '../models/checklist.dart';
import '../services/checklist_service.dart';

class ChecklistProvider with ChangeNotifier {
  List<Checklist> _checklists = [];
  bool _isLoading = false;

  List<Checklist> get checklists => _checklists;
  bool get isLoading => _isLoading;

  Future<void> getChecklistsByVisitId(String visitId, String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _checklists = await ChecklistService.getChecklistsByVisitId(visitId, token);
    } catch (e) {
      _checklists = [];
      throw Exception('Failed to fetch checklists: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> getAllChecklists(String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _checklists = await ChecklistService.getAllChecklists(token);
    } catch (e) {
      _checklists = [];
      throw Exception('Failed to fetch all checklists: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}