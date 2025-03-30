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
import '../../widgets/qr_scanner_widget.dart';
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
    final checklistProvider = Provider.of<ChecklistProvider>(context, listen: false);
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
  }

  void _viewPhotoFullScreen(String photoPath) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => Scaffold(
          appBar: AppBar(
            backgroundColor: Colors.black,
            leading: IconButton(
              icon: const Icon(Icons.close, color: Colors.white),
              onPressed: () => Navigator.pop(context),
            ),
          ),
          body: Center(
            child: Image.network(
              photoPath.startsWith('http') ? photoPath : '$baseUrl$photoPath',
              fit: BoxFit.contain,
              errorBuilder: (context, error, stackTrace) => const Icon(Icons.error, color: Colors.white, size: 50),
            ),
          ),
          backgroundColor: Colors.black,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    Future.microtask(() {
      debugPrint("Visit Details: ${widget.visit.toJson()}");
    });

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: FutureBuilder(
        future: _fetchDataFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return ErrorPage(errorMessage: 'Failed to load visit details: ${snapshot.error}');
          }

          return Consumer5<AuthProvider, VisitProvider, AgentProvider, ChecklistProvider, ReasonProvider>(
            builder: (context, authProvider, visitProvider, agentProvider, checklistProvider, reasonProvider, child) {
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

              return CustomScrollView(
                slivers: [
                  SliverAppBar(
                    expandedHeight: 200,
                    floating: true,
                    pinned: true,
                    leading: IconButton(
                      icon: Icon(
                        Icons.arrow_back_ios_rounded,
                        color: Theme.of(context).appBarTheme.iconTheme!.color,
                      ),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                    title: Text(
                      'Visit Details',
                      style: Theme.of(context).appBarTheme.titleTextStyle,
                    ),
                    actions: _buildAppBarActions(context, visit, visitProvider, token),
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
                          boxShadow: [
                            BoxShadow(
                              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.2),
                              blurRadius: 20,
                              offset: const Offset(0, 4),
                            ),
                          ],
                          borderRadius: const BorderRadius.only(
                            bottomLeft: Radius.circular(30),
                            bottomRight: Radius.circular(30),
                          ),
                        ),
                        child: SafeArea(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      const SizedBox(height: 16),
                                      Row(
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.all(6),
                                            decoration: BoxDecoration(
                                              shape: BoxShape.circle,
                                              color: Theme.of(context).colorScheme.onPrimary.withOpacity(0.2),
                                            ),
                                            child: Icon(
                                              Icons.location_on,
                                              color: Theme.of(context).appBarTheme.iconTheme!.color,
                                              size: 20,
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Text(
                                              visit.location ?? 'N/A',
                                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                                color: Theme.of(context).appBarTheme.iconTheme!.color,
                                                fontWeight: FontWeight.w500,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 12),
                                      Row(
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.all(6),
                                            decoration: BoxDecoration(
                                              shape: BoxShape.circle,
                                              color: Theme.of(context).colorScheme.onPrimary.withOpacity(0.2),
                                            ),
                                            child: Icon(
                                              Icons.access_time,
                                              color: Theme.of(context).appBarTheme.iconTheme!.color,
                                              size: 20,
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Text(
                                            '${visit.date.day}/${visit.date.month}/${visit.date.year} - ${visit.time}',
                                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                              color: Theme.of(context).appBarTheme.iconTheme!.color,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                                if (visit.status == "visited") _buildDurationClock(context, visit.duration ?? 0),
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
                        _buildGlassCard(
                          context,
                          title: 'Agent Information',
                          icon: Icons.person,
                          content: [
                            if (agent == null)
                              const Text('No agent data available')
                            else ...[
                              _buildDetailRow(context, 'Name:', '${agent.name} ${agent.lastname}'),
                              _buildDetailRow(context, 'Phone:', agent.phone ?? 'N/A'),
                              _buildDetailRow(
                                context,
                                'Status:',
                                visit.status,
                                statusColor: _getStatusColor(context, visit.status),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 16),
                        _buildGlassCard(
                          context,
                          title: 'Checklists',
                          icon: Icons.checklist,
                          content: [
                            if (checklists.isEmpty)
                              Text(
                                'No checklists available',
                                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                                ),
                              )
                            else
                              ...checklists.map(
                                    (checklist) => _buildChecklistRow(
                                  context,
                                  checklist.item ?? 'N/A',
                                  checklist.visitChecklist?.checked ?? false,
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        _buildGlassCard(
                          context,
                          title: 'Reasons',
                          icon: Icons.notes,
                          content: [
                            if (reasons.isEmpty)
                              Text(
                                'No reasons provided',
                                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                                ),
                              )
                            else
                              ...reasons.map(
                                    (reason) => _buildDetailRow(context, '•', reason.item ?? 'N/A'),
                              ),
                          ],
                        ),
                        if (visit.photos != null && visit.photos!.isNotEmpty) ...[
                          const SizedBox(height: 16),
                          _buildGlassCard(
                            context,
                            title: 'Photos',
                            icon: Icons.photo,
                            content: [
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: visit.photos!.map((photoPath) {
                                  return GestureDetector(
                                    onTap: () => _viewPhotoFullScreen(photoPath),
                                    child: Image.network(
                                      photoPath.startsWith('http') ? photoPath : '$baseUrl$photoPath',
                                      width: 100,
                                      height: 100,
                                      fit: BoxFit.cover,
                                      errorBuilder: (context, error, stackTrace) => const Icon(Icons.error),
                                    ),
                                  );
                                }).toList(),
                              ),
                            ],
                          ),
                        ],
                        if (visit.status == 'visited' && visit.comment != null) ...[
                          const SizedBox(height: 16),
                          _buildGlassCard(
                            context,
                            title: 'Comments',
                            icon: Icons.comment,
                            content: [
                              Text(
                                visit.comment ?? 'No comments provided',
                                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                                ),
                              ),
                            ],
                          ),
                        ],
                        if (visit.status == 'validated')
                          Padding(
                            padding: const EdgeInsets.only(top: 24),
                            child: _buildActionButton(
                              context,
                              icon: Icons.check_circle,
                              label: 'Log Visit',
                              gradientColors: [
                                Theme.of(context).colorScheme.secondary,
                                Theme.of(context).colorScheme.primary,
                              ],
                              onPressed: () => _logVisit(context, visit, visitProvider, token),
                            ),
                          ),
                      ]),
                    ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }

  List<Widget> _buildAppBarActions(BuildContext context, Visit visit, VisitProvider visitProvider, String token) {
    final actions = <Widget>[];
    final status = visit.status.toLowerCase();

    if (['pending', 'visited', 'validated', 'rejected'].contains(status)) {
      actions.add(
        IconButton(
          icon: const Icon(Icons.edit),
          onPressed: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => EditVisitScreen(visit: visit)),
            );
          },
        ),
      );
      actions.add(
        IconButton(
          icon: const Icon(Icons.delete, color: Colors.red),
          onPressed: () => _deleteVisit(context, visit, visitProvider, token),
        ),
      );
    }

    return actions;
  }

  Future<void> _deleteVisit(BuildContext context, Visit visit, VisitProvider visitProvider, String token) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm Deletion'),
        content: const Text('Are you sure you want to delete this visit?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await visitProvider.deleteVisit(visit.visitID!, token);
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Visit deleted successfully')),
        );
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to delete visit: $e')),
        );
      }
    }
  }

  Future<void> _logVisit(BuildContext context, Visit visit, VisitProvider visitProvider, String token) async {
    if (visit.date == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Visit date is missing. Cannot log visit.'),
          backgroundColor: Theme.of(context).colorScheme.error.withOpacity(0.9),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
      return;
    }

    final scannedData = await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => QRScannerWidget()),
    );

    if (scannedData != null) {
      final verificationResult = await visitProvider.verifyQRCode(
        qrData: scannedData,
        visitId: visit.visitID!,
        token: token,
      );

      if (verificationResult['valid'] == true) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => LogVisitScreen(
              visitID: visit.visitID!,
              weekNumber: _getWeekNumber(visit.date),
              year: visit.date.year,
            ),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(verificationResult['message'] ?? 'Invalid QR code'),
            backgroundColor: Theme.of(context).colorScheme.error.withOpacity(0.9),
          ),
        );
      }
    }
  }

  Widget _buildDurationClock(BuildContext context, int duration) {
    return Container(
      padding: const EdgeInsets.all(12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 60,
                height: 60,
                child: CircularProgressIndicator(
                  value: 1.0,
                  strokeWidth: 4,
                  valueColor: AlwaysStoppedAnimation<Color>(Theme.of(context).colorScheme.onPrimary.withOpacity(0.2)),
                ),
              ),
              Icon(
                Icons.timer,
                color: Theme.of(context).colorScheme.onPrimary,
                size: 28,
              ),
            ],
          ),
          Text(
            '$duration',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: Theme.of(context).colorScheme.onPrimary),
          ),
          Text(
            'min',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onPrimary.withOpacity(0.8),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGlassCard(BuildContext context, {required String title, required IconData icon, required List<Widget> content}) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Theme.of(context).colorScheme.surface.withOpacity(0.9),
            Theme.of(context).colorScheme.surface.withOpacity(0.7),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.primary.withOpacity(0.1),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Theme.of(context).colorScheme.primary.withOpacity(0.1),
                ),
                child: Icon(icon, color: Theme.of(context).colorScheme.primary, size: 20),
              ),
              const SizedBox(width: 12),
              Text(title, style: Theme.of(context).textTheme.headlineSmall),
            ],
          ),
          const SizedBox(height: 16),
          ...content,
        ],
      ),
    );
  }

  Widget _buildDetailRow(BuildContext context, String label, String value, {Color? statusColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: statusColor != null
                ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: LinearGradient(
                  colors: [statusColor.withOpacity(0.2), statusColor.withOpacity(0.1)],
                ),
                boxShadow: [
                  BoxShadow(
                    color: statusColor.withOpacity(0.2),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Text(
                value,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: statusColor,
                  fontWeight: FontWeight.bold,
                ),
              ),
            )
                : Text(value, style: Theme.of(context).textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }

  Widget _buildChecklistRow(BuildContext context, String item, bool isChecked) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isChecked
                  ? Theme.of(context).colorScheme.primary.withOpacity(0.1)
                  : Theme.of(context).colorScheme.onSurface.withOpacity(0.1),
            ),
            child: Icon(
              isChecked ? Icons.check_circle : Icons.radio_button_unchecked,
              color: isChecked ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.onSurface,
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(item, style: Theme.of(context).textTheme.bodyMedium)),
        ],
      ),
    );
  }

  Widget _buildActionButton(
      BuildContext context, {
        required IconData icon,
        required String label,
        required VoidCallback onPressed,
        List<Color> gradientColors = const [],
      }) {
    final colors = gradientColors.isNotEmpty
        ? gradientColors
        : [
      Theme.of(context).colorScheme.primary,
      Theme.of(context).colorScheme.secondary,
    ];
    return GestureDetector(
      onTap: onPressed,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        decoration: BoxDecoration(
          gradient: LinearGradient(colors: colors, begin: Alignment.topLeft, end: Alignment.bottomRight),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(color: colors[0].withOpacity(0.4), blurRadius: 12, offset: const Offset(0, 4)),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.onPrimary, size: 20),
            const SizedBox(width: 8),
            Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onPrimary,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color? _getStatusColor(BuildContext context, String status) {
    switch (status.toLowerCase()) {
      case 'visited':
        return Colors.green;
      case 'pending':
        return Colors.orange;
      case 'rejected':
        return Colors.red;
      case 'validated':
        return Colors.blue;
      default:
        return Theme.of(context).colorScheme.onSurface.withOpacity(0.6);
    }
  }

  int _getWeekNumber(DateTime date) {
    final utcDate = DateTime.utc(date.year, date.month, date.day);
    final dayOfWeek = utcDate.weekday % 7;
    final adjustedDate = utcDate.add(Duration(days: 4 - (dayOfWeek == 0 ? 7 : dayOfWeek)));
    final yearStart = DateTime.utc(adjustedDate.year, 1, 1);
    final diffMillis = adjustedDate.millisecondsSinceEpoch - yearStart.millisecondsSinceEpoch;
    final diffDays = diffMillis / 86400000;
    return ((diffDays + 1) / 7).ceil();
  }
}