import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/agent.dart';
import '../models/user.dart';
import '../utils/constants.dart';
import '../services/cookie_manager.dart';

class AgentService {
  Future<Agent?> fetchAgentById(String id) async {
    if (kDebugMode) print('AgentService: Fetching agent by ID: $id');
    try {
      final headers = CookieManager.getHeaders();
      if (kDebugMode) print('Headers prepared: $headers');
      final response = await http.get(
        Uri.parse('$baseUrl/agents/$id'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      if (response.statusCode != 200) {
        if (kDebugMode) print('Response body: ${response.body}');
      }
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final agent = Agent.fromJson(data);
        if (kDebugMode) print('Agent fetched: ${agent.agentID}');
        return agent;
      } else if (response.statusCode == 404) {
        if (kDebugMode) print('No agent found for ID: $id');
        return null;
      } else {
        final error = 'Failed to fetch agent: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching agent by ID: $e');
      return null; // Return null instead of throwing to prevent UI errors
    }
  }

  Future<Agent?> fetchAgentByPhone(String phone) async {
    if (kDebugMode) print('AgentService: Fetching agent by phone: $phone');
    try {
      final headers = CookieManager.getHeaders();
      if (kDebugMode) print('Headers prepared: $headers');
      final response = await http.get(
        Uri.parse('$baseUrl/agents/phone/$phone'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      if (response.statusCode != 200) {
        if (kDebugMode) print('Response body: ${response.body}');
      }
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data != null) {
          final agent = Agent.fromJson(data);
          if (kDebugMode) print('Agent fetched: ${agent.agentID}');
          return agent;
        } else {
          if (kDebugMode) print('No agent found for phone: $phone');
          return null;
        }
      } else if (response.statusCode == 404) {
        if (kDebugMode) print('No agent found for phone: $phone');
        return null;
      } else {
        final error = 'Failed to fetch agent: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching agent by phone: $e');
      return null; // Return null instead of throwing
    }
  }

  Future<List<Agent>> fetchAgentsByLocation(String location) async {
    if (kDebugMode) print('AgentService: Fetching agents for location: $location');
    try {
      final headers = CookieManager.getHeaders();
      if (kDebugMode) print('Headers prepared: $headers');
      final response = await http.get(
        Uri.parse('$baseUrl/agents/location?location=$location'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      if (response.statusCode != 200) {
        if (kDebugMode) print('Response body: ${response.body}');
      }
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        final agents = data.map((json) => Agent.fromJson(json)).toList();
        if (kDebugMode) print('Agents fetched: ${agents.length}');
        return agents;
      } else {
        final error = 'Failed to fetch agents: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching agents by location: $e');
      throw Exception('Error fetching agents: $e');
    }
  }

  Future<List<String>> fetchUniqueLocations() async {
    if (kDebugMode) print('AgentService: Fetching unique locations');
    try {
      final headers = CookieManager.getHeaders();
      if (kDebugMode) print('Headers prepared: $headers');
      final response = await http.get(
        Uri.parse('$baseUrl/agents/locations'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      if (response.statusCode != 200) {
        if (kDebugMode) print('Response body: ${response.body}');
      }
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        final locations = data.map((loc) => loc.toString()).toList();
        if (kDebugMode) print('Unique locations: $locations');
        return locations;
      } else {
        final error = 'Failed to fetch locations: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching unique locations: $e');
      throw Exception('Error fetching locations: $e');
    }
  }

  Future<List<Agent>> getAgentsBySupervisor(String supervisorID) async {
    if (kDebugMode) print('AgentService: Fetching agents by supervisor ID: $supervisorID');
    try {
      final headers = CookieManager.getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/agents/supervisor/$supervisorID'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final agents = (data['agents'] as List).map((json) => Agent.fromJson(json)).toList();
        if (kDebugMode) print('Agents fetched: ${agents.length}');
        return agents;
      } else {
        final error = 'Failed to fetch agents: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching agents by supervisor: $e');
      throw Exception('Error fetching agents: $e');
    }
  }

  Future<User> getSupervisorByAgent(String agentID) async {
    if (kDebugMode) print('AgentService: Fetching supervisor by agent ID: $agentID');
    try {
      final headers = CookieManager.getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/agents/agent/$agentID/supervisor'),
        headers: headers,
      );

      if (kDebugMode) print('Response status: ${response.statusCode}');
      CookieManager.extractCookies(response);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final supervisor = User.fromJson(data);
        if (kDebugMode) print('Supervisor fetched: ${supervisor.userID}');
        return supervisor;
      } else {
        final error = 'Failed to fetch supervisor: ${response.statusCode}';
        if (kDebugMode) print(error);
        throw Exception(error);
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching supervisor by agent: $e');
      throw Exception('Error fetching supervisor: $e');
    }
  }
}