// lib/screens/Visit/visit_details.dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../models/visit.dart';
import '../../providers/auth_provider.dart';
import '../../providers/visit_provider.dart';
import '../../providers/checklist_provider.dart';
import '../../providers/reason_provider.dart';
import '../../widgets/Glass_Effect/GlassChip.dart';
import '../../widgets/Glass_Effect/GlassStatusChip.dart';
import '../Error.dart';
import 'log_visit_screen.dart'; // Assuming this will be created later

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
    _fetchVisitDetails();
  }

  void _fetchVisitDetails() {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final visitProvider = Provider.of<VisitProvider>(context, listen: false);
    final checklistProvider = Provider.of<ChecklistProvider>(context, listen: false);
    final reasonProvider = Provider.of<ReasonProvider>(context, listen: false);
    if (authProvider.token != null) {
      visitProvider.fetchVisitById(widget.visit.visitID!, authProvider.token!).catchError(_showError);
      checklistProvider
          .getChecklistsByVisitId(widget.visit.visitID!, authProvider.token!)
          .catchError(_showError);
      reasonProvider.getReasonsByVisitId(widget.visit.visitID!, authProvider.token!).catchError(_showError);
    }
  }

  void _showError(dynamic error) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ErrorPage(errorMessage: 'Error: $error', onRetry: _fetchVisitDetails),
      ),
    );
  }

  void _editVisit() {
    // Placeholder for edit functionality - to be implemented in a separate screen
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Edit functionality to be implemented')),
    );
  }

  void _deleteVisit() {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final visitProvider = Provider.of<VisitProvider>(context, listen: false);
    if (authProvider.token != null) {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text('Confirm Deletion'),
          content: Text('Are you sure you want to delete this visit?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text('Cancel'),
            ),
            TextButton(
              onPressed: () {
                visitProvider
                    .deleteVisit(widget.visit.visitID!, authProvider.token!)
                    .then((_) {
                  Navigator.pop(context); // Close dialog
                  Navigator.pop(context); // Back to previous screen
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Visit deleted successfully')),
                  );
                }).catchError(_showError);
              },
              child: Text('Delete', style: TextStyle(color: Colors.red)),
            ),
          ],
        ),
      );
    }
  }

  void _logVisit() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => LogVisitScreen(
          visitID: widget.visit.visitID!,
          weekNumber: _getWeekNumber(widget.visit.date!),
          year: widget.visit.date!.year,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final visitProvider = Provider.of<VisitProvider>(context);
    final checklistProvider = Provider.of<ChecklistProvider>(context);
    final reasonProvider = Provider.of<ReasonProvider>(context);
    final visit = visitProvider.currentVisit ?? widget.visit;

    return Scaffold(
      appBar: AppBar(
        title: Text('Visit Details'),
        flexibleSpace: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [Theme.of(context).colorScheme.primary, Theme.of(context).colorScheme.secondary],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: visitProvider.isLoading || checklistProvider.isLoading || reasonProvider.isLoading
            ? Center(child: CircularProgressIndicator())
            : SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildGlassCard(
                context,
                title: 'Visit Information',
                icon: Icons.info,
                content: [
                  _buildDetailRow(
                    context,
                    'Date:',
                    visit.date != null ? DateFormat('yyyy-MM-dd').format(visit.date!) : 'N/A',
                  ),
                  _buildDetailRow(context, 'Time:', visit.time ?? 'N/A'),
                  _buildDetailRow(context, 'Location:', visit.location ?? 'N/A'),
                  _buildDetailRow(context, 'Duration:', visit.duration != null ? '${visit.duration} min' : 'N/A'),
                  _buildDetailRow(
                    context,
                    'Status:',
                    visit.status ?? 'Unknown',
                    statusColor: _getStatusColor(context, visit.status),
                  ),
                  _buildDetailRow(context, 'Agent ID:', visit.agentID ?? 'N/A'),
                  _buildDetailRow(context, 'Comment:', visit.comment ?? 'N/A'),
                ],
              ),
              const SizedBox(height: 16),
              _buildGlassCard(
                context,
                title: 'Checklists',
                icon: Icons.checklist,
                content: checklistProvider.checklists.isEmpty
                    ? [Text('No checklists available')]
                    : checklistProvider.checklists
                    .map((c) => _buildChecklistRow(context, c.item ?? '', c.visitChecklist?.checked ?? false))
                    .toList(),
              ),
              const SizedBox(height: 16),
              _buildGlassCard(
                context,
                title: 'Reasons',
                icon: Icons.question_answer,
                content: reasonProvider.reasons.isEmpty
                    ? [Text('No reasons available')]
                    : reasonProvider.reasons.map((r) => GlassChip(label: r.item ?? 'N/A')).toList(),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildActionButton(
                    context,
                    icon: Icons.edit,
                    label: 'Edit',
                    onPressed: _editVisit,
                  ),
                  _buildActionButton(
                    context,
                    icon: Icons.delete,
                    label: 'Delete',
                    onPressed: _deleteVisit,
                    gradientColors: [Colors.red, Colors.redAccent],
                  ),
                  if (visit.status == 'pending')
                    _buildActionButton(
                      context,
                      icon: Icons.qr_code_scanner,
                      label: 'Log Visit',
                      onPressed: _logVisit,
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildGlassCard(
      BuildContext context, {
        required String title,
        required IconData icon,
        required List<Widget> content,
      }) {
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
      child: Padding(
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
      ),
    );
  }

  Widget _buildDetailRow(
      BuildContext context,
      String label,
      String value, {
        Color? statusColor,
      }) {
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
          Expanded(
            child: Text(item, style: Theme.of(context).textTheme.bodyMedium),
          ),
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
          gradient: LinearGradient(
            colors: colors,
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: colors[0].withOpacity(0.4),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
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

  Color? _getStatusColor(BuildContext context, String? status) {
    switch (status?.toLowerCase()) {
      case 'visited':
        return Colors.lightBlue;
      case 'pending':
      case 'rejected':
        return Colors.red;
      case 'validated':
        return Colors.pink;
      default:
        return Theme.of(context).colorScheme.onSurface.withOpacity(0.6);
    }
  }

  int _getWeekNumber(DateTime date) {
    final startOfYear = DateTime(date.year, 1, 1);
    return (date.difference(startOfYear).inDays / 7).ceil();
  }
}