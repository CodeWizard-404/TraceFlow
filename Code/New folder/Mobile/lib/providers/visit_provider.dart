import 'package:flutter/foundation.dart';
import '../models/visit.dart';
import '../services/auth_service.dart';
import '../services/cookie_manager.dart';
import '../services/visits_service.dart';

class VisitProvider with ChangeNotifier {
  Visit? _currentVisit;
  bool _isLoading = false;
  DateTime? _startTime;
  String? _errorMessage;

  Visit? get currentVisit => _currentVisit;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> logVisit({
    required String visitId,
    required int duration,
    required List<Map<String, dynamic>> checklistUpdates,
    String? comment,
    String? date,
    String? time,
    String? status,
    List<String>? photoPaths,
  }) async {
    if (kDebugMode) print('VisitProvider.logVisit called for visitId: $visitId');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      if (!CookieManager.cookies.containsKey('accessToken')) {
        if (kDebugMode) print('No accessToken, attempting to load cookies');
        await CookieManager.loadCookies();
      }
      if (photoPaths == null || photoPaths.isEmpty) {
        throw Exception('At least one photo is required to log a visit');
      }
      _currentVisit = await VisitService.logVisit(
        visitId: visitId,
        duration: duration,
        checklistUpdates: checklistUpdates,
        comment: comment,
        date: date,
        time: time,
        status: status,
        photoPaths: photoPaths,
      );
      if (kDebugMode) print('Logged visit: $visitId');
    } catch (e) {
      _errorMessage = 'Failed to log visit: $e';
      if (kDebugMode) print(_errorMessage);
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchVisitById(String visitId) async {
    if (kDebugMode) print('VisitProvider.fetchVisitById called for visitId: $visitId');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      if (!CookieManager.cookies.containsKey('accessToken')) {
        if (kDebugMode) print('No accessToken, attempting to load cookies');
        await CookieManager.loadCookies();
      }
      _currentVisit = await VisitService.fetchVisitById(visitId);
      if (kDebugMode) print('Fetched visit: $visitId');
    } catch (e) {
      _currentVisit = null;
      _errorMessage = 'Failed to fetch visit: $e';
      if (kDebugMode) print(_errorMessage);
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
      rethrow;
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
    String? supervisorID,
    List<Map<String, dynamic>>? checklists,
    List<Map<String, dynamic>>? reasons,
    List<String>? photoPaths,
    List<String>? photosToRemove,
  }) async {
    if (kDebugMode) print('VisitProvider.updateVisit called for visitId: $visitId');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      if (!CookieManager.cookies.containsKey('accessToken')) {
        if (kDebugMode) print('No accessToken, attempting to load cookies');
        await CookieManager.loadCookies();
      }
      _currentVisit = await VisitService.updateVisit(
        visitId: visitId,
        date: date,
        time: time,
        duration: duration,
        location: location,
        status: status,
        comment: comment,
        agentID: agentID,
        supervisorID: supervisorID,
        checklists: checklists,
        reasons: reasons,
        photoPaths: photoPaths,
        photosToRemove: photosToRemove,
      );
      if (kDebugMode) print('Updated visit: $visitId');
    } catch (e) {
      _errorMessage = 'Failed to update visit: $e';
      if (kDebugMode) print(_errorMessage);
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> deleteVisit(String visitId) async {
    if (kDebugMode) print('VisitProvider.deleteVisit called for visitId: $visitId');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      if (!CookieManager.cookies.containsKey('accessToken')) {
        if (kDebugMode) print('No accessToken, attempting to load cookies');
        await CookieManager.loadCookies();
      }
      await VisitService.deleteVisit(visitId);
      _currentVisit = null;
      if (kDebugMode) print('Deleted visit: $visitId');
    } catch (e) {
      _errorMessage = 'Failed to delete visit: $e';
      if (kDebugMode) print(_errorMessage);
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> verifyQRCode({
    required String qrData,
    required String visitId,
  }) async {
    if (kDebugMode) print('VisitProvider.verifyQRCode called for visitId: $visitId');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      if (!CookieManager.cookies.containsKey('accessToken')) {
        if (kDebugMode) print('No accessToken, attempting to load cookies');
        await CookieManager.loadCookies();
      }
      final result = await VisitService.verifyQRCode(
        qrData: qrData,
        visitId: visitId,
      );
      if (kDebugMode) print('Verified QR code for visit: $visitId');
      return result;
    } catch (e) {
      _errorMessage = 'Failed to verify QR code: $e';
      if (kDebugMode) print(_errorMessage);
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> validateOTP({
    required String visitId,
    required String otpCode,
  }) async {
    if (kDebugMode) print('VisitProvider.validateOTP called for visitId: $visitId');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      if (!CookieManager.cookies.containsKey('accessToken')) {
        if (kDebugMode) print('No accessToken, attempting to load cookies');
        await CookieManager.loadCookies();
      }
      final result = await VisitService.validateOTP(
        visitId: visitId,
        otpCode: otpCode,
      );
      if (kDebugMode) print('Validated OTP for visit: $visitId');
      return result;
    } catch (e) {
      _errorMessage = 'Failed to validate OTP: $e';
      if (kDebugMode) print(_errorMessage);
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> syncVisitToCalendar(String visitId) async {
    if (kDebugMode) print('VisitProvider.syncVisitToCalendar called for visitId: $visitId');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      if (!CookieManager.cookies.containsKey('accessToken')) {
        if (kDebugMode) print('No accessToken, attempting to load cookies');
        await CookieManager.loadCookies();
      }
      final result = await VisitService.syncVisitToCalendar(visitId);
      if (kDebugMode) print('Synced visit to calendar: $visitId');
      return result;
    } catch (e) {
      _errorMessage = 'Failed to sync visit to calendar: $e';
      if (kDebugMode) print(_errorMessage);
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<List<Map<String, dynamic>>> listCalendarEvents(String timesheetId) async {
    if (kDebugMode) print('VisitProvider.listCalendarEvents called for timesheetId: $timesheetId');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      if (!CookieManager.cookies.containsKey('accessToken')) {
        if (kDebugMode) print('No accessToken, attempting to load cookies');
        await CookieManager.loadCookies();
      }
      final result = await VisitService.listCalendarEvents(timesheetId);
      if (kDebugMode) print('Listed calendar events for timesheet: $timesheetId');
      return result;
    } catch (e) {
      _errorMessage = 'Failed to list calendar events: $e';
      if (kDebugMode) print(_errorMessage);
      if (e.toString().contains('Invalid or expired token') || e.toString().contains('401')) {
        await AuthService.logout();
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void startVisitTimer() {
    if (kDebugMode) print('VisitProvider.startVisitTimer called');
    _startTime = DateTime.now();
    notifyListeners();
  }

  int? getElapsedTimeInMinutes() {
    final elapsed = _startTime != null ? DateTime.now().difference(_startTime!).inMinutes : null;
    if (kDebugMode && elapsed != null) print('Elapsed time: $elapsed minutes');
    return elapsed;
  }

  void clearError() {
    if (kDebugMode) print('VisitProvider.clearError called');
    _errorMessage = null;
    notifyListeners();
  }
}