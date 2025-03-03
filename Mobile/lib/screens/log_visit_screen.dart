import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:visit_management/services/visits_service.dart';
import '../providers/visit_provider.dart';
import '../providers/agent_provider.dart';
import '../widgets/qr_scanner_widget.dart';

// Screen for logging a visit after verifying an agent's identity via QR code or manual input
class LogVisitScreen extends StatefulWidget {
  final int weekNumber;
  final int year;
  final String visitID;

  // Constructor with required parameters for week, year, and visit ID
  const LogVisitScreen({
    required this.weekNumber,
    required this.year,
    required this.visitID,
    super.key,
  });

  @override
  // Creates the state object for this stateful widget
  LogVisitScreenState createState() => LogVisitScreenState();
}

// State class for LogVisitScreen, managing dynamic data and UI updates
class LogVisitScreenState extends State<LogVisitScreen> {
  String? _agentPhone;
  String? _agentName;
  String? _agentLastname;

  final List<String> _selectedReasons = [];
  final List<String> _checklist = [];
  final List<String> _checklistItems = ['Task 1', 'Task 2', 'Task 3'];
  final List<String> _reasons = ['Inspection', 'Training', 'Other'];
  bool _isAgentVerified = false;

  // Controller for the text field where the agent's phone number can be manually entered
  final TextEditingController _manualInputController = TextEditingController();

  // Formats a phone number into TLV (Tag-Length-Value) format for tag 02
  // Used when verifying manually entered phone numbers
  // Example: Input "123456789" becomes "0209123456789" (tag 02, length 09, value 123456789)
  String formatPhoneAsTLV(String phone) {
    final length = phone.length;
    final lengthStr = length.toString().padLeft(2, '0');
    return '02$lengthStr$phone';
  }

  @override
  // Builds the UI for the LogVisitScreen
  Widget build(BuildContext context) {
    final visitProvider = Provider.of<VisitProvider>(context);
    final agentProvider = Provider.of<AgentProvider>(context);

    // Main scaffold widget providing the app structure
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
            Text(
              'Log a New Visit',
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Color(0xFF4CB1C7)),
            ),
            SizedBox(height: 20),

            // Display agent verification card if the agent hasn't been verified yet
            if (!_isAgentVerified) ...[
              // Helper method to build a styled card
              _buildInputCard(
                title: 'Agent Verification',
                icon: Icons.person,
                child: Column(
                  children: [
                    // agent's phone number manually
                    TextField(
                      // Link to the controller for managing input
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
                    // Button to initiate QR scanning or manual verification
                    ElevatedButton.icon(
                      onPressed: () async {
                        final manualInput = _manualInputController.text.trim();
                        String? scannedData;

                        // Check if there's manual input to process
                        if (manualInput.isNotEmpty) {
                          scannedData = formatPhoneAsTLV(manualInput);
                        } else {
                          // Launch the QR scanner screen and await the result
                          scannedData = await Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => QRScannerWidget()),
                          );
                        }
                        if (scannedData == null) return;

                        try {
                          // Attempt to verify the QR code or manual input with the backend
                          final verificationResult = await VisitService.verifyQRCode(
                            // Data from QR scan or formatted manual input
                            qrData: scannedData,
                            // Visit ID from the widget's properties
                            visitId: widget.visitID,
                          );

                          // Check if verification was successful
                          if (verificationResult['valid']) {
                            // Fetch visit details using the visit ID
                            final visit = await visitProvider.fetchVisitByID(widget.visitID);
                            // Fetch agent details using the agent ID from the visit
                            final agentData = await agentProvider.fetchAgentById(visit.agentID!);

                            // Update the state with fetched data and mark agent as verified
                            setState(() {
                              _agentPhone = agentData.phone;
                              _agentName = agentData.name;
                              _agentLastname = agentData.lastname;
                              _isAgentVerified = true;
                              visitProvider.startVisitTimer();

                            });
                          } else {
                            // Display an error message if verification fails
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                // Error message from the backend or a default message
                                content: Text(
                                  verificationResult['message'] ?? 'Verification failed',
                                  style: TextStyle(color: Colors.white),
                                ),
                                backgroundColor: Colors.red,
                              ),
                            );
                          }
                        } catch (error) {
                          // Handle any exceptions during verification process
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Verification error: $error')),
                          );
                        }
                      },
                      // Icon for the button
                      icon: Icon(Icons.qr_code_scanner, color: Colors.white),
                      // Button label
                      label: Text(
                        'Scan QR Code or Verify Manually',
                        style: TextStyle(color: Colors.white),
                      ),
                      // Styling for the button
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

            // Display agent details and visit logging options if verified
            if (_isAgentVerified) ...[
              _buildInputCard(
                title: 'Agent Details',
                icon: Icons.account_tree,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.person, color: Colors.grey[700], size: 15),
                        SizedBox(width: 8),
                        Text(
                          '${_agentName ?? ''} ${_agentLastname ?? ''}',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: Colors.grey[700]),
                        ),
                      ],
                    ),
                    SizedBox(height: 8),
                    Row(
                      children: [
                        Icon(Icons.phone, color: Colors.grey[700], size: 15),
                        SizedBox(width: 8),
                        Text(
                          '$_agentPhone',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: Colors.grey[700]),
                        ),
                      ],
                    ),
                    SizedBox(height: 25),
                    Row(
                      children: [
                        Icon(Icons.list_alt, color: Color(0xFF4CB1C7), size: 20),
                        SizedBox(width: 8),
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
                        Icon(Icons.list_alt, color: Color(0xFF4CB1C7), size: 20),
                        SizedBox(width: 8),
                        Text(
                          'Checklist',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4CB1C7)),
                        ),
                      ],
                    ),
                    Column(
                      children: _checklistItems.map((item) {
                        return CheckboxListTile(
                          title: Text(item),
                          value: _checklist.contains(item),
                          onChanged: (value) {
                            setState(() {
                              if (value!) {
                                _checklist.add(item);
                              } else {
                                _checklist.remove(item);
                              }
                            });
                          },
                          controlAffinity: ListTileControlAffinity.leading,
                          activeColor: Color(0xFF4CB1C7),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ),
            ],
            SizedBox(height: 24),

            Center(
              child: ElevatedButton.icon(
                onPressed: _isAgentVerified
                    ? () async {
                  final duration = visitProvider.stopVisitTimer();

                  final visitData = {
                    'duration': duration,
                    'reason': List<String>.from(_selectedReasons),
                    'checklist': List<String>.from(_checklistItems),
                    'status': 'Visited',
                  };

                  try {
                    // Attempt to log the visit with the backend
                    await visitProvider.logVisit(widget.visitID, visitData);
                    // Navigate back to the previous screen on success
                    Navigator.pop(context);
                  } catch (error) {
                    // Show an error message if logging fails
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Failed to log visit: $error')),
                    );
                  }
                }
                    : null, // Disable the button if agent isn't verified
                icon: Icon(Icons.check_circle, color: Colors.white),
                label: Text(
                  'Validate Visit',
                  style: TextStyle(color: Colors.white),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Color(0xFFE81F76),
                  padding: EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Helper method to create a consistently styled card for input sections
  // Takes a title, icon, and child widget as parameters
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