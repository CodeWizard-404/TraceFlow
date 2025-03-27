// lib/screens/Visit/log_visit_screen.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/agent.dart';
import '../../models/checklist.dart';
import '../../models/reason.dart';
import '../../providers/auth_provider.dart';
import '../../providers/agent_provider.dart';
import '../../providers/checklist_provider.dart';
import '../../providers/reason_provider.dart';
import '../../providers/visit_provider.dart';
import '../../widgets/Glass_Effect/GlassChip.dart';
import '../../widgets/Glass_Effect/GlassContainer.dart';
import '../Error.dart';

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
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (authProvider.token == null) {
      _showError('Please log in first');
      return;
    }
    try {
      final visitProvider = Provider.of<VisitProvider>(context, listen: false);
      final visit = await visitProvider.fetchVisitById(
        widget.visitID,
        authProvider.token!,
      );
      final agent = await Provider.of<AgentProvider>(
        context,
        listen: false,
      ).fetchAgentById(visit.agentID!, authProvider.token!);
      final checklist = await Provider.of<ChecklistProvider>(
        context,
        listen: false,
      ).getChecklistsByVisitId(widget.visitID, authProvider.token!);
      final reasons = await Provider.of<ReasonProvider>(
        context,
        listen: false,
      ).getReasonsByVisitId(widget.visitID, authProvider.token!);

      setState(() {
        _agent = agent;
        _checklistItems = checklist;
        _reasonItems = reasons;
      });

      visitProvider.startVisitTimer();
    } catch (error) {
      _showError('Error loading visit data: $error');
    }
  }

  void _showError(String message) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder:
            (_) => ErrorPage(errorMessage: message, onRetry: _loadVisitData),
      ),
    );
  }

  Future<void> _completeVisit() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final visitProvider = Provider.of<VisitProvider>(context, listen: false);
    if (authProvider.token == null) {
      _showError('Please log in first');
      return;
    }

    try {
      final duration = visitProvider.getElapsedTimeInMinutes() ?? 0;
      final checklistUpdates =
          _checklistItems
              .where((item) => item.checklistID != null)
              .map(
                (item) => {
                  'checklistID': item.checklistID!,
                  'checked':
                      visitProvider.checklistStatus[item.checklistID] ?? false,
                },
              )
              .toList();

      await visitProvider.logVisit(
        visitId: widget.visitID,
        duration: duration,
        checklistUpdates: checklistUpdates,
        token: authProvider.token!,
      );

      if (mounted) {
        Navigator.pop(context);
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Visit logged successfully'),
            backgroundColor: Theme.of(context).colorScheme.primary,
          ),
        );
      }
    } catch (e) {
      _showError('Error logging visit: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final visitProvider = Provider.of<VisitProvider>(context);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 100,
            floating: true,
            pinned: true,
            leading: Padding(
              padding: const EdgeInsets.only(top: 19),
              child: IconButton(
                icon: Icon(
                  Icons.arrow_back_ios_rounded,
                  color: Theme.of(context).appBarTheme.iconTheme!.color,
                ),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
            title: Padding(
              padding: const EdgeInsets.only(top: 18),
              child: Text(
                'Log Visit',
                style: Theme.of(context).appBarTheme.titleTextStyle,
              ),
            ),
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Theme.of(context).colorScheme.primary,
                      Theme.of(context).colorScheme.secondary,
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(30),
                    bottomRight: Radius.circular(30),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Theme.of(
                        context,
                      ).colorScheme.onSurface.withOpacity(0.2),
                      blurRadius: 20,
                      offset: const Offset(0, 4),
                    ),
                  ],
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
                                color: Theme.of(
                                  context,
                                ).colorScheme.primary.withOpacity(0.1),
                              ),
                              child: Icon(
                                Icons.person,
                                color: Theme.of(context).colorScheme.primary,
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Text(
                              'Agent Information',
                              style: Theme.of(context).textTheme.headlineSmall,
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
                                color: Theme.of(
                                  context,
                                ).colorScheme.primary.withOpacity(0.1),
                              ),
                              child: Icon(
                                Icons.notes,
                                color: Theme.of(context).colorScheme.primary,
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Text(
                              'Visit Reasons',
                              style: Theme.of(context).textTheme.headlineSmall,
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        if (_reasonItems.isEmpty)
                          Text(
                            'No reasons provided',
                            style: Theme.of(
                              context,
                            ).textTheme.bodyMedium?.copyWith(
                              color: Theme.of(
                                context,
                              ).colorScheme.onSurface.withOpacity(0.6),
                            ),
                          )
                        else
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children:
                                _reasonItems
                                    .map(
                                      (reason) => GlassChip(
                                        label: reason.item ?? 'N/A',
                                      ),
                                    )
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
                                color: Theme.of(
                                  context,
                                ).colorScheme.primary.withOpacity(0.1),
                              ),
                              child: Icon(
                                Icons.checklist,
                                color: Theme.of(context).colorScheme.primary,
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Text(
                              'Checklist',
                              style: Theme.of(context).textTheme.headlineSmall,
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        ..._checklistItems.map((item) {
                          if (item.checklistID == null)
                            return const SizedBox.shrink();
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Row(
                              children: [
                                Checkbox(
                                  value:
                                      visitProvider.checklistStatus[item
                                          .checklistID] ??
                                      false,
                                  onChanged: (value) {
                                    visitProvider.updateChecklistStatus(
                                      item.checklistID!,
                                      value ?? false,
                                    );
                                  },
                                  activeColor:
                                      Theme.of(context).colorScheme.primary,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    item.item ?? 'N/A',
                                    style:
                                        Theme.of(context).textTheme.bodyMedium,
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
                      onTap: _completeVisit,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeInOut,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 32,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Theme.of(context).colorScheme.secondary,
                              Theme.of(context).colorScheme.primary,
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: Theme.of(
                                context,
                              ).colorScheme.secondary.withOpacity(0.4),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Text(
                          'Complete Visit',
                          style: Theme.of(
                            context,
                          ).textTheme.bodyMedium?.copyWith(
                            color: Theme.of(context).colorScheme.onPrimary,
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
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w500,
            color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(value, style: Theme.of(context).textTheme.bodyMedium),
        ),
      ],
    );
  }
}
