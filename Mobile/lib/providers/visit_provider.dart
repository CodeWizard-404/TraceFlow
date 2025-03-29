// lib/providers/visit_provider.dart
import 'package:flutter/foundation.dart';
import '../models/visit.dart';
import '../services/visits_service.dart';

class VisitProvider with ChangeNotifier {
  Visit? _currentVisit;
  bool _isLoading = false;
  DateTime? _startTime;

  Visit? get currentVisit => _currentVisit;
  bool get isLoading => _isLoading;

  Future<void> logVisit({
    required String visitId,
    required int duration,
    required List<Map<String, dynamic>> checklistUpdates,
    String? comment,
    List<String>? photoPaths,
    required String token,
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      _currentVisit = await VisitService.logVisit(
        visitId: visitId,
        duration: duration,
        checklistUpdates: checklistUpdates,
        comment: comment,
        photoPaths: photoPaths,
        token: token,
      );
    } catch (e) {
      throw Exception('Failed to log visit: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchVisitById(String visitId, String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _currentVisit = await VisitService.fetchVisitById(visitId, token);
    } catch (e) {
      _currentVisit = null;
      throw Exception('Failed to fetch visit: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> updateVisit({
    required String visitId,
    String? date,
    String? time,
    int? duration,
    String? location,
    String? status,
    String? comment,
    String? agentID,
    List<Map<String, dynamic>>? checklists,
    List<Map<String, dynamic>>? reasons,
    List<String>? photoPaths,
    required String token,
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      _currentVisit = await VisitService.updateVisit(
        visitId: visitId,
        date: date,
        time: time,
        duration: duration,
        location: location,
        status: status,
        comment: comment,
        agentID: agentID,
        checklists: checklists,
        reasons: reasons,
        photoPaths: photoPaths,
        token: token,
      );
    } catch (e) {
      throw Exception('Failed to update visit: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> deleteVisit(String visitId, String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      await VisitService.deleteVisit(visitId, token);
      _currentVisit = null;
    } catch (e) {
      throw Exception('Failed to delete visit: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> verifyQRCode({
    required String qrData,
    required String visitId,
    required String token,
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      final result = await VisitService.verifyQRCode(
        qrData: qrData,
        visitId: visitId,
        token: token,
      );
      return result;
    } catch (e) {
      throw Exception('Failed to verify QR code: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void startVisitTimer() {
    _startTime = DateTime.now();
    notifyListeners();
  }

  int? getElapsedTimeInMinutes() {
    return _startTime != null ? DateTime.now().difference(_startTime!).inMinutes : null;
  }
}