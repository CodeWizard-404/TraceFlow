import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/agent.dart';
import '../../models/checklist.dart';
import '../../models/reason.dart';
import '../../providers/agent_provider.dart';
import '../../providers/checklist_provider.dart';
import '../../providers/reason_provider.dart';
import '../../providers/visit_provider.dart';
import '../../services/visits_service.dart';
import '../../widgets/qr_scanner_widget.dart';
import '../../models/visit.dart';

class LogVisitScreen extends StatefulWidget {
  final String visitID;

  const LogVisitScreen({required this.visitID, super.key, required int weekNumber, required int year});

  @override
  LogVisitScreenState createState() => LogVisitScreenState();
}

class LogVisitScreenState extends State<LogVisitScreen> {
  bool _isAgentVerified = false;
  Agent? _agent;
  Visit? _visit;
  List<Checklist> _checklistItems = [];
  List<Reason> _reasonItems = [];
  final TextEditingController _manualInputController = TextEditingController();

  @override
  void dispose() {
    _manualInputController.dispose();
    super.dispose();
  }

  String formatPhoneAsTLV(String phone) {
    final length = phone.length;
    final lengthStr = length.toString().padLeft(2, '0');
    return '02$lengthStr$phone';
  }

  Future<void> _verifyAgent(String scannedData) async {
    try {
      final verificationResult = await VisitService.verifyQRCode(
        qrData: scannedData,
        visitId: widget.visitID,
      );

      if (verificationResult['valid'] == true) {
        final visit = await Provider.of<VisitProvider>(context, listen: false)
            .fetchVisitByID(widget.visitID);

        final agent = await Provider.of<AgentProvider>(context, listen: false)
            .fetchAgentById(visit.agentID!);

        final checklist = await Provider.of<ChecklistProvider>(context, listen: false)
            .getChecklistByVisit(widget.visitID);

        final reasons = await Provider.of<ReasonProvider>(context, listen: false)
            .getReasonsByVisit(widget.visitID);

        setState(() {
          _visit = visit;
          _agent = agent;
          _checklistItems = checklist;
          _reasonItems = reasons;
          _isAgentVerified = true;
          Provider.of<VisitProvider>(context, listen: false).startVisitTimer();
        });
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(verificationResult['message'])),
        );
      }
    } catch (error) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Verification error: $error')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final visitProvider = Provider.of<VisitProvider>(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Log Visit')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: !_isAgentVerified
            ? _buildVerificationSection()
            : _buildVisitLoggingSection(visitProvider),
      ),
    );
  }

  Widget _buildVerificationSection() {
    return Column(
      children: [
        TextField(
          controller: _manualInputController,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(labelText: 'Agent Phone'),
        ),
        ElevatedButton(
          onPressed: () async {
            final manualInput = _manualInputController.text.trim();
            String? scannedData;

            if (manualInput.isNotEmpty) {
              scannedData = formatPhoneAsTLV(manualInput);
            } else {
              scannedData = await Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => QRScannerWidget()),
              );
            }

            if (scannedData != null) {
              await _verifyAgent(scannedData);
            }
          },
          child: const Text('Verify Agent'),
        ),
      ],
    );
  }

  Widget _buildVisitLoggingSection(VisitProvider visitProvider) {
    return Column(
      children: [
        Text('Agent: ${_agent?.name ?? ''} ${_agent?.lastname ?? ''}'),
        Text('Phone: ${_agent?.phone ?? ''}'),

        _buildChecklistSection(),
        _buildReasonsSection(),

        ElevatedButton(
          onPressed: () async {
            try {
              final duration = visitProvider.getElapsedTime()?.inMinutes ?? 0;

              await visitProvider.logVisit(
                visitID: widget.visitID,
                logData: {
                  'duration': duration.toString(),
                  'checklistUpdates': visitProvider.checklistStatus,
                  'selectedReasons': visitProvider.selectedReasons
                      .map((r) => r.reasonID)
                      .toList(),
                },
              );

              Navigator.pop(context);
            } catch (e) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Error: $e')),
              );
            }
          },
          child: const Text('Complete Visit'),
        ),
      ],
    );
  }

  Widget _buildChecklistSection() {
    return Column(
      children: [
        const Text('Checklist'),
        ..._checklistItems.map((item) {
          return CheckboxListTile(
            title: Text(item.item as String),
            value: Provider.of<VisitProvider>(context, listen: false)
                .checklistStatus[item.checklistID] ?? false,
            onChanged: (value) {
              Provider.of<VisitProvider>(context, listen: false)
                  .updateChecklistStatus(
                item.item as String,
                value ?? false,
              );
            },
          );
        }).toList(),
      ],
    );
  }

  Widget _buildReasonsSection() {
    return Column(
      children: [
        const Text('Reasons'),
        Wrap(
          children: _reasonItems.map((reason) {
            final isSelected = Provider.of<VisitProvider>(context, listen: false)
                .selectedReasons
                .any((r) => r.reasonID == reason.reasonID);

            return FilterChip(
              label: Text(reason.item as String),
              selected: isSelected,
              onSelected: (selected) {
                Provider.of<VisitProvider>(context, listen: false)
                    .setSelectedReasons(
                  selected
                      ? [...Provider.of<VisitProvider>(context, listen: false).selectedReasons, reason]
                      : Provider.of<VisitProvider>(context, listen: false).selectedReasons
                      .where((r) => r.reasonID != reason.reasonID)
                      .toList(),
                );
              },
            );
          }).toList(),
        ),
      ],
    );
  }
}