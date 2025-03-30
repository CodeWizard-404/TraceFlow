// lib/providers/agent_provider.dart
import 'package:flutter/foundation.dart';
import '../models/agent.dart';
import '../services/agent_service.dart'; // Assuming you have an Agent model

class AgentProvider with ChangeNotifier {
  List<Agent> _agents = [];
  List<String> _uniqueLocations = [];
  Agent? _currentAgent;
  bool _isLoading = false;

  List<Agent> get agents => _agents;
  List<String> get uniqueLocations => _uniqueLocations;
  Agent? get currentAgent => _currentAgent;
  bool get isLoading => _isLoading;

  Future<void> fetchAgentById(String id, String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _currentAgent = await AgentService.fetchAgentById(id, token);
    } catch (e) {
      _currentAgent = null;
      throw Exception('Failed to fetch agent: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchUniqueLocations(String token) async {
    if (_uniqueLocations.isNotEmpty) return;
    _isLoading = true;
    try {
      _uniqueLocations = await AgentService.fetchUniqueLocations(token); // Implement this in your service
    } catch (e) {
      _uniqueLocations = [];
      throw Exception('Failed to fetch locations: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchAgentsByLocation(String location, String token) async {
    _isLoading = true;
    try {
      _agents = await AgentService.fetchAgentsByLocation(location, token); // Implement this in your service
    } catch (e) {
      _agents = [];
      throw Exception('Failed to fetch agents: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchAgentByPhone(String phone, String token) async {
    _isLoading = true;
    try {
      _currentAgent = await AgentService.fetchAgentByPhone(phone, token); // Implement this in your service
    } catch (e) {
      _currentAgent = null;
      throw Exception('Failed to fetch agent by phone: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}