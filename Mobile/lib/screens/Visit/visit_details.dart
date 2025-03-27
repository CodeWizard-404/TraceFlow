// lib/screens/Visit/visit_details.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/agent.dart';
import '../../models/visit.dart';
import '../../providers/auth_provider.dart';
import '../../providers/agent_provider.dart';
import '../../providers/visit_provider.dart';
import '../../widgets/qr_scanner_widget.dart';
import '../Error.dart';
import 'log_visit_screen.dart';
import '../../utils/helpers.dart';

class VisitDetailsScreen extends StatelessWidget {
  final Visit visit;

  const VisitDetailsScreen({required this.visit, super.key});

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final agentProvider = Provider.of<AgentProvider>(context, listen: false);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: CustomScrollView(
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
                                    visit.date != null
                                        ? '${visit.date!.day}/${visit.date!.month}/${visit.date!.year} - ${visit.time ?? 'N/A'}'
                                        : 'N/A',
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
                FutureBuilder<Agent>(
                  future: authProvider.token != null
                      ? agentProvider.fetchAgentById(visit.agentID!, authProvider.token!)
                      : Future.error('No token'),
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator());
                    }
                    if (snapshot.hasError) {
                      return _buildGlassCard(
                        context,
                        title: 'Agent Information',
                        icon: Icons.person,
                        content: [
                          Text(
                            'Error loading agent data: ${snapshot.error}',
                            style: TextStyle(color: Theme.of(context).colorScheme.error),
                          ),
                        ],
                      );
                    }
                    if (!snapshot.hasData) {
                      return _buildGlassCard(
                        context,
                        title: 'Agent Information',
                        icon: Icons.person,
                        content: [const Text('No agent data available')],
                      );
                    }

                    final agent = snapshot.data!;
                    return _buildGlassCard(
                      context,
                      title: 'Agent Information',
                      icon: Icons.person,
                      content: [
                        _buildDetailRow(context, 'Name:', '${agent.name ?? ''} ${agent.lastname ?? ''}'),
                        _buildDetailRow(context, 'Phone:', agent.phone ?? 'N/A'),
                        _buildDetailRow(
                          context,
                          'Status:',
                          visit.status ?? 'N/A',
                          statusColor: getStatusColor(context, visit.status),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 16),
                _buildGlassCard(
                  context,
                  title: 'Checklists',
                  icon: Icons.checklist,
                  content: [
                    if (visit.checklists == null || visit.checklists!.isEmpty)
                      Text(
                        'No checklists available',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                        ),
                      )
                    else
                      ...visit.checklists!.map(
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
                    if (visit.reasons == null || visit.reasons!.isEmpty)
                      Text(
                        'No reasons provided',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                        ),
                      )
                    else
                      ...visit.reasons!.map(
                            (reason) => _buildDetailRow(context, '•', reason.item ?? 'N/A'),
                      ),
                  ],
                ),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _buildActionButton(
                      context,
                      icon: Icons.edit,
                      label: 'Edit Visit',
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const ErrorPage(errorMessage: 'Edit functionality not implemented yet'),
                          ),
                        );
                      },
                    ),
                    _buildActionButton(
                      context,
                      icon: Icons.check_circle,
                      label: 'Log Visit',
                      gradientColors: [
                        Theme.of(context).colorScheme.secondary,
                        Theme.of(context).colorScheme.primary,
                      ],
                      onPressed: () async {
                        if (visit.date == null) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: const Text('Visit date is missing. Cannot log visit.'),
                              backgroundColor: Theme.of(context).colorScheme.error.withOpacity(0.9),
                            ),
                          );
                          return;
                        }
                        if (authProvider.token == null) {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const ErrorPage(errorMessage: 'Please log in first'),
                            ),
                          );
                          return;
                        }

                        final scannedData = await Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const QRScannerWidget()),
                        );

                        if (scannedData != null) {
                          final visitProvider = Provider.of<VisitProvider>(context, listen: false);
                          try {
                            final isValid = await visitProvider.verifyQRCode(
                              qrData: scannedData,
                              visitId: visit.visitID!,
                              token: authProvider.token!,
                            );
                            if (isValid) {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => LogVisitScreen(
                                    visitID: visit.visitID!,
                                    weekNumber: _getWeekNumber(visit.date!),
                                    year: visit.date!.year,
                                  ),
                                ),
                              );
                            } else {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Invalid QR code')),
                              );
                            }
                          } catch (e) {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => ErrorPage(errorMessage: 'Error verifying QR code: $e'),
                              ),
                            );
                          }
                        }
                      },
                    ),
                  ],
                ),
              ]),
            ),
          ),
        ],
      ),
    );
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
                  valueColor:
                  AlwaysStoppedAnimation<Color>(Theme.of(context).colorScheme.onPrimary.withOpacity(0.2)),
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
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: Theme.of(context).colorScheme.onPrimary,
            ),
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

  int _getWeekNumber(DateTime date) {
    final startOfYear = DateTime(date.year, 1, 1);
    return (date.difference(startOfYear).inDays / 7).ceil();
  }
}