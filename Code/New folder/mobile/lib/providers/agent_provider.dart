import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import '../models/agent.dart';
import '../services/agent_service.dart';

class AgentProvider with ChangeNotifier {
  final AgentService _agentService;
  List<Agent> _agents = [];
  List<String> _uniqueLocations = [];
  Agent? _currentAgent;
  bool _isLoading = false;
  String? _errorMessage;

  AgentProvider({AgentService? agentService})
      : _agentService = agentService ?? AgentService();

  List<Agent> get agents => _agents;
  List<String> get uniqueLocations => _uniqueLocations;
  Agent? get currentAgent => _currentAgent;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchAgentById(String id) async {
    if (kDebugMode) print('Fetching agent by ID: $id');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _currentAgent = await _agentService.fetchAgentById(id);
      if (kDebugMode) print('Fetched agent: ${_currentAgent?.agentID ?? "null"}');
    } catch (e) {
      _currentAgent = null;
      _errorMessage = 'Failed to fetch agent: $e';
      if (kDebugMode) print(_errorMessage);
      // Do not rethrow to prevent Future.wait errors in VisitDetailsScreen
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchUniqueLocations() async {
    if (_uniqueLocations.isNotEmpty) {
      if (kDebugMode) print('Unique locations already loaded, skipping fetch');
      return;
    }
    if (kDebugMode) print('Fetching unique locations');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _uniqueLocations = await _agentService.fetchUniqueLocations();
      if (kDebugMode) print('Fetched ${_uniqueLocations.length} unique locations');
    } catch (e) {
      _uniqueLocations = [];
      _errorMessage = 'Failed to fetch locations: $e';
      if (kDebugMode) print(_errorMessage);
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchAgentsByLocation(String location) async {
    if (kDebugMode) print('Fetching agents for location: $location');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _agents = await _agentService.fetchAgentsByLocation(location);
      if (kDebugMode) print('Fetched ${_agents.length} agents for location: $location');
    } catch (e) {
      _agents = [];
      _errorMessage = 'Failed to fetch agents: $e';
      if (kDebugMode) print(_errorMessage);
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchAgentByPhone(String phone) async {
    if (kDebugMode) print('Fetching agent by phone: $phone');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _currentAgent = await _agentService.fetchAgentByPhone(phone);
      if (_currentAgent != null) {
        _agents = [_currentAgent!];
        if (kDebugMode) print('Agent fetched: ${_currentAgent!.agentID}');
      } else {
        _agents = [];
        if (kDebugMode) print('No agent found for phone: $phone');
      }
    } catch (e) {
      _currentAgent = null;
      _agents = [];
      _errorMessage = 'Failed to fetch agent by phone: $e';
      if (kDebugMode) print(_errorMessage);
      // Do not rethrow
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearAgents() {
    if (kDebugMode) print('Clearing agents');
    _agents = [];
    _currentAgent = null;
    _errorMessage = null;
    notifyListeners();
  }

  void clearError() {
    if (kDebugMode) print('Clearing error message');
    _errorMessage = null;
    notifyListeners();
  }
}