import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:TraceFlow/models/agent.dart';
import 'package:TraceFlow/providers/agent_provider.dart';
import 'package:TraceFlow/widgets/commen/spacer.dart';
import 'package:TraceFlow/widgets/commen/text_field.dart';
import 'dart:async';

import '../../providers/auth_provider.dart';

class AgentSelector extends StatefulWidget {
  final String? recipientID;
  final String? selectedLocation;
  final TextEditingController phoneController;
  final void Function(String?) onRecipientIDChanged;
  final Future<void> Function(String?) onLocationChanged;

  const AgentSelector({
    required this.recipientID,
    required this.selectedLocation,
    required this.phoneController,
    required this.onRecipientIDChanged,
    required this.onLocationChanged,
    super.key,
  });

  @override
  State<AgentSelector> createState() => _AgentSelectorState();
}

class _AgentSelectorState extends State<AgentSelector> {
  String? _phoneError;
  Timer? _debounce;
  final TextEditingController _searchController = TextEditingController();
  List<Agent> _filteredAgents = [];
  int _visibleAgentsLimit = 10;

  @override
  void initState() {
    super.initState();
    widget.phoneController.addListener(_onPhoneChanged);
    _searchController.addListener(_filterAgents);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    widget.phoneController.removeListener(_onPhoneChanged);
    _searchController.removeListener(_filterAgents);
    _searchController.dispose();
    super.dispose();
  }

  void _onPhoneChanged() {
    final value = widget.phoneController.text;
    final agentProvider = Provider.of<AgentProvider>(context, listen: false);
    setState(() => _phoneError = null);
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () async {
      if (value.length == 8) {
        try {
          await agentProvider.fetchAgentByPhone(value);
          final agent = agentProvider.currentAgent;
          if (agent != null) {
            widget.onRecipientIDChanged(agent.agentID);
            widget.onLocationChanged(agent.location);
          } else {
            setState(() => _phoneError = 'Agent not found.');
            widget.onRecipientIDChanged(null);
          }
        } catch (e) {
          setState(() => _phoneError = 'Error: $e');
          widget.onRecipientIDChanged(null);
        }
      }
    });
  }

  void _filterAgents() {
    final agentProvider = Provider.of<AgentProvider>(context, listen: false);
    final query = _searchController.text.toLowerCase();
    setState(() {
      _filteredAgents = agentProvider.agents.where((agent) {
        final fullName = '${agent.name} ${agent.lastname}'.toLowerCase();
        final phone = agent.phone?.toLowerCase() ?? '';
        return fullName.contains(query) || phone.contains(query);
      }).toList();
      _visibleAgentsLimit = 10;
    });
  }

  Future<void> _showLocationDialog(AgentProvider agentProvider) async {
    final locations = agentProvider.uniqueLocations;
    final searchController = TextEditingController();
    List<String> filteredLocations = List.from(locations);

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Select Location'),
              content: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: searchController,
                      decoration: const InputDecoration(hintText: 'Search locations...'),
                      onChanged: (value) {
                        setDialogState(() {
                          filteredLocations = locations
                              .where((loc) => loc.toLowerCase().contains(value.toLowerCase()))
                              .toList();
                        });
                      },
                    ),
                    SizedBox(
                      height: 200,
                      child: ListView.builder(
                        itemCount: filteredLocations.length,
                        itemBuilder: (context, index) {
                          final location = filteredLocations[index];
                          return RadioListTile<String>(
                            title: Text(location),
                            value: location,
                            groupValue: widget.selectedLocation,
                            onChanged: (value) async {
                              if (value != null) {
                                await widget.onLocationChanged(value);
                                Navigator.pop(context);
                                setState(() {
                                  _filteredAgents = List.from(agentProvider.agents);
                                  _visibleAgentsLimit = 10;
                                });
                              }
                            },
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final agentProvider = Provider.of<AgentProvider>(context);
    final selectedAgent = widget.recipientID != null
        ? agentProvider.agents.firstWhere(
          (agent) => agent.agentID == widget.recipientID,
      orElse: () => agentProvider.currentAgent ?? Agent(agentID: '', name: 'Unknown', lastname: '', location: '', delegationID: ''),
    )
        : null;
    final agentsToShow = _searchController.text.isEmpty ? agentProvider.agents : _filteredAgents;
    final visibleAgents = agentsToShow.take(_visibleAgentsLimit).toList();
    final hasMore = agentsToShow.length > _visibleAgentsLimit;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CustomTextField(
          controller: widget.phoneController,
          label: 'Agent Phone Number',
          keyboardType: TextInputType.phone,
        ),
        if (_phoneError != null) ...[
          const CustomSpacer(height: 8),
          Text(_phoneError!, style: const TextStyle(color: Colors.red)),
        ],
        const CustomSpacer(height: 16),
        if (widget.phoneController.text.isEmpty) ...[
          GestureDetector(
            onTap: () => _showLocationDialog(agentProvider),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.location_on),
                  const SizedBox(width: 8),
                  Expanded(child: Text(widget.selectedLocation ?? 'Select Location')),
                ],
              ),
            ),
          ),
          if (widget.selectedLocation != null) ...[
            const CustomSpacer(height: 16),
            CustomTextField(
              controller: _searchController,
              label: 'Search Agents (Name, Phone)',
            ),
            const CustomSpacer(height: 8),
            if (agentsToShow.isEmpty)
              const Text('No agents found.', style: TextStyle(color: Colors.red))
            else ...[
              SizedBox(
                height: 200,
                child: ListView.builder(
                  itemCount: visibleAgents.length,
                  itemBuilder: (context, index) {
                    final agent = visibleAgents[index];
                    return RadioListTile<String>(
                      title: Text('${agent.name} ${agent.lastname} (${agent.phone ?? "No phone"})'),
                      value: agent.agentID,
                      groupValue: widget.recipientID,
                      onChanged: (value) {
                        widget.onRecipientIDChanged(value);
                        setState(() {});
                      },
                    );
                  },
                ),
              ),
              if (hasMore) ...[
                const CustomSpacer(height: 8),
                ElevatedButton(
                  onPressed: () => setState(() => _visibleAgentsLimit += 10),
                  child: const Text('Show More'),
                ),
              ],
            ],
          ],
        ],
        if (selectedAgent != null && widget.recipientID != null) ...[
          const CustomSpacer(height: 16),
          Text('Selected Agent: ${selectedAgent.name} ${selectedAgent.lastname}'),
        ],
      ],
    );
  }
}