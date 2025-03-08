import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/agent.dart';
import '../../models/visit.dart';
import '../../providers/agent_provider.dart';
import '../Error.dart';
import 'log_visit_screen.dart';

class VisitDetailsScreen extends StatelessWidget {
  final Visit visit;

  const VisitDetailsScreen({required this.visit, super.key});

  @override
  Widget build(BuildContext context) {
    Future.microtask(() {
      debugPrint("Visit Details: ${visit.toJson()}"); // Ensure async safe execution
    });

    // Fetch agent details using AgentProvider
    final agentProvider = Provider.of<AgentProvider>(context, listen: false);
    final agent = agentProvider.agents.firstWhere(
          (agent) => agent.agentID == visit.agentID,
      orElse: () => Agent(
        agentID: visit.agentID,
        name: 'Unknown',
        lastname: '',
        phone: 'N/A',
      ),
    );

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF4CB1C7),
        elevation: 0,
        title: const Text(
          'Visit Details',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Section with Gradient Background
            Container(
              height: 150,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF4CB1C7), Color(0xFF4CB1C7)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Visit Overview',
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(Icons.location_on, color: Colors.white, size: 16),
                        const SizedBox(width: 4),
                        Text(
                          visit.location ?? 'N/A',
                          style: const TextStyle(fontSize: 16, color: Colors.white),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.access_time, color: Colors.white, size: 16),
                        const SizedBox(width: 4),
                        Text(
                          '${visit.date?.day}/${visit.date?.month}/${visit.date?.year} - ${visit.time}',
                          style: const TextStyle(fontSize: 16, color: Colors.white),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // Main Content Section
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Agent Information Card
                  _buildInfoCard(
                    title: 'Agent Information',
                    icon: Icons.person,
                    content: [
                      _buildDetailRow('Name:', '${agent.name} ${agent.lastname}'),
                      _buildDetailRow('Phone:', agent.phone ?? 'N/A'),
                      _buildDetailRow('Status:', visit.status!),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Checklists Card
                  _buildInfoCard(
                    title: 'Checklists',
                    icon: Icons.checklist,
                    content: [
                      if (visit.checklists == null || visit.checklists!.isEmpty)
                        Text(
                          'No checklists available',
                          style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                        )
                      else
                        ...visit.checklists!.map(
                              (checklist) => _buildChecklistRow(
                            checklist.item ?? 'N/A',
                            checklist.visitChecklist?.checked ?? false,
                          ),
                        ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Reasons Card
                  _buildInfoCard(
                    title: 'Reasons',
                    icon: Icons.notes,
                    content: [
                      if (visit.reasons == null || visit.reasons!.isEmpty)
                        Text(
                          'No reasons provided',
                          style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                        )
                      else
                        ...visit.reasons!.map(
                              (reason) => _buildDetailRow('•', reason.item ?? 'N/A'),
                        ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Visit Details Card (only for visited status)
                  if (visit.status == "visited")
                    _buildInfoCard(
                      title: 'Visit Details',
                      icon: Icons.info,
                      content: [
                        _buildDetailRow('Duration:', '${visit.duration} minutes'),
                      ],
                    ),

                  // Action Buttons
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      ElevatedButton.icon(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const ErrorPage(errorMessage: 'Page not available yet'),
                            ),
                          );
                        },
                        icon: const Icon(Icons.edit, color: Colors.white),
                        label: const Text('Edit Visit', style: TextStyle(color: Colors.white)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF4CB1C7),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                        ),
                      ),
                      ElevatedButton.icon(
                        onPressed: () {
                          if (visit.date == null) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Visit date is missing. Cannot log visit.')),
                            );
                            return;
                          }
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => LogVisitScreen(
                                weekNumber: _getWeekNumber(visit.date!),
                                year: visit.date!.year,
                                visitID: visit.visitID!,
                              ),
                            ),
                          );
                        },
                        icon: const Icon(Icons.check_circle, color: Colors.white),
                        label: const Text('Log Visit', style: TextStyle(color: Colors.white)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFE81F76),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoCard({required String title, required IconData icon, required List<Widget> content}) {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: const Color(0xFF4CB1C7), size: 20),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF4CB1C7)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ...content,
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Text(
            label,
            style: TextStyle(fontWeight: FontWeight.w500, color: Colors.grey[700]),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontSize: 14, color: Colors.black87),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChecklistRow(String item, bool isChecked) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(
            isChecked ? Icons.check_circle : Icons.radio_button_unchecked,
            color: isChecked ? Colors.green : Colors.grey,
            size: 16,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              item,
              style: const TextStyle(fontSize: 14, color: Colors.black87),
            ),
          ),
        ],
      ),
    );
  }

  int _getWeekNumber(DateTime date) {
    final startOfYear = DateTime(date.year, 1, 1);
    final daysSinceStart = date.difference(startOfYear).inDays;
    return (daysSinceStart / 7).ceil();
  }
}