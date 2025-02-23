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
  String? _agentName;
  String? _agentLastname;
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
              // Agent Phone Input Card
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
                                _agentName = agent['name']; // Store the agent's name
                                _agentLastname = agent['lastname']; // Store the agent's lastname
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
                      label: Text(
                        _agentPhone != null ? 'Agent Verified' : 'Scan QR Code or Use Manual Input',
                        style: TextStyle(color: Colors.white)),
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
                icon: Icons.account_tree,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Agent Name with Icon
                    Row(
                      children: [
                        Icon(Icons.person,color: Colors.grey[700], size: 15),
                        SizedBox(width: 8),
                        Text(
                          '${_agentName ?? ''} ${_agentLastname ?? ''}', // Display name and lastname
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: Colors.grey[700]),
                        ),
                      ],
                    ),
                    SizedBox(height: 8),

                    // Agent Phone with Icon
                    Row(
                      children: [
                        Icon(Icons.phone,color: Colors.grey[700],  size: 15),
                        SizedBox(width: 8),
                        Text(
                          '$_agentPhone', // Display phone number
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: Colors.grey[700]),
                        ),
                      ],
                    ),
                    SizedBox(height: 25),

                    Row(
                      children: [
                        Icon(Icons.list_alt, color: Color(0xFF4CB1C7), size: 20), // Add an icon
                        SizedBox(width: 8), // Add spacing between the icon and text
                        Text(
                          'Reasons for Visit',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4CB1C7)),
                        ),
                      ],
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
                    Row(
                      children: [
                        Icon(Icons.list_alt, color: Color(0xFF4CB1C7), size: 20), // Add an icon
                        SizedBox(width: 8), // Add spacing between the icon and text
                        Text(
                          'Checklist',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4CB1C7)),
                        ),
                      ],
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
                    CheckboxListTile(
                      title: Text('Task 3 Completed'),
                      value: _checklist.contains('Task 3'),
                      onChanged: (value) => setState(() {
                        if (value!) {
                          _checklist.add('Task 3');
                        } else {
                          _checklist.remove('Task 3');
                        }
                      }),
                      controlAffinity: ListTileControlAffinity.leading,
                      activeColor: Color(0xFF4CB1C7),
                    ),
                    CheckboxListTile(
                      title: Text('Task 4 Completed'),
                      value: _checklist.contains('Task 4'),
                      onChanged: (value) => setState(() {
                        if (value!) {
                          _checklist.add('Task 4');
                        } else {
                          _checklist.remove('Task 4');
                        }
                      }),
                      controlAffinity: ListTileControlAffinity.leading,
                      activeColor: Color(0xFF4CB1C7),
                    ),
                    CheckboxListTile(
                      title: Text('Task 5 Completed'),
                      value: _checklist.contains('Task 5'),
                      onChanged: (value) => setState(() {
                        if (value!) {
                          _checklist.add('Task 5');
                        } else {
                          _checklist.remove('Task 5');
                        }
                      }),
                      controlAffinity: ListTileControlAffinity.leading,
                      activeColor: Color(0xFF4CB1C7),
                    ),

                  ],
                ),
              ),
            ],          ],
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