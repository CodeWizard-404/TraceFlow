import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../models/visit.dart';
import '../../providers/visit_provider.dart';
import '../../providers/agent_provider.dart';
import '../../providers/checklist_provider.dart';
import '../../providers/timesheet_provider.dart';
import '../../widgets/appbar/sidebar.dart';
import '../../widgets/commen/button.dart';
import '../../widgets/commen/icon_button.dart';
import '../../widgets/commen/snack_bar.dar.dart';
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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final visitProvider = Provider.of<VisitProvider>(context, listen: false);
      visitProvider.fetchVisitById(widget.visit.visitID).catchError((e) {
        if (kDebugMode) print('Failed to fetch visit: $e');
      });
    });
  }

  void _navigateToEdit(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => EditVisitScreen(visit: widget.visit)),
    );
  }

  void _navigateToLog(BuildContext context) {
    final timesheetProvider = Provider.of<TimesheetProvider>(context, listen: false);
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => LogVisitScreen(
          visitID: widget.visit.visitID!,
          weekNumber: timesheetProvider.currentTimesheet?.weekNumber ?? 1,
          year: widget.visit.date.year,
        ),
      ),
    );
  }

  void _deleteVisit(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm Delete'),
        content: const Text('Are you sure you want to delete this visit?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final visitProvider = Provider.of<VisitProvider>(context, listen: false);
      try {
        await visitProvider.deleteVisit(widget.visit.visitID);
        Navigator.pop(context);
      } catch (e) {
        CustomSnackBar.show(
          context: context,
          message: 'Failed to delete visit: $e',
          backgroundColor: Colors.red,
        );
      }
    }
  }

  void _viewPhotoFullScreen(BuildContext context, String photoPath) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => Scaffold(
          appBar: AppBar(
            title: const Text('Photo View'),
            leading: IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () => Navigator.pop(context),
            ),
          ),
          body: Center(
            child: Image.network(
              photoPath.startsWith('http') ? photoPath : '$baseUrl$photoPath',
              fit: BoxFit.contain,
              errorBuilder: (context, error, stackTrace) => const Icon(
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
    final timeFormat = DateFormat('HH:mm');
    final formattedTime = timeFormat.format(DateTime.parse('2025-01-01 ${widget.visit.time}'));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Visit Details'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          CustomIconButton(
            icon: Icons.edit,
            onPressed: () => _navigateToEdit(context),
            size: 24,
          ),
          CustomIconButton(
            icon: Icons.delete,
            onPressed: () => _deleteVisit(context),
            size: 24,
          ),
        ],
      ),
      drawer: const AppSidebar(),
      body: Consumer4<VisitProvider, AgentProvider, ChecklistProvider, TimesheetProvider>(
        builder: (context, visitProvider, agentProvider, checklistProvider, timesheetProvider, child) {
          if (visitProvider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          if (visitProvider.errorMessage != null) {
            return Center(child: Text('Error: ${visitProvider.errorMessage}'));
          }

          final visit = visitProvider.currentVisit ?? widget.visit;
          final agent = visit.agent ?? agentProvider.currentAgent;

          return Padding(
            padding: const EdgeInsets.all(8.0),
            child: Column(
              children: [
                Expanded(
                  child: ListView(
                    children: [
                      _buildSectionCard(
                        context,
                        title: 'Visit Details',
                        children: [
                          _buildDetailRow(
                            context: context,
                            label: 'Date',
                            value: DateFormat('MMM dd, yyyy').format(visit.date),
                            icon: Icons.calendar_today_outlined,
                          ),
                          _buildDetailRow(
                            context: context,
                            label: 'Time',
                            value: formattedTime,
                            icon: Icons.access_time_outlined,
                          ),
                          _buildDetailRow(
                            context: context,
                            label: 'Location',
                            value: visit.location ?? 'N/A',
                            icon: Icons.location_on_outlined,
                          ),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  Icon(
                                    Icons.check_circle_outline,
                                    color: _getStatusColor(context, visit.status),
                                    size: 14,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Status',
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      fontWeight: FontWeight.bold,
                                      color: theme.colorScheme.onSurface,
                                    ),
                                  ),
                                ],
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                decoration: BoxDecoration(
                                  color: _getStatusColor(context, visit.status).withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(4),
                                  border: Border.all(
                                    color: _getStatusColor(context, visit.status).withOpacity(0.6),
                                    width: 1,
                                  ),
                                ),
                                child: Text(
                                  visit.status?.toUpperCase() ?? 'N/A',
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    color: _getStatusColor(context, visit.status),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          if (visit.duration != null)
                            _buildDetailRow(
                              context: context,
                              label: 'Duration',
                              value: '${visit.duration} minutes',
                              icon: Icons.timer_outlined,
                            ),
                        ],
                      ),
                      const CustomSpacer(height: 8),
                      _buildSectionCard(
                        context,
                        title: 'Agent',
                        children: [
                          _buildDetailRow(
                            context: context,
                            label: 'Name',
                            value: agent != null ? '${agent.name} ${agent.lastname}' : 'N/A',
                            icon: Icons.person_outline,
                          ),
                          _buildDetailRow(
                            context: context,
                            label: 'Phone',
                            value: agent?.phone ?? 'N/A',
                            icon: Icons.phone_outlined,
                          ),
                        ],
                      ),
                      const CustomSpacer(height: 8),
                      _buildSectionCard(
                        context,
                        title: 'Reasons',
                        children: visit.reasons?.isNotEmpty ?? false
                            ? visit.reasons!.map((reason) => _buildDetailRow(
                          context: context,
                          label: 'Reason',
                          value: reason.item,
                          icon: Icons.list_alt_outlined,
                        )).toList()
                            : [
                          Row(
                            children: [
                              Icon(
                                Icons.list_alt_outlined,
                                color: theme.colorScheme.primary,
                                size: 14,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'No reasons specified',
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: Colors.grey,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const CustomSpacer(height: 8),
                      _buildSectionCard(
                        context,
                        title: 'Checklists',
                        children: visit.checklists?.isNotEmpty ?? false
                            ? visit.checklists!.map((checklist) => Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  checklist.visitChecklist?.checked == true
                                      ? Icons.check_circle
                                      : Icons.circle_outlined,
                                  color: checklist.visitChecklist?.checked == true
                                      ? theme.colorScheme.primary
                                      : theme.colorScheme.onSurface.withOpacity(0.6),
                                  size: 14,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  checklist.item,
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    fontWeight: FontWeight.bold,
                                    color: theme.colorScheme.onSurface,
                                  ),
                                ),
                              ],
                            ),
                            Text(
                              checklist.visitChecklist?.checked == true ? 'Completed' : 'Not Completed',
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: theme.colorScheme.onSurface.withOpacity(0.9),
                              ),
                            ),
                          ],
                        )).toList()
                            : [
                          Row(
                            children: [
                              Icon(
                                Icons.check_circle_outline,
                                color: theme.colorScheme.primary,
                                size: 14,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'No checklists assigned',
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: Colors.grey,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      if (visit.photos?.isNotEmpty ?? false) ...[
                        const CustomSpacer(height: 8),
                        _buildSectionCard(
                          context,
                          title: 'Photos (${visit.photos!.length})',
                          children: [
                            Wrap(
                              spacing: 4,
                              runSpacing: 4,
                              children: visit.photos!.map((photo) => GestureDetector(
                                onTap: () => _viewPhotoFullScreen(context, photo),
                                child: Container(
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(4),
                                    border: Border.all(
                                      color: theme.colorScheme.onSurface.withOpacity(0.4),
                                      width: 0.5,
                                    ),
                                  ),
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(4),
                                    child: Image.network(
                                      photo.startsWith('http') ? photo : '$baseUrl$photo',
                                      width: 80,
                                      height: 80,
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => const Icon(
                                        Icons.error,
                                        size: 80,
                                      ),
                                    ),
                                  ),
                                ),
                              )).toList(),
                            ),
                          ],
                        ),
                      ],
                      if (visit.comment?.isNotEmpty ?? false) ...[
                        const CustomSpacer(height: 8),
                        _buildSectionCard(
                          context,
                          title: 'Comment',
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.comment_outlined,
                                  color: theme.colorScheme.primary,
                                  size: 14,
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    visit.comment!,
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      color: theme.colorScheme.onSurface.withOpacity(0.9),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                const CustomSpacer(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CustomButton(
                      label: 'Log Visit',
                      onPressed: () => _navigateToLog(context),
                      backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.8),
                      textColor: Colors.white,
                      isOutlined: false,
                    ),
                  ],
                ),
                const CustomSpacer(height: 16),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildSectionCard(BuildContext context, {required String title, required List<Widget> children}) {
    final theme = Theme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: theme.colorScheme.primary.withOpacity(0.8),
          width: 1.2,
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(8),
            splashColor: theme.colorScheme.primary.withOpacity(0.2),
            highlightColor: theme.colorScheme.primary.withOpacity(0.1),
            onTap: () {},
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 6, 8, 4),
                  child: Row(
                    children: [
                      Icon(
                        Icons.info_outline,
                        color: theme.colorScheme.primary,
                        size: 14,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        title,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: theme.colorScheme.primary,
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 6, thickness: 0.5, color: Colors.grey),
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
                  child: Column(children: children),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDetailRow({required BuildContext context, required String label, required String value, IconData? icon}) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              if (icon != null)
                Icon(
                  icon,
                  color: theme.colorScheme.primary,
                  size: 14,
                ),
              if (icon != null) const SizedBox(width: 4),
              Text(
                label,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: theme.colorScheme.onSurface,
                ),
              ),
            ],
          ),
          Flexible(
            child: Text(
              value,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurface.withOpacity(0.9),
              ),
              textAlign: TextAlign.end,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(BuildContext context, String? status) {
    switch (status?.toLowerCase()) {
      case 'visited':
        return Theme.of(context).colorScheme.primary;
      case 'pending':
        return const Color(0xFFF4B400);
      case 'rejected':
        return const Color(0xFFD93025);
      case 'validated':
        return const Color(0xFF2EA44F);
      default:
        return Theme.of(context).colorScheme.onSurface.withOpacity(0.6);
    }
  }
}