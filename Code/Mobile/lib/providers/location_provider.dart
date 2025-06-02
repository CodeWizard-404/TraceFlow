import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../services/cookie_manager.dart';
import '../services/location_service.dart';
import '../utils/constants.dart';

class LocationProvider with ChangeNotifier {
  IO.Socket? _socket;
  List<dynamic> _regions = [];
  List<dynamic> _governorates = [];
  List<dynamic> _delegations = [];
  Map<String, dynamic> _userLocations = {};
  bool _isLoading = false;
  String? _errorMessage;

  // Getters
  List<dynamic> get regions => _regions;
  List<dynamic> get governorates => _governorates;
  List<dynamic> get delegations => _delegations;
  Map<String, dynamic> get userLocations => _userLocations;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  /// Initializes the provider with WebSocket connection
  void initialize() {
    _connectToSocket();
  }

  /// Establishes WebSocket connection and sets up event listeners
  void _connectToSocket() {
    _socket = IO.io(baseUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'extraHeaders': {
        'Cookie': 'accessToken=${CookieManager.cookies['accessToken']}',
      },
    });

    _socket!.connect();

    _socket!.onConnect((_) {
      if (kDebugMode) print('Connected to WebSocket for locations');
    });

    _socket!.on('userLocationUpdate', (data) {
      if (kDebugMode) print('Received user location update: $data');
      final userId = data['userId'];
      _userLocations[userId] = {
        'latitude': data['latitude'],
        'longitude': data['longitude'],
        'address': data['address'],
        'timestamp': data['timestamp'],
      };
      notifyListeners();
    });

    _socket!.onDisconnect((_) {
      if (kDebugMode) print('Disconnected from WebSocket for locations');
    });

    _socket!.onConnectError((error) {
      if (kDebugMode) print('WebSocket connection error: $error');
      _errorMessage = 'WebSocket connection failed';
      notifyListeners();
    });
  }

  /// Fetches all regions
  Future<void> getAllRegions() async {
    _isLoading = true;
    notifyListeners();
    try {
      _regions = await LocationService.getAllRegions();
    } catch (e) {
      _errorMessage = 'Failed to fetch regions: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Fetches all governorates
  Future<void> getAllGovernorates() async {
    _isLoading = true;
    notifyListeners();
    try {
      _governorates = await LocationService.getAllGovernorates();
    } catch (e) {
      _errorMessage = 'Failed to fetch governorates: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Fetches all delegations
  Future<void> getAllDelegations() async {
    _isLoading = true;
    notifyListeners();
    try {
      _delegations = await LocationService.getAllDelegations();
    } catch (e) {
      _errorMessage = 'Failed to fetch delegations: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Fetches delegations by governorate
  Future<void> getDelegationsByGovernorate(String governorateID) async {
    _isLoading = true;
    notifyListeners();
    try {
      _delegations = await LocationService.getDelegationsByGovernorate(governorateID);
    } catch (e) {
      _errorMessage = 'Failed to fetch delegations by governorate: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Fetches governorates by region
  Future<void> getGovernoratesByRegion(String regionID) async {
    _isLoading = true;
    notifyListeners();
    try {
      _governorates = await LocationService.getGovernoratesByRegion(regionID);
    } catch (e) {
      _errorMessage = 'Failed to fetch governorates by region: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Updates user location
  Future<void> updateUserLocation(String userId, double lat, double lng) async {
    _isLoading = true;
    notifyListeners();
    try {
      final result = await LocationService.updateUserLocation(userId, lat, lng);
      _userLocations[userId] = {
        'latitude': result['latitude'],
        'longitude': result['longitude'],
        'address': result['address'],
        'timestamp': result['timestamp'],
      };
    } catch (e) {
      _errorMessage = 'Failed to update user location: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Fetches specific user location
  Future<void> getSpecificUserLocation(String userId) async {
    _isLoading = true;
    notifyListeners();
    try {
      final result = await LocationService.getSpecificUserLocation(userId);
      _userLocations[userId] = {
        'latitude': result['latitude'],
        'longitude': result['longitude'],
        'address': result['address'],
      };
    } catch (e) {
      _errorMessage = 'Failed to fetch user location: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Clears error message
  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _socket?.disconnect();
    super.dispose();
  }
}