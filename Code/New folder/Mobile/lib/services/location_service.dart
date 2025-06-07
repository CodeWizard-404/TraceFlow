import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../utils/constants.dart';
import './auth_service.dart';
import './cookie_manager.dart';

class LocationService {
  static Future<List<dynamic>> getAllRegions() async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/locations/regions');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (kDebugMode) print('All regions response: ${response.body}');
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch regions: ${response.statusCode}');
        },
      );
      if (kDebugMode) print('Decoded all regions: $response');
      return response['regions'] ?? response as List<dynamic>;
    } catch (e) {
      if (kDebugMode) print('Error fetching regions: $e');
      rethrow;
    }
  }

  static Future<List<dynamic>> getAllGovernorates() async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/locations/governorates');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch governorates: ${response.statusCode}');
        },
      );
      return response['governorates'] ?? response as List<dynamic>;
    } catch (e) {
      if (kDebugMode) print('Error fetching governorates: $e');
      rethrow;
    }
  }

  static Future<List<dynamic>> getAllDelegations() async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/locations/delegations');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch delegations: ${response.statusCode}');
        },
      );
      return response['delegations'] ?? response as List<dynamic>;
    } catch (e) {
      if (kDebugMode) print('Error fetching delegations: $e');
      rethrow;
    }
  }

  static Future<List<dynamic>> getDelegationsByGovernorate(String governorateID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/locations/delegations/governorate?governorateID=$governorateID');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch delegations by governorate: ${response.statusCode}');
        },
      );
      return response['delegations'] ?? response as List<dynamic>;
    } catch (e) {
      if (kDebugMode) print('Error fetching delegations by governorate: $e');
      rethrow;
    }
  }

  static Future<List<dynamic>> getGovernoratesByRegion(String regionID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/locations/governorates/region?regionID=$regionID');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch governorates by region: ${response.statusCode}');
        },
      );
      return response['governorates'] ?? response as List<dynamic>;
    } catch (e) {
      if (kDebugMode) print('Error fetching governorates by region: $e');
      rethrow;
    }
  }

  static Future<List<dynamic>> getRegionsByGovernorate(String governorateID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/locations/regions/governorate?governorateID=$governorateID');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch regions by governorate: ${response.statusCode}');
        },
      );
      return response['regions'] ?? response as List<dynamic>;
    } catch (e) {
      if (kDebugMode) print('Error fetching regions by governorate: $e');
      rethrow;
    }
  }

  static Future<List<dynamic>> getGovernoratesByDelegation(String delegationID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/locations/governorates/delegation?delegationID=$delegationID');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch governorates by delegation: ${response.statusCode}');
        },
      );
      return response['governorates'] ?? response as List<dynamic>;
    } catch (e) {
      if (kDebugMode) print('Error fetching governorates by delegation: $e');
      rethrow;
    }
  }

  static Future<List<dynamic>> getRegionsByUser(String userID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/locations/regions/user/$userID');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (kDebugMode) print('Regions by user response: ${response.body}');
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch regions by user: ${response.statusCode}');
        },
      );
      if (kDebugMode) print('Decoded regions by user: $response');
      return response['regions'] ?? response as List<dynamic>;
    } catch (e) {
      if (kDebugMode) print('Error fetching regions by user: $e');
      rethrow;
    }
  }

  static Future<List<dynamic>> getGovernoratesByUser(String userID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/locations/governorates/user/$userID');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch governorates by user: ${response.statusCode}');
        },
      );
      return response['governorates'] ?? response as List<dynamic>;
    } catch (e) {
      if (kDebugMode) print('Error fetching governorates by user: $e');
      rethrow;
    }
  }

  static Future<List<dynamic>> getDelegationsByUser(String userID) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/locations/delegations/user/$userID');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch delegations by user: ${response.statusCode}');
        },
      );
      return response['delegations'] ?? response as List<dynamic>;
    } catch (e) {
      if (kDebugMode) print('Error fetching delegations by user: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> updateUserLocation(String userId, double lat, double lng) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/locations/update-location');
          final response = await http.post(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
            body: jsonEncode({'userId': userId, 'lat': lat, 'lng': lng}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to update user location: ${response.statusCode}');
        },
      );
      return response['location'] ?? response;
    } catch (e) {
      if (kDebugMode) print('Error updating user location: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> geocodeAddress(String address) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/locations/geocode');
          final response = await http.post(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
            body: jsonEncode({'address': address}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to geocode address: ${response.statusCode}');
        },
      );
      return response['location'] ?? response;
    } catch (e) {
      if (kDebugMode) print('Error geocoding address: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> getDirections({
    required String origin,
    required String destination,
    String? mode,
    List<String>? waypoints,
    bool? optimizeWaypoints,
  }) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/locations/directions');
          final response = await http.post(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
            body: jsonEncode({
              'origin': origin,
              'destination': destination,
              'mode': mode,
              'waypoints': waypoints,
              'optimizeWaypoints': optimizeWaypoints,
            }),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch directions: ${response.statusCode}');
        },
      );
      return response['directions'] ?? response;
    } catch (e) {
      if (kDebugMode) print('Error fetching directions: $e');
      rethrow;
    }
  }

  static Future<List<dynamic>> searchPlaces(String query, {Map<String, dynamic>? location, int? radius}) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/locations/places');
          final response = await http.post(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
            body: jsonEncode({'query': query, 'location': location, 'radius': radius}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to search places: ${response.statusCode}');
        },
      );
      return response['places'] ?? response as List<dynamic>;
    } catch (e) {
      if (kDebugMode) print('Error searching places: $e');
      rethrow;
    }
  }

  static Future<List<dynamic>> getDistanceMatrix(List<String> origins, List<String> destinations, {String? mode}) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/locations/distance-matrix');
          final response = await http.post(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
            body: jsonEncode({'origins': origins, 'destinations': destinations, 'mode': mode}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch distance matrix: ${response.statusCode}');
        },
      );
      return response['matrix'] ?? response as List<dynamic>;
    } catch (e) {
      if (kDebugMode) print('Error fetching distance matrix: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> getPlaceDetails(String placeId) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/locations/place-details');
          final response = await http.post(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
            body: jsonEncode({'placeId': placeId}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch place details: ${response.statusCode}');
        },
      );
      return response['place'] ?? response;
    } catch (e) {
      if (kDebugMode) print('Error fetching place details: $e');
      rethrow;
    }
  }

  static Future<List<dynamic>> getNearbyPlaces(double lat, double lng, {int? radius, String? type}) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/locations/nearby-places');
          final response = await http.post(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
            body: jsonEncode({'lat': lat, 'lng': lng, 'radius': radius, 'type': type}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch nearby places: ${response.statusCode}');
        },
      );
      return response['places'] ?? response as List<dynamic>;
    } catch (e) {
      if (kDebugMode) print('Error fetching nearby places: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> getCurrentUserLocation(double lat, double lng) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/locations/current-location');
          final response = await http.post(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
            body: jsonEncode({'lat': lat, 'lng': lng}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch current user location: ${response.statusCode}');
        },
      );
      return response['location'] ?? response;
    } catch (e) {
      if (kDebugMode) print('Error fetching current location: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> getSpecificUserLocation(String userId) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/locations/user-location/$userId');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200) return response;
          throw Exception('Failed to fetch specific user location: ${response.statusCode}');
        },
      );
      return response['location'] ?? response;
    } catch (e) {
      if (kDebugMode) print('Error getting specific user location: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> getLocationDetailsById(String id) async {
    try {
      final response = await AuthService.makeAuthenticatedRequest(
        request: () async {
          final url = Uri.parse('$baseUrl/locations/location-details?id=$id');
          final response = await http.get(
            url,
            headers: CookieManager.getHeaders({'Content-Type': 'application/json'}),
          );
          CookieManager.extractCookies(response);
          if (response.statusCode == 200 || response.statusCode == 404) return response;
          throw Exception('Failed to fetch location details: ${response.statusCode}');
        },
      );
      return response['location'] ?? response;
    } catch (e) {
      if (kDebugMode) print('Error fetching location details: $e');
      rethrow;
    }
  }
}