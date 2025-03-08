import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/agent.dart';
import '../../models/checklist.dart';
import '../../models/reason.dart';
import '../../providers/agent_provider.dart';
import '../../providers/checklist_provider.dart';
import '../../providers/reason_provider.dart';
import '../../providers/visit_provider.dart';
import '../../widgets/Glass_Effect/GlassChip.dart';
import '../../widgets/Glass_Effect/GlassContainer.dart';

class LogVisitScreen extends StatefulWidget {
  final String visitID;
  final int weekNumber;
  final int year;

  const LogVisitScreen({
    required this.visitID,
    required this.weekNumber,
    required this.year,
    super.key,
  });

  @override
  LogVisitScreenState createState() => LogVisitScreenState();
}

class LogVisitScreenState extends State<LogVisitScreen> {
  Agent? _agent;
  List<Checklist> _checklistItems = [];
  List<Reason> _reasonItems = [];

  @override
  void initState() {
    super.initState();
    _loadVisitData();
  }

  Future<void> _loadVisitData() async {
    try {
      final visitProvider = Provider.of<VisitProvider>(context, listen: false);
      final visit = await visitProvider.fetchVisitByID(widget.visitID);
      final agent = await Provider.of<AgentProvider>(context, listen: false)
          .fetchAgentById(visit.agentID!);
      final checklist = await Provider.of<ChecklistProvider>(context, listen: false)
          .getChecklistByVisit(widget.visitID);
      final reasons = await Provider.of<ReasonProvider>(context, listen: false)
          .getReasonsByVisit(widget.visitID);

      setState(() {
        _agent = agent;
        _checklistItems = checklist;
        _reasonItems = reasons;
      });

      visitProvider.startVisitTimer();
    } catch (error) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading visit data: $error')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final visitProvider = Provider.of<VisitProvider>(context);

    return Scaffold(
      backgroundColor: Colors.grey[50],
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 140,
            floating: true,
            pinned: true,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_ios_rounded, color: Colors.white),
              onPressed: () => Navigator.of(context).pop(),
            ),
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF4CB1C7), Color(0xFF64C9D1)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(30),
                    bottomRight: Radius.circular(30),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black26,
                      blurRadius: 20,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                child: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text(
                          'Log Visit',
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            shadows: [Shadow(color: Colors.black26, blurRadius: 4, offset: Offset(0, 2))],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                if (_agent == null)
                  const Center(child: CircularProgressIndicator())
                else ...[
                  GlassContainer(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: const Color(0xFF4CB1C7).withOpacity(0.1),
                              ),
                              child: const Icon(Icons.person, color: Color(0xFF4CB1C7), size: 20),
                            ),
                            const SizedBox(width: 12),
                            Text(
                              'Agent Information',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF4CB1C7),
                                shadows: const [Shadow(color: Colors.black12, blurRadius: 2)],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        _buildInfoRow(
                          'Name:',
                          '${_agent?.name ?? ''} ${_agent?.lastname ?? ''}',
                        ),
                        const SizedBox(height: 12),
                        _buildInfoRow('Phone:', _agent?.phone ?? 'N/A'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  GlassContainer(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: const Color(0xFF4CB1C7).withOpacity(0.1),
                              ),
                              child: const Icon(Icons.notes, color: Color(0xFF4CB1C7), size: 20),
                            ),
                            const SizedBox(width: 12),
                            Text(
                              'Visit Reasons',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF4CB1C7),
                                shadows: const [Shadow(color: Colors.black12, blurRadius: 2)],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        if (_reasonItems.isEmpty)
                          Text(
                            'No reasons provided',
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.grey[600],
                              fontWeight: FontWeight.w500,
                            ),
                          )
                        else
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: _reasonItems
                                .map((reason) => GlassChip(label: reason.item ?? 'N/A'))
                                .toList(),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  GlassContainer(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: const Color(0xFF4CB1C7).withOpacity(0.1),
                              ),
                              child: const Icon(Icons.checklist, color: Color(0xFF4CB1C7), size: 20),
                            ),
                            const SizedBox(width: 12),
                            Text(
                              'Checklist',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF4CB1C7),
                                shadows: const [Shadow(color: Colors.black12, blurRadius: 2)],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        ..._checklistItems.map((item) {
                          if (item.checklistID == null) return const SizedBox.shrink();
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Row(
                              children: [
                                Checkbox(
                                  value: visitProvider.checklistStatus[item.checklistID] ?? false,
                                  onChanged: (value) {
                                    visitProvider.updateChecklistStatus(
                                      item.checklistID!,
                                      value ?? false,
                                    );
                                  },
                                  activeColor: const Color(0xFF4CB1C7),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    item.item ?? 'N/A',
                                    style: const TextStyle(
                                      fontSize: 15,
                                      color: Colors.black87,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          );
                        }),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  Center(
                    child: GestureDetector(
                      onTap: () async {
                        try {
                          final duration = visitProvider.getElapsedTime()?.inMinutes ?? 0;
                          final checklistUpdates = _checklistItems
                              .where((item) => item.checklistID != null)
                              .map((item) => {
                            'checklistID': item.checklistID!,
                            'checked': visitProvider.checklistStatus[item.checklistID] ?? false,
                          })
                              .toList();

                          await visitProvider.logVisit(
                            visitID: widget.visitID,
                            logData: {
                              'duration': duration,
                              'checklistUpdates': checklistUpdates,
                            },
                            visitId: widget.visitID,
                            checklistUpdates: checklistUpdates,
                          );

                          if (mounted) {
                            Navigator.pop(context);
                            Navigator.pop(context);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Visit logged successfully'),
                                backgroundColor: Colors.green,
                              ),
                            );
                          }
                        } catch (e) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Error: $e')),
                          );
                        }
                      },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeInOut,
                        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFFE81F76), Color(0xFFF06292)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFE81F76).withOpacity(0.4),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: const Text(
                          'Complete Visit',
                          style: TextStyle(
                            fontSize: 16,
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w500,
            color: Colors.grey[700],
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              fontSize: 15,
              color: Colors.black87,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }
}