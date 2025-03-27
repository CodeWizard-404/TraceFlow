// lib/services/agent_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/agent.dart';
import '../utils/constants.dart';

class AgentService {
  // Fetch an agent by ID
  static Future<Agent> fetchAgentById(String id, String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/agents/$id'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      return Agent.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to load agent: ${response.body}');
    }
  }

  // Fetch an agent by phone
  static Future<Agent> fetchAgentByPhone(String phone, String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/agents/phone/$phone'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      return Agent.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to fetch agent by phone: ${response.body}');
    }
  }

  // Fetch agents by location
  static Future<List<Agent>> fetchAgentsByLocation(String location, String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/agents/location?location=$location'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      final List<dynamic> decodedData = json.decode(response.body);
      return decodedData.map((json) => Agent.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load agents by location: ${response.body}');
    }
  }

  // Fetch all unique agent locations
  static Future<List<String>> fetchUniqueLocations(String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/agents/locations'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      final List<dynamic> decodedData = json.decode(response.body);
      return decodedData.cast<String>();
    } else {
      throw Exception('Failed to load unique locations: ${response.body}');
    }
  }
}