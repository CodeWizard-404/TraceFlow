import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../models/visit.dart';
import '../../providers/visit_provider.dart';
import '../../providers/agent_provider.dart';
import '../../providers/checklist_provider.dart';
import '../../providers/timesheet_provider.dart';
import '../../widgets/appbar/app_bar.dart';
import '../../widgets/appbar/sidebar.dart';
import '../../widgets/commen/button.dart';
import '../../widgets/commen/spacer.dart';
import '../../utils/constants.dart';
import 'edit_visit.dart';
import 'log_visit_screen.dart';

class VisitDetailsScreen extends StatefulWidget {
  final Visit visit;

  const VisitDetailsScreen({super.key, required this.visit});

  @override
  _VisitDetailsScreenState createState() => _VisitDetailsScreenState();
}

class _VisitDetailsScreenState extends State<VisitDetailsScreen> {
  @override
  void initState() {
    super.initState();
    // Fetch the associated Timesheet when the screen loads
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final timesheetProvider = Provider.of<TimesheetProvider>(
        context,
        listen: false,
      );
      timesheetProvider.fetchTimesheetById(widget.visit.timesheetID).catchError(
        (e) {
          if (kDebugMode) print('Failed to fetch timesheet: $e');
        },
      );
    });
  }

  void _navigateToEdit(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => EditVisitScreen(visit: widget.visit)),
    );
  }

  void _navigateToLog(BuildContext context) {
    final timesheetProvider = Provider.of<TimesheetProvider>(
      context,
      listen: false,
    );
    Navigator.push(
      context,
      MaterialPageRoute(
        builder:
            (_) => LogVisitScreen(
              visitID: widget.visit.visitID!,
              weekNumber: timesheetProvider.currentTimesheet?.weekNumber ?? 1,
              year: widget.visit.date.year,
            ),
      ),
    );
  }

  void _viewPhotoFullScreen(BuildContext context, String photoPath) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder:
            (_) => Scaffold(
              appBar: CustomAppBar(title: 'Photo View', showBackButton: true),
              body: Center(
                child: Image.network(
                  photoPath.startsWith('http')
                      ? photoPath
                      : '$baseUrl$photoPath',
                  fit: BoxFit.contain,
                  errorBuilder:
                      (context, error, stackTrace) => const Icon(
                        Icons.error,
                        color: Colors.white,
                        size: 50,
                      ),
                ),
              ),
              backgroundColor: Colors.black,
            ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: CustomAppBar(title: 'Visit Details', showBackButton: true),
      drawer: const AppSidebar(),
      body: Consumer4<
        VisitProvider,
        AgentProvider,
        ChecklistProvider,
        TimesheetProvider
      >(
        builder: (
          context,
          visitProvider,
          agentProvider,
          checklistProvider,
          timesheetProvider,
          child,
        ) {
          final agent = agentProvider.currentAgent;
          final checklists = checklistProvider.checklists;

          return Padding(
            padding: const EdgeInsets.all(16.0),
            child: ListView(
              children: [
                _buildSectionCard(
                  context,
                  title: 'Visit Information',
                  children: [
                    _buildDetailRow(
                      context,
                      'Date',
                      DateFormat('yyyy-MM-dd').format(widget.visit.date),
                    ),
                    _buildDetailRow(context, 'Time', widget.visit.time),
                    _buildDetailRow(
                      context,
                      'Location',
                      widget.visit.location ?? 'N/A',
                    ),
                    _buildDetailRow(
                      context,
                      'Status',
                      widget.visit.status.toUpperCase() ?? 'N/A',
                    ),
                    if (widget.visit.duration != null)
                      _buildDetailRow(
                        context,
                        'Duration',
                        '${widget.visit.duration} minutes',
                      ),
                  ],
                ),
                const CustomSpacer(height: 16),
                _buildSectionCard(
                  context,
                  title: 'Agent',
                  children: [
                    _buildDetailRow(
                      context,
                      'Name',
                      agent != null
                          ? '${agent.name} ${agent.lastname}'
                          : 'Loading...',
                    ),
                    _buildDetailRow(
                      context,
                      'ID',
                      widget.visit.agentID ?? 'N/A',
                    ),
                  ],
                ),
                const CustomSpacer(height: 16),
                _buildSectionCard(
                  context,
                  title: 'Reasons',
                  children:
                      widget.visit.reasons?.isNotEmpty ?? false
                          ? widget.visit.reasons!
                              .map(
                                (reason) => _buildDetailRow(
                                  context,
                                  'Reason',
                                  reason.item,
                                ),
                              )
                              .toList()
                          : [
                            Text(
                              'No reasons specified',
                              style: theme.textTheme.bodyMedium,
                            ),
                          ],
                ),
                const CustomSpacer(height: 16),
                _buildSectionCard(
                  context,
                  title: 'Checklists',
                  children:
                      checklists.isNotEmpty
                          ? checklists
                              .map(
                                (checklist) => _buildDetailRow(
                                  context,
                                  checklist.item,
                                  checklist.visitChecklist?.checked == true
                                      ? 'Completed'
                                      : 'Not Completed',
                                ),
                              )
                              .toList()
                          : [
                            Text(
                              'No checklists assigned',
                              style: theme.textTheme.bodyMedium,
                            ),
                          ],
                ),
                if (widget.visit.photos?.isNotEmpty ?? false) ...[
                  const CustomSpacer(height: 16),
                  _buildSectionCard(
                    context,
                    title: 'Photos',
                    children: [
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children:
                            widget.visit.photos!
                                .map(
                                  (photo) => GestureDetector(
                                    onTap:
                                        () => _viewPhotoFullScreen(
                                          context,
                                          photo,
                                        ),
                                    child: Image.network(
                                      photo.startsWith('http')
                                          ? photo
                                          : '$baseUrl$photo',
                                      width: 100,
                                      height: 100,
                                      fit: BoxFit.cover,
                                      errorBuilder:
                                          (_, __, ___) => const Icon(
                                            Icons.error,
                                            size: 100,
                                          ),
                                    ),
                                  ),
                                )
                                .toList(),
                      ),
                    ],
                  ),
                ],
                if (widget.visit.comment?.isNotEmpty ?? false) ...[
                  const CustomSpacer(height: 16),
                  _buildSectionCard(
                    context,
                    title: 'Comment',
                    children: [
                      Text(
                        widget.visit.comment!,
                        style: theme.textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ],
                const CustomSpacer(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CustomButton(
                      label:
                          widget.visit.status == 'visited'
                              ? 'Review Visit'
                              : 'Edit Visit',
                      onPressed: () => _navigateToEdit(context),
                    ),
                    if (widget.visit.status == 'pending') ...[
                      const CustomSpacer(width: 8),
                      CustomButton(
                        label: 'Log Visit',
                        onPressed: () => _navigateToLog(context),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildSectionCard(
    BuildContext context, {
    required String title,
    required List<Widget> children,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Text(
              title,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Column(children: children),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(BuildContext context, String label, String value) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          Flexible(
            child: Text(
              value,
              style: theme.textTheme.bodyMedium,
              textAlign: TextAlign.end,
            ),
          ),
        ],
      ),
    );
  }
}
