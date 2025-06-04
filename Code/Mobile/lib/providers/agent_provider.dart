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

  Future<void> createAgent({
    required String name,
    required String lastname,
    required String email,
    required String phone,
    required String supervisorID,
    required String delegationID,
    double? latitude,
    double? longitude,
    String? locationAddress,
  }) async {
    if (kDebugMode) print('AgentProvider: Creating agent for $name $lastname');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final agent = await _agentService.createAgent(
        name: name,
        lastname: lastname,
        email: email,
        phone: phone,
        supervisorID: supervisorID,
        delegationID: delegationID,
        latitude: latitude,
        longitude: longitude,
        locationAddress: locationAddress,
      );
      if (agent != null) {
        _currentAgent = agent;
        _agents = [..._agents, agent];
        if (kDebugMode) print('Agent created: ${agent.agentID}');
      } else {
        _errorMessage = 'Failed to create agent';
        if (kDebugMode) print(_errorMessage);
      }
    } catch (e) {
      _errorMessage = 'Failed to create agent: $e';
      if (kDebugMode) print(_errorMessage);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchAllAgents() async {
    if (kDebugMode) print('AgentProvider: Fetching all agents');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _agents = await _agentService.fetchAllAgents();
      if (kDebugMode) print('Fetched ${_agents.length} agents');
    } catch (e) {
      _agents = [];
      _errorMessage = 'Failed to fetch all agents: $e';
      if (kDebugMode) print(_errorMessage);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchAgentById(String id) async {
    if (kDebugMode) print('AgentProvider: Fetching agent by ID: $id');
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
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> updateAgent({
    required String id,
    String? name,
    String? lastname,
    String? email,
    String? phone,
    String? supervisorID,
    String? delegationID,
  }) async {
    if (kDebugMode) print('AgentProvider: Updating agent ID: $id');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final updatedAgent = await _agentService.updateAgent(
        id: id,
        name: name,
        lastname: lastname,
        email: email,
        phone: phone,
        supervisorID: supervisorID,
        delegationID: delegationID,
      );
      if (updatedAgent != null) {
        _currentAgent = updatedAgent;
        _agents = _agents.map((agent) => agent.agentID == id ? updatedAgent : agent).toList();
        if (kDebugMode) print('Agent updated: ${updatedAgent.agentID}');
      } else {
        _errorMessage = 'Failed to update agent';
        if (kDebugMode) print(_errorMessage);
      }
    } catch (e) {
      _errorMessage = 'Failed to update agent: $e';
      if (kDebugMode) print(_errorMessage);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> deleteAgent(String id) async {
    if (kDebugMode) print('AgentProvider: Deleting agent ID: $id');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final success = await _agentService.deleteAgent(id);
      if (success) {
        _agents = _agents.where((agent) => agent.agentID != id).toList();
        if (_currentAgent?.agentID == id) {
          _currentAgent = null;
        }
        if (kDebugMode) print('Agent deleted: $id');
      } else {
        _errorMessage = 'Failed to delete agent';
        if (kDebugMode) print(_errorMessage);
      }
    } catch (e) {
      _errorMessage = 'Failed to delete agent: $e';
      if (kDebugMode) print(_errorMessage);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchAgentByPhone(String phone) async {
    if (kDebugMode) print('AgentProvider: Fetching agent by phone: $phone');
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
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchAgentsByDelegation(String delegationID) async {
    if (kDebugMode) print('AgentProvider: Fetching agents for delegation: $delegationID');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _agents = await _agentService.fetchAgentsByDelegation(delegationID);
      if (kDebugMode) print('Fetched ${_agents.length} agents for delegation: $delegationID');
    } catch (e) {
      _agents = [];
      _errorMessage = 'Failed to fetch agents by delegation: $e';
      if (kDebugMode) print(_errorMessage);
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
    if (kDebugMode) print('AgentProvider: Fetching unique locations');
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
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> getAgentSupervisor(String agentID) async {
    if (kDebugMode) print('AgentProvider: Fetching supervisor by agent ID: $agentID');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final supervisor = await _agentService.getAgentSupervisor(agentID);
      if (supervisor != null) {
        _currentAgent = Agent(
          agentID: 'N/A',
          name: 'N/A',
          lastname: 'N/A',
          delegationID: 'N/A',
          Supervisor: supervisor,
        );
        if (kDebugMode) print('Supervisor fetched: ${supervisor.userID}');
      } else {
        _currentAgent = null;
        if (kDebugMode) print('No supervisor found for agent: $agentID');
      }
    } catch (e) {
      _currentAgent = null;
      _errorMessage = 'Failed to fetch supervisor: $e';
      if (kDebugMode) print(_errorMessage);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> getAgentsByUser(String userID) async {
    if (kDebugMode) print('AgentProvider: Fetching agents by user ID: $userID');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _agents = await _agentService.getAgentsByUser(userID);
      if (kDebugMode) print('Fetched ${_agents.length} agents for user: $userID');
    } catch (e) {
      _agents = [];
      _errorMessage = 'Failed to fetch agents by user: $e';
      if (kDebugMode) print(_errorMessage);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> uploadAgents(Uint8List fileBytes) async {
    if (kDebugMode) print('AgentProvider: Uploading agent CSV');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final result = await _agentService.uploadAgents(fileBytes);
      if (result['status'] == 'completed_successfully') {
        if (kDebugMode) print('CSV uploaded successfully: ${result['summary']}');
      } else {
        _errorMessage = 'CSV upload completed with issues: ${result['detailedLog']['errors']}';
        if (kDebugMode) print(_errorMessage);
      }
    } catch (e) {
      _errorMessage = 'Failed to upload agents: $e';
      if (kDebugMode) print(_errorMessage);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchAgentLocations() async {
    if (kDebugMode) print('AgentProvider: Fetching agent locations');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _agents = await _agentService.fetchAgentLocations();
      if (kDebugMode) print('Fetched ${_agents.length} agent locations');
    } catch (e) {
      _agents = [];
      _errorMessage = 'Failed to fetch agent locations: $e';
      if (kDebugMode) print(_errorMessage);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchNearbyAgents({
    required double lat,
    required double lng,
    double radius = 5000,
  }) async {
    if (kDebugMode) print('AgentProvider: Fetching nearby agents at ($lat, $lng)');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _agents = await _agentService.fetchNearbyAgents(
        lat: lat,
        lng: lng,
        radius: radius,
      );
      if (kDebugMode) print('Fetched ${_agents.length} nearby agents');
    } catch (e) {
      _agents = [];
      _errorMessage = 'Failed to fetch nearby agents: $e';
      if (kDebugMode) print(_errorMessage);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchAgentsByBounds({
    required double southWestLat,
    required double southWestLng,
    required double northEastLat,
    required double northEastLng,
  }) async {
    if (kDebugMode) print('AgentProvider: Fetching agents by bounds');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _agents = await _agentService.fetchAgentsByBounds(
        southWestLat: southWestLat,
        southWestLng: southWestLng,
        northEastLat: northEastLat,
        northEastLng: northEastLng,
      );
      if (kDebugMode) print('Fetched ${_agents.length} agents by bounds');
    } catch (e) {
      _agents = [];
      _errorMessage = 'Failed to fetch agents by bounds: $e';
      if (kDebugMode) print(_errorMessage);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> correctAgentLocation({
    required String agentId,
    required double latitude,
    required double longitude,
    required String address,
  }) async {
    if (kDebugMode) print('AgentProvider: Correcting location for agent ID: $agentId');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final success = await _agentService.correctAgentLocation(
        agentId: agentId,
        latitude: latitude,
        longitude: longitude,
        address: address,
      );
      if (success) {
        if (_currentAgent?.agentID == agentId) {
          _currentAgent = Agent(
            agentID: _currentAgent!.agentID,
            name: _currentAgent!.name,
            lastname: _currentAgent!.lastname,
            email: _currentAgent!.email,
            phone: _currentAgent!.phone,
            delegationID: _currentAgent!.delegationID,
            latitude: latitude,
            longitude: longitude,
            location: address,
            Supervisor: _currentAgent!.Supervisor,
          );
        }
        _agents = _agents.map((agent) {
          if (agent.agentID == agentId) {
            return Agent(
              agentID: agent.agentID,
              name: agent.name,
              lastname: agent.lastname,
              email: agent.email,
              phone: agent.phone,
              delegationID: agent.delegationID,
              latitude: latitude,
              longitude: longitude,
              location: address,
              Supervisor: agent.Supervisor,
            );
          }
          return agent;
        }).toList();
        if (kDebugMode) print('Agent location corrected: $agentId');
      } else {
        _errorMessage = 'Failed to correct agent location';
        if (kDebugMode) print(_errorMessage);
      }
    } catch (e) {
      _errorMessage = 'Failed to correct agent location: $e';
      if (kDebugMode) print(_errorMessage);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearAgents() {
    if (kDebugMode) print('AgentProvider: Clearing agents');
    _agents = [];
    _currentAgent = null;
    _errorMessage = null;
    notifyListeners();
  }

  void clearError() {
    if (kDebugMode) print('AgentProvider: Clearing error message');
    _errorMessage = null;
    notifyListeners();
  }
}