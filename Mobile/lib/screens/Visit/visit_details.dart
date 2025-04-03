import 'package:TraceFlow/utils/constants.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/agent.dart';
import '../../models/visit.dart';
import '../../providers/auth_provider.dart';
import '../../providers/agent_provider.dart';
import '../../providers/visit_provider.dart';
import '../../providers/checklist_provider.dart';
import '../../providers/reason_provider.dart';
import '../../widgets/appbar/app_bar.dart';
import '../../widgets/appbar/sidebar.dart';
import '../../widgets/commen/button.dart';
import '../../widgets/commen/empty_state.dart';
import '../../widgets/commen/icon_button.dart';
import '../../widgets/commen/info_row.dart';
import '../../widgets/commen/progress_indicator.dart';
import '../../widgets/commen/spacer.dart';
import '../../widgets/qr_scanner/qr_scanner_widget.dart';
import '../Error.dart';
import 'log_visit_screen.dart';
import 'edit_visit.dart';

class VisitDetailsScreen extends StatefulWidget {
  final Visit visit;

  const VisitDetailsScreen({required this.visit, super.key});

  @override
  _VisitDetailsScreenState createState() => _VisitDetailsScreenState();
}

class _VisitDetailsScreenState extends State<VisitDetailsScreen> {
  Future<void> _fetchDataFuture = Future.value();

  @override
  void initState() {
    super.initState();
    _fetchDataFuture = _fetchVisitDetails();
  }

  Future<void> _fetchVisitDetails() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final visitProvider = Provider.of<VisitProvider>(context, listen: false);
    final checklistProvider = Provider.of<ChecklistProvider>(
      context,
      listen: false,
    );
    final reasonProvider = Provider.of<ReasonProvider>(context, listen: false);
    final agentProvider = Provider.of<AgentProvider>(context, listen: false);

    final token = authProvider.token;
    if (token == null) {
      throw Exception('No authentication token available. Please log in.');
    }

    await Future.wait([
      visitProvider.fetchVisitById(widget.visit.visitID!, token),
      checklistProvider.getChecklistsByVisitId(widget.visit.visitID!, token),
      reasonProvider.getReasonsByVisitId(widget.visit.visitID!, token),
      agentProvider.fetchAgentById(widget.visit.agentID, token),
    ]);

    if (mounted) setState(() {});
  }

  void _viewPhotoFullScreen(String photoPath) {
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
                      (context, error, stackTrace) =>
                          const Icon(Icons.error, size: 50),
                ),
              ),
              backgroundColor: Theme.of(context).scaffoldBackgroundColor,
            ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: CustomAppBar(title: 'Visit Details', showBackButton: true),
      drawer: const AppSidebar(), // Added your sidebar here
      body: RefreshIndicator(
        onRefresh: _fetchVisitDetails,
        child: FutureBuilder(
          future: _fetchDataFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const CustomProgressIndicator();
            }
            if (snapshot.hasError) {
              return ErrorPage(
                errorMessage: 'Failed to load visit details: ${snapshot.error}',
              );
            }

            return Consumer5<
              AuthProvider,
              VisitProvider,
              AgentProvider,
              ChecklistProvider,
              ReasonProvider
            >(
              builder: (
                context,
                authProvider,
                visitProvider,
                agentProvider,
                checklistProvider,
                reasonProvider,
                child,
              ) {
                final token = authProvider.token;
                if (token == null) {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    Navigator.pushReplacementNamed(context, '/login');
                  });
                  return const SizedBox();
                }

                final visit = visitProvider.currentVisit ?? widget.visit;
                final agent = agentProvider.currentAgent;
                final checklists = checklistProvider.checklists;
                final reasons = reasonProvider.reasons;

                return SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if ([
                          'pending',
                          'visited',
                          'validated',
                          'rejected',
                        ].contains(visit.status.toLowerCase()))
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              CustomIconButton(
                                icon: Icons.edit,
                                onPressed: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder:
                                          (_) => EditVisitScreen(visit: visit),
                                    ),
                                  );
                                },
                                size: 28,
                              ),
                              const CustomSpacer(width: 12),
                              CustomIconButton(
                                icon: Icons.delete,
                                onPressed:
                                    () => _deleteVisit(
                                      context,
                                      visit,
                                      visitProvider,
                                      token,
                                    ),
                                size: 28,
                              ),
                            ],
                          ),
                        const CustomSpacer(height: 16),
                        Card(
                          color: theme.cardTheme.color,
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      InfoRow(
                                        icon: Icons.location_on,
                                        text: visit.location ?? 'N/A',
                                      ),
                                      const CustomSpacer(height: 12),
                                      InfoRow(
                                        icon: Icons.access_time,
                                        text:
                                            '${visit.date.day}/${visit.date.month}/${visit.date.year} - ${visit.time}',
                                      ),
                                    ],
                                  ),
                                ),
                                if (visit.status == "visited")
                                  _buildDurationClock(
                                    context,
                                    visit.duration ?? 0,
                                  ),
                              ],
                            ),
                          ),
                        ),
                        const CustomSpacer(height: 16),
                        Card(
                          color: theme.cardTheme.color,
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildSectionHeader(
                                  context,
                                  'Agent Information',
                                  Icons.person,
                                ),
                                const CustomSpacer(height: 16),
                                if (agent == null)
                                  const EmptyState(
                                    text: 'No agent data available',
                                  )
                                else ...[
                                  InfoRow(
                                    icon: Icons.person,
                                    text: '${agent.name} ${agent.lastname}',
                                  ),
                                  const CustomSpacer(height: 8),
                                  InfoRow(
                                    icon: Icons.phone,
                                    text: agent.phone ?? 'N/A',
                                  ),
                                  const CustomSpacer(height: 8),
                                  Row(
                                    children: [
                                      Text(
                                        'Status:',
                                        style: theme.textTheme.bodyMedium,
                                      ),
                                      const CustomSpacer(width: 8),
                                      _buildStatusChip(context, visit.status),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                        const CustomSpacer(height: 16),
                        Card(
                          color: theme.cardTheme.color,
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildSectionHeader(
                                  context,
                                  'Checklists',
                                  Icons.checklist,
                                ),
                                const CustomSpacer(height: 16),
                                if (checklists.isEmpty)
                                  const EmptyState(
                                    text: 'No checklists available',
                                  )
                                else
                                  ...checklists.map(
                                    (checklist) => _buildChecklistRow(
                                      context,
                                      checklist.item ?? 'N/A',
                                      checklist.visitChecklist?.checked ??
                                          false,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                        const CustomSpacer(height: 16),
                        Card(
                          color: theme.cardTheme.color,
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildSectionHeader(
                                  context,
                                  'Reasons',
                                  Icons.notes,
                                ),
                                const CustomSpacer(height: 16),
                                if (reasons.isEmpty)
                                  const EmptyState(text: 'No reasons provided')
                                else
                                  ...reasons.map(
                                    (reason) => InfoRow(
                                      icon: Icons.circle,
                                      text: reason.item ?? 'N/A',
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                        if (visit.photos != null &&
                            visit.photos!.isNotEmpty) ...[
                          const CustomSpacer(height: 16),
                          Card(
                            color: theme.cardTheme.color,
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _buildSectionHeader(
                                    context,
                                    'Photos',
                                    Icons.photo,
                                  ),
                                  const CustomSpacer(height: 16),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    children:
                                        visit.photos!.map((photoPath) {
                                          return GestureDetector(
                                            onTap:
                                                () => _viewPhotoFullScreen(
                                                  photoPath,
                                                ),
                                            child: Image.network(
                                              photoPath.startsWith('http')
                                                  ? photoPath
                                                  : '$baseUrl$photoPath',
                                              width: 100,
                                              height: 100,
                                              fit: BoxFit.cover,
                                              errorBuilder:
                                                  (
                                                    context,
                                                    error,
                                                    stackTrace,
                                                  ) => const Icon(Icons.error),
                                            ),
                                          );
                                        }).toList(),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                        if (visit.status == 'visited' &&
                            visit.comment != null) ...[
                          const CustomSpacer(height: 16),
                          Card(
                            color: theme.cardTheme.color,
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _buildSectionHeader(
                                    context,
                                    'Comments',
                                    Icons.comment,
                                  ),
                                  const CustomSpacer(height: 16),
                                  Text(
                                    visit.comment ?? 'No comments provided',
                                    style: theme.textTheme.bodyMedium,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                        if (visit.status == 'validated') ...[
                          const CustomSpacer(height: 24),
                          Center(
                            child: SizedBox(
                              width: 360,
                              child: CustomButton(
                                label: 'Log Visit',
                                icon: Icons.check_circle,
                                onPressed:
                                    () => _logVisit(
                                      context,
                                      visit,
                                      visitProvider,
                                      token,
                                    ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }

  Future<void> _deleteVisit(
    BuildContext context,
    Visit visit,
    VisitProvider visitProvider,
    String token,
  ) async {
    final theme = Theme.of(context);
    final confirm = await showDialog<bool>(
      context: context,
      builder:
          (context) => AlertDialog(
            backgroundColor: theme.cardTheme.color,
            title: Text(
              'Confirm Deletion',
              style: theme.textTheme.headlineSmall,
            ),
            content: Text(
              'Are you sure you want to delete this visit?',
              style: theme.textTheme.bodyMedium,
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text(
                  'Cancel',
                  style: TextStyle(color: theme.colorScheme.primary),
                ),
              ),
              TextButton(
                onPressed: () => Navigator.pop(context, true),
                child: Text(
                  'Delete',
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              ),
            ],
          ),
    );

    if (confirm == true) {
      try {
        await visitProvider.deleteVisit(visit.visitID!, token);
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Visit deleted successfully',
              style: TextStyle(color: theme.colorScheme.onSurface),
            ),
            backgroundColor: theme.cardTheme.color,
          ),
        );
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Failed to delete visit: $e',
              style: TextStyle(color: theme.colorScheme.onSurface),
            ),
            backgroundColor: theme.colorScheme.error,
          ),
        );
      }
    }
  }

  Future<void> _logVisit(
    BuildContext context,
    Visit visit,
    VisitProvider visitProvider,
    String token,
  ) async {
    final theme = Theme.of(context);
    if (visit.date == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Visit date is missing. Cannot log visit.',
            style: TextStyle(color: theme.colorScheme.onSurface),
          ),
          backgroundColor: theme.colorScheme.error,
        ),
      );
      return;
    }

    final scannedData = await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => QRScannerWidget()),
    );
    if (scannedData != null) {
      try {
        final result = await visitProvider.verifyQRCode(
          visitId: visit.visitID!,
          qrData: scannedData,
          token: token,
        );
        if (result['valid'] == true) {
          final weekNumber = _getWeekNumber(visit.date);
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder:
                  (_) => LogVisitScreen(
                    visitID: visit.visitID!,
                    weekNumber: weekNumber,
                    year: visit.date.year,
                  ),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                result['message'] ?? 'Invalid QR code',
                style: TextStyle(color: theme.colorScheme.onSurface),
              ),
              backgroundColor: theme.colorScheme.error,
            ),
          );
        }
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Error verifying QR code: $e',
              style: TextStyle(color: theme.colorScheme.onSurface),
            ),
            backgroundColor: theme.colorScheme.error,
          ),
        );
      }
    }
  }

  int _getWeekNumber(DateTime date) {
    final firstDayOfYear = DateTime(date.year, 1, 1);
    final daysOffset = firstDayOfYear.weekday - 1;
    final firstMonday = firstDayOfYear.subtract(Duration(days: daysOffset));
    final daysSinceFirstMonday = date.difference(firstMonday).inDays;
    return (daysSinceFirstMonday / 7).ceil() + (daysOffset > 3 ? 1 : 0);
  }

  Widget _buildSectionHeader(
    BuildContext context,
    String title,
    IconData icon,
  ) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Icon(icon, color: theme.colorScheme.primary),
        const CustomSpacer(width: 12),
        Text(title, style: theme.textTheme.headlineSmall),
      ],
    );
  }

  Widget _buildChecklistRow(BuildContext context, String item, bool checked) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(
            checked ? Icons.check_circle : Icons.circle_outlined,
            color:
                checked
                    ? theme.colorScheme.primary
                    : theme.colorScheme.onSurface.withOpacity(0.6),
            size: 20,
          ),
          const CustomSpacer(width: 12),
          Expanded(child: Text(item, style: theme.textTheme.bodyMedium)),
        ],
      ),
    );
  }

  Widget _buildStatusChip(BuildContext context, String? status) {
    final theme = Theme.of(context);
    final statusData = _getStatusData(context, status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        border: Border.all(color: statusData['color'], width: 1.5),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        status ?? 'Unknown',
        style: TextStyle(
          fontSize: 14,
          color: statusData['color'],
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  Map<String, dynamic> _getStatusData(BuildContext context, String? status) {
    final theme = Theme.of(context);
    switch (status?.toLowerCase()) {
      case 'visited':
        return {'color': theme.colorScheme.primary};
      case 'pending':
        return {'color': Colors.orange};
      case 'rejected':
        return {'color': theme.colorScheme.error};
      case 'validated':
        return {'color': Colors.green};
      default:
        return {'color': theme.colorScheme.onSurface.withOpacity(0.7)};
    }
  }

  Widget _buildDurationClock(BuildContext context, int duration) {
    final theme = Theme.of(context);
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.timer, size: 30, color: theme.colorScheme.primary),
        const CustomSpacer(height: 8),
        Text(
          '$duration min',
          style: theme.textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.bold,
            color: theme.colorScheme.primary,
          ),
        ),
      ],
    );
  }
}
