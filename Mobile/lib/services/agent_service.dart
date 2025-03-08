import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/agent.dart';
import '../utils/constants.dart';

class AgentService {
  static Future<Agent> fetchAgentById(String id) async {
      final response = await http.get(Uri.parse('$baseUrl/agents/$id'));
      if (response.statusCode == 200) {
        return Agent.fromJson(json.decode(response.body));
      } else {
        throw Exception('Failed to load agent: ${response.statusCode}');
      }

  }

  static Future<Agent> fetchAgentByPhone(String phone) async {
    final response = await http.get(Uri.parse('$baseUrl/agents/phone/$phone'));
    if (response.statusCode == 200) {
      return Agent.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to fetch agent by phone');
    }
  }

  static Future<List<Agent>> fetchAgentsByLocation(String location) async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/agents/location?location=$location'));
      if (response.statusCode == 200) {
        final List<dynamic> decodedData = json.decode(response.body);
        return decodedData.map((json) => Agent.fromJson(json)).toList();
      } else {
        throw Exception('Failed to load agents by location: ${response.statusCode}');
      }
    } catch (e) {
      rethrow;
    }
  }

  static Future<List<String>> fetchUniqueLocations() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/agents/locations'));
      if (response.statusCode == 200) {
        final List<dynamic> decodedData = json.decode(response.body);
        return decodedData.cast<String>();
      } else {
        throw Exception('Failed to load unique locations: ${response.statusCode}');
      }
    } catch (e) {
      rethrow;
    }
  }
}