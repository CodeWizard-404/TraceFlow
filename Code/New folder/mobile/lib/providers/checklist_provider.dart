import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import '../models/checklist.dart';
import '../services/checklist_service.dart';

class ChecklistProvider with ChangeNotifier {
  final ChecklistService _checklistService;
  List<Checklist> _checklists = [];
  List<Checklist> _allChecklists = [];
  bool _isLoading = false;
  String? _errorMessage;

  ChecklistProvider({ChecklistService? checklistService})
      : _checklistService = checklistService ?? ChecklistService();

  List<Checklist> get checklists => _checklists;
  List<Checklist> get allChecklists => _allChecklists;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> getChecklistsByVisitId(String visitId) async {
    if (kDebugMode) print('Fetching checklists for visit ID: $visitId');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _checklists = await _checklistService.getChecklistsByVisitId(visitId);
      if (kDebugMode) print('Fetched ${_checklists.length} checklists for visit: $visitId');
    } catch (e) {
      _checklists = [];
      _errorMessage = 'Failed to fetch checklists: $e';
      if (kDebugMode) print(_errorMessage);
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> getAllChecklists() async {
    if (_allChecklists.isNotEmpty) {
      if (kDebugMode) print('All checklists already loaded, skipping fetch');
      return;
    }
    if (kDebugMode) print('Fetching all checklists');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _allChecklists = await _checklistService.getAllChecklists();
      if (kDebugMode) print('Fetched ${_allChecklists.length} checklists');
    } catch (e) {
      _allChecklists = [];
      _errorMessage = 'Failed to fetch all checklists: $e';
      if (kDebugMode) print(_errorMessage);
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void setChecklists(List<Checklist> checklists) {
    if (kDebugMode) print('Setting checklists: ${checklists.length}');
    _checklists = checklists;
    notifyListeners();
  }

  void clearError() {
    if (kDebugMode) print('Clearing error message');
    _errorMessage = null;
    notifyListeners();
  }
}