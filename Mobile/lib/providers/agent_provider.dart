// lib/providers/agent_provider.dart
import 'package:flutter/foundation.dart';
import '../models/agent.dart';
import '../services/agent_service.dart';

class AgentProvider with ChangeNotifier {
  List<Agent> _agents = [];
  Agent? _currentAgent;
  List<String> _uniqueLocations = [];
  bool _isLoading = false;

  List<Agent> get agents => _agents;
  Agent? get currentAgent => _currentAgent;
  List<String> get uniqueLocations => _uniqueLocations;
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

  Future<void> fetchAgentByPhone(String phone, String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _currentAgent = await AgentService.fetchAgentByPhone(phone, token);
    } catch (e) {
      _currentAgent = null;
      throw Exception('Failed to fetch agent by phone: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchAgentsByLocation(String location, String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _agents = await AgentService.fetchAgentsByLocation(location, token);
    } catch (e) {
      _agents = [];
      throw Exception('Failed to fetch agents by location: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchUniqueLocations(String token) async {
    _isLoading = true;
    notifyListeners();
    try {
      _uniqueLocations = await AgentService.fetchUniqueLocations(token);
    } catch (e) {
      _uniqueLocations = [];
      throw Exception('Failed to fetch unique locations: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}