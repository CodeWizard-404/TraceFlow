// providers/agent_provider.dart
import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../models/agent.dart';
import '../services/agent_service.dart';

class AgentProvider with ChangeNotifier {
  List<Agent> _agents = [];
  List<String> _uniqueLocations = [];

  List<Agent> get agents => _agents;
  List<String> get uniqueLocations => _uniqueLocations;

  // Fetch an agent by ID
  Future<Agent> fetchAgentById(String id) async {
    try {
      final agent = await AgentService.fetchAgentById(id);
      _agents = [agent];
      notifyListeners();
      return agent; // Return the agent data
    } catch (error) {
      throw Exception('Failed to fetch agent: $error');
    }
  }

  Future<Agent> fetchAgentByPhone(String phone) async {
    try {
      final agent = await AgentService.fetchAgentByPhone(phone);
      return agent;
    } catch (error) {
      throw Exception('Failed to fetch agent by phone: $error');
    }
  }
  // Fetch agents by location
  Future<void> fetchAgentsByLocation(String location) async {
    try {
      final agents = await AgentService.fetchAgentsByLocation(location);
      _agents = agents; // Update the agents list
      notifyListeners(); // Notify listeners to update the UI
    } catch (error) {
      throw Exception('Failed to fetch agents by location: $error');
    }
  }

  // Fetch all unique agent locations
  Future<void> fetchUniqueLocations() async {
    try {
      final locations = await AgentService.fetchUniqueLocations();
      _uniqueLocations = locations; // Update the list with unique locations
      notifyListeners();
    } catch (error) {
      throw Exception('Failed to fetch unique locations: $error');
    }
  }
}