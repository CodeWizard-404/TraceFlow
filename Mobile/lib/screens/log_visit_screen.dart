import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/visit_provider.dart';
import '../providers/agent_provider.dart';
import '../widgets/qr_scanner_widget.dart';

class LogVisitScreen extends StatefulWidget {
  final int weekNumber;
  final int year;
  final String visitID;

  const LogVisitScreen({
    required this.weekNumber,
    required this.year,
    required this.visitID,
    super.key,
  });

  @override
  LogVisitScreenState createState() => LogVisitScreenState();
}

class LogVisitScreenState extends State<LogVisitScreen> {
  String? _agentPhone;
  String? _agentID;
  final List<String> _selectedReasons = [];
  final List<String> _checklist = [];
  final List<String> _reasons = ['Inspection', 'Training', 'Other'];
  bool _isAgentVerified = false;
  final TextEditingController _manualInputController = TextEditingController();

  @override
  void dispose() {
    _manualInputController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final visitProvider = Provider.of<VisitProvider>(context);
    final agentProvider = Provider.of<AgentProvider>(context);

    return Scaffold(
      appBar: PreferredSize(
        preferredSize: Size.fromHeight(80),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF4CB1C7), Color(0xFF64C9D1)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
          ),
          child: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            title: Text(
              'Log Visit',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            centerTitle: true,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Section Title
            Text(
              'Log a New Visit',
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Color(0xFF4CB1C7)),
            ),
            SizedBox(height: 20),

            if (_agentPhone == null) ...[
              // Agent Verification Card
              _buildInputCard(
                title: 'Agent Verification',
                icon: Icons.person,
                child: Column(
                  children: [
                    TextField(
                      controller: _manualInputController,
                      decoration: InputDecoration(
                        labelText: 'Enter Agent Phone Number',
                        labelStyle: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: Color(0xFF4CB1C7)),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                      keyboardType: TextInputType.phone,
                    ),
                    SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: () async {
                        final manualInput = _manualInputController.text.trim();
                        if (manualInput.isNotEmpty) {
                          setState(() {
                            _agentPhone = manualInput;
                          });
                        } else {
                          final result = await Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => QRScannerWidget()),
                          );
                          if (result != null) {
                            setState(() {
                              _agentPhone = result;
                            });
                          }
                        }

                        if (_agentPhone != null) {
                          try {
                            // Fetch agent details using the phone number.
                            final agent = await agentProvider.fetchAgentByPhone(_agentPhone!);

                            // Fetch the visit details using the visitID.
                            final visit = await visitProvider.fetchVisitByID(widget.visitID);

                            // Verify if the agent ID matches the visit's agent ID.
                            if (agent['agentID'] == visit.agentID) {
                              setState(() {
                                _agentID = agent['agentID'];
                                _isAgentVerified = true;
                                visitProvider.startVisitTimer();
                              });
                            } else {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Agent ID mismatch!')),
                              );
                            }
                          } catch (error) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Failed to fetch details: $error')),
                            );
                          }
                        }
                      },
                      icon: Icon(Icons.qr_code_scanner, color: Colors.white),
                      label: Text('Scan QR Code or Use Manual Input'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Color(0xFF4CB1C7),
                        padding: EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            if (_isAgentVerified) ...[
              // Agent Details Card
              _buildInputCard(
                title: 'Agent Details',
                icon: Icons.person,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Agent ID: $_agentID',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: Colors.grey[700]),
                    ),
                    SizedBox(height: 12),
                    Text(
                      'Select Reasons for Visit',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4CB1C7)),
                    ),
                    Wrap(
                      spacing: 8.0,
                      children: _reasons.map((reason) {
                        return FilterChip(
                          label: Text(reason),
                          selected: _selectedReasons.contains(reason),
                          onSelected: (isSelected) {
                            setState(() {
                              if (isSelected) {
                                _selectedReasons.add(reason);
                              } else {
                                _selectedReasons.remove(reason);
                              }
                            });
                          },
                          selectedColor: Color(0xFFE8F5F9),
                          checkmarkColor: Color(0xFF4CB1C7),
                        );
                      }).toList(),
                    ),
                    SizedBox(height: 16),
                    Text(
                      'Checklist',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4CB1C7)),
                    ),
                    CheckboxListTile(
                      title: Text('Task 1 Completed'),
                      value: _checklist.contains('Task 1'),
                      onChanged: (value) => setState(() {
                        if (value!) {
                          _checklist.add('Task 1');
                        } else {
                          _checklist.remove('Task 1');
                        }
                      }),
                      controlAffinity: ListTileControlAffinity.leading,
                      activeColor: Color(0xFF4CB1C7),
                    ),
                    CheckboxListTile(
                      title: Text('Task 2 Completed'),
                      value: _checklist.contains('Task 2'),
                      onChanged: (value) => setState(() {
                        if (value!) {
                          _checklist.add('Task 2');
                        } else {
                          _checklist.remove('Task 2');
                        }
                      }),
                      controlAffinity: ListTileControlAffinity.leading,
                      activeColor: Color(0xFF4CB1C7),
                    ),
                  ],
                ),
              ),

              SizedBox(height: 24),

              // Validate Visit Button
              Center(
                child: ElevatedButton.icon(
                  onPressed: () async {
                    final duration = visitProvider.stopVisitTimer();

                    final visitData = {
                      'duration': duration,
                      'reason': List<String>.from(_selectedReasons),
                      'checklist': List<String>.from(_checklist),
                      'status': 'Visited',
                    };

                    print('Logging visit with data: $visitData'); // Debug print

                    try {
                      await visitProvider.logVisit(widget.visitID, visitData);
                      Navigator.pop(context);
                    } catch (error) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Failed to log visit: $error')),
                      );
                    }
                  },
                  icon: Icon(Icons.check_circle, color: Colors.white),
                  label: Text('Validate Visit'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Color(0xFFE81F76),
                    padding: EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildInputCard({required String title, required IconData icon, required Widget child}) {
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
            child,
          ],
        ),
      ),
    );
  }
}