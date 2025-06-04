import 'dart:convert';
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
  List<dynamic> _places = [];
  Map<String, dynamic> _directions = {};
  Map<String, dynamic> _distanceMatrix = {};
  Map<String, dynamic> _placeDetails = {};
  List<dynamic> _nearbyPlaces = [];
  Map<String, dynamic> _currentUserLocation = {};
  Map<String, dynamic> _locationDetails = {};
  bool _isLoading = false;
  String? _errorMessage;

  // Getters
  List<dynamic> get regions => _regions;
  List<dynamic> get governorates => _governorates;
  List<dynamic> get delegations => _delegations;
  Map<String, dynamic> get userLocations => _userLocations;
  List<dynamic> get places => _places;
  Map<String, dynamic> get directions => _directions;
  Map<String, dynamic> get distanceMatrix => _distanceMatrix;
  Map<String, dynamic> get placeDetails => _placeDetails;
  List<dynamic> get nearbyPlaces => _nearbyPlaces;
  Map<String, dynamic> get currentUserLocation => _currentUserLocation;
  Map<String, dynamic> get locationDetails => _locationDetails;
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

  /// Fetches regions by governorate
  Future<void> getRegionsByGovernorate(String governorateID) async {
    _isLoading = true;
    notifyListeners();
    try {
      _regions = await LocationService.getRegionsByGovernorate(governorateID);
    } catch (e) {
      _errorMessage = 'Failed to fetch regions by governorate: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Fetches governorates by delegation
  Future<void> getGovernoratesByDelegation(String delegationID) async {
    _isLoading = true;
    notifyListeners();
    try {
      _governorates = await LocationService.getGovernoratesByDelegation(delegationID);
    } catch (e) {
      _errorMessage = 'Failed to fetch governorates by delegation: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Fetches regions by user
  Future<void> getRegionsByUser(String userID) async {
    _isLoading = true;
    notifyListeners();
    try {
      _regions = await LocationService.getRegionsByUser(userID);
    } catch (e) {
      _errorMessage = 'Failed to fetch regions by user: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Fetches governorates by user
  Future<void> getGovernoratesByUser(String userID) async {
    _isLoading = true;
    notifyListeners();
    try {
      _governorates = await LocationService.getGovernoratesByUser(userID);
    } catch (e) {
      _errorMessage = 'Failed to fetch governorates by user: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Fetches delegations by user
  Future<void> getDelegationsByUser(String userID) async {
    _isLoading = true;
    notifyListeners();
    try {
      _delegations = await LocationService.getDelegationsByUser(userID);
    } catch (e) {
      _errorMessage = 'Failed to fetch delegations by user: $e';
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

  /// Geocodes an address
  Future<void> geocodeAddress(String address) async {
    _isLoading = true;
    notifyListeners();
    try {
      final result = await LocationService.geocodeAddress(address);
      _userLocations['geocoded'] = {
        'latitude': result['latitude'],
        'longitude': result['longitude'],
        'formattedAddress': result['formattedAddress'],
      };
    } catch (e) {
      _errorMessage = 'Failed to geocode address: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Fetches directions
  Future<void> getDirections({
    required String origin,
    required String destination,
    String? mode,
    List<String>? waypoints,
    bool? optimizeWaypoints,
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      final result = await LocationService.getDirections(
        origin: origin,
        destination: destination,
        mode: mode,
        waypoints: waypoints,
        optimizeWaypoints: optimizeWaypoints,
      );
      _directions = result;
    } catch (e) {
      _errorMessage = 'Failed to fetch directions: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Searches for places
  Future<void> searchPlaces(String query, {Map<String, dynamic>? location, int? radius}) async {
    _isLoading = true;
    notifyListeners();
    try {
      _places = await LocationService.searchPlaces(query, location: location, radius: radius);
    } catch (e) {
      _errorMessage = 'Failed to search places: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Fetches distance matrix
  Future<void> getDistanceMatrix(List<String> origins, List<String> destinations, {String? mode}) async {
    _isLoading = true;
    notifyListeners();
    try {
      _distanceMatrix = (await LocationService.getDistanceMatrix(origins, destinations, mode: mode)) as Map<String, dynamic>;
    } catch (e) {
      _errorMessage = 'Failed to fetch distance matrix: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Fetches place details
  Future<void> getPlaceDetails(String placeId) async {
    _isLoading = true;
    notifyListeners();
    try {
      _placeDetails = await LocationService.getPlaceDetails(placeId);
    } catch (e) {
      _errorMessage = 'Failed to fetch place details: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Fetches nearby places
  Future<void> getNearbyPlaces(double lat, double lng, {int? radius, String? type}) async {
    _isLoading = true;
    notifyListeners();
    try {
      _nearbyPlaces = await LocationService.getNearbyPlaces(lat, lng, radius: radius, type: type);
    } catch (e) {
      _errorMessage = 'Failed to fetch nearby places: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Fetches current user location
  Future<void> getCurrentUserLocation(double lat, double lng) async {
    _isLoading = true;
    notifyListeners();
    try {
      _currentUserLocation = await LocationService.getCurrentUserLocation(lat, lng);
    } catch (e) {
      _errorMessage = 'Failed to fetch current user location: $e';
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

  /// Fetches location details by ID
  Future<void> getLocationDetailsById(String id) async {
    _isLoading = true;
    notifyListeners();
    try {
      _locationDetails = await LocationService.getLocationDetailsById(id);
    } catch (e) {
      _errorMessage = 'Failed to fetch location details: $e';
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