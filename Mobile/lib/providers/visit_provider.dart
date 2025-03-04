import 'package:flutter/foundation.dart';
import '../models/visit.dart';
import '../services/visits_service.dart';

class VisitProvider with ChangeNotifier {
  final List<Visit> _visits = [];
  late DateTime _startTime;

  List<Visit> get visits => _visits;

  // Fetch a visit by its ID from the backend
  Future<Visit> fetchVisitByID(String visitID) async {
    try {
      final visitData = await VisitService.fetchVisitByID(visitID);
      return Visit.fromJson(visitData);
    } catch (error) {
      throw Exception('Failed to fetch visit: $error');
    }
  }

  // Log visit details
  Future<void> logVisit(String visitId, Map<String, dynamic> logData) async {
    try {
      await VisitService.logVisit(visitId, logData);
      notifyListeners();
    } catch (error) {
      throw Exception('Failed to log visit: $error');
    }
  }

  // Start and stop visit timer
  void startVisitTimer() {
    _startTime = DateTime.now();
  }

  int stopVisitTimer() {
    final endTime = DateTime.now();
    final duration = endTime.difference(_startTime).inMinutes;
    _startTime = DateTime.now();
    return duration;
  }
}