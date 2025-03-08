import 'package:flutter/material.dart';
import '../../models/visit.dart';
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
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Color(0xFF4CB1C7),
        elevation: 0,
        title: Text(
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
              decoration: BoxDecoration(
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
                    Text(
                      'Visit Overview',
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    SizedBox(height: 8),
                    Row(
                      children: [
                        Icon(Icons.location_on, color: Colors.white, size: 16),
                        SizedBox(width: 4),
                        Text(
                          visit.location ?? 'N/A',
                          style: TextStyle(fontSize: 16, color: Colors.white),
                        ),
                      ],
                    ),
                    SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(Icons.access_time, color: Colors.white, size: 16),
                        SizedBox(width: 4),
                        Text(
                          '${visit.date?.day}/${visit.date?.month}/${visit.date?.year} - ${visit.time}',
                          style: TextStyle(fontSize: 16, color: Colors.white),
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
                      _buildDetailRow('Agent ID:', visit.agentID!),
                      _buildDetailRow('Status:', visit.status!),
                    ],
                  ),

                  SizedBox(height: 16),

                  // Visit Details Card
                  if (visit.status == "visited")
                    _buildInfoCard(
                      title: 'Visit Details',
                      icon: Icons.info,
                      content: [
                        _buildDetailRow('Duration:', '${visit.duration} minutes'),

                        // Checklists Section
                        if (visit.checklists != null && visit.checklists!.isNotEmpty)
                          ...[
                            const SizedBox(height: 8),
                            _buildSectionHeader('Checklists'),
                            ...visit.checklists!.map(
                                  (checklist) => _buildChecklistRow(
                                checklist.item ?? 'N/A',
                                checklist.visitChecklist?.checked ?? false,
                              ),
                            ),
                          ],

                        // Reasons Section
                        if (visit.reasons != null && visit.reasons!.isNotEmpty)
                          ...[
                            const SizedBox(height: 8),
                            _buildSectionHeader('Reasons'),
                            ...visit.reasons!.map(
                                  (reason) => _buildDetailRow('•', reason.item ?? 'N/A'),
                            ),
                          ],
                      ],
                    ),

                  SizedBox(height: 16),

                  // Action Buttons
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      ElevatedButton.icon(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => ErrorPage(errorMessage: 'Page not available yet'),
                            ),
                          );
                        },
                        icon: Icon(Icons.edit, color: Colors.white),
                        label: Text('Edit Visit', style: TextStyle(color: Colors.white)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Color(0xFF4CB1C7),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                        ),
                      ),
                      ElevatedButton.icon(
                        onPressed: () {
                          if (visit.date == null) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Visit date is missing. Cannot log visit.')),
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
                        icon: Icon(Icons.check_circle, color: Colors.white),
                        label: Text('Log Visit', style: TextStyle(color: Colors.white)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Color(0xFFE81F76),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
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
                Icon(icon, color: Color(0xFF4CB1C7), size: 20),
                SizedBox(width: 8),
                Text(
                  title,
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF4CB1C7)),
                ),
              ],
            ),
            SizedBox(height: 12),
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
          SizedBox(width: 8),
          Expanded(
            child: Text(
              value,
              style: TextStyle(fontSize: 14, color: Colors.black87),
            ),
          ),
        ],
      ),
    );
  }


  // Helper for section headers
  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Text(
        title,
        style: TextStyle(
          fontWeight: FontWeight.bold,
          color: Colors.grey[800],
          fontSize: 14,
        ),
      ),
    );
  }

// Special row for checklist items with check status
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
          SizedBox(width: 8),
          Expanded(
            child: Text(
              item,
              style: TextStyle(fontSize: 14, color: Colors.black87),
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