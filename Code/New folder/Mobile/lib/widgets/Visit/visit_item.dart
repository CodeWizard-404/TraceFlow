import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../models/visit.dart';
import '../../providers/agent_provider.dart';
import '../../providers/timesheet_provider.dart';
import '../../screens/Visit/visit_details.dart';

class VisitItem extends StatelessWidget {
  final Visit visit;
  final bool isDraggable;
  final bool isSuggested;
  final Function(String)? onToggleSelection;

  const VisitItem({
    super.key,
    required this.visit,
    this.isDraggable = true,
    this.isSuggested = false,
    this.onToggleSelection,
  });

  bool get _canDrag {
    return isDraggable && visit.status?.toLowerCase() != 'visited';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final timeFormat = DateFormat('HH:mm');
    String formattedTime;
    try {
      formattedTime = timeFormat.format(DateTime.parse('2000-01-01 ${visit.time}:00'));
    } catch (e) {
      formattedTime = visit.time; // Fallback to raw time if parsing fails
      if (kDebugMode) print('Error parsing time: ${visit.time}, $e');
    }

    return Consumer2<AgentProvider, TimesheetProvider>(
      builder: (context, agentProvider, timesheetProvider, child) {
        final agent = visit.agent ?? agentProvider.currentAgent;
        final isSelected = isSuggested && timesheetProvider.selectedSuggestedVisitIds.contains(visit.visitID);

        Widget visitCard = Card(
          elevation: 0,
          margin: const EdgeInsets.symmetric(vertical: 3, horizontal: 6),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
            side: BorderSide(
              color: theme.colorScheme.primary.withOpacity(0.8),
              width: 1.2,
            ),
          ),
          color: isSuggested ? Colors.yellow.withOpacity(0.1) : theme.colorScheme.surface,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(8),
                splashColor: isSuggested ? Colors.transparent : theme.colorScheme.primary.withOpacity(0.2),
                highlightColor: isSuggested ? Colors.transparent : theme.colorScheme.primary.withOpacity(0.1),
                onTap: isSuggested
                    ? null
                    : () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => VisitDetailsScreen(visit: visit),
                    ),
                  );
                },
                child: Padding(
                  padding: const EdgeInsets.all(6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (isSuggested)
                        Padding(
                          padding: const EdgeInsets.only(top: 8.0, right: 8.0),
                          child: Checkbox(
                            value: isSelected,
                            onChanged: (value) {
                              if (onToggleSelection != null) {
                                onToggleSelection!(visit.visitID);
                              }
                            },
                          ),
                        )
                      else if (_canDrag)
                        const Padding(
                          padding: EdgeInsets.only(top: 8.0, right: 8.0),
                          child: Icon(
                            Icons.drag_handle_rounded,
                            color: Colors.grey,
                            size: 14,
                          ),
                        )
                      else
                        Padding(
                          padding: const EdgeInsets.only(top: 8.0, right: 8.0),
                          child: Icon(
                            Icons.person_outline,
                            color: theme.colorScheme.primary,
                            size: 14,
                          ),
                        ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    agent != null ? '${agent.name} ${agent.lastname}' : 'Agent: ${visit.agentID}',
                                    style: theme.textTheme.titleSmall?.copyWith(
                                      fontWeight: FontWeight.w700,
                                      color: theme.colorScheme.onSurface,
                                      fontSize: 14,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const SizedBox(width: 6),
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
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: _getStatusColor(context, visit.status),
                                      fontWeight: FontWeight.w600,
                                      fontSize: 10,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 4),
                                Icon(
                                  Icons.arrow_forward_ios,
                                  color: theme.colorScheme.onSurface.withOpacity(0.7),
                                  size: 10,
                                ),
                              ],
                            ),
                            const Divider(height: 6, thickness: 0.5, color: Colors.grey),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    Icon(
                                      Icons.calendar_today_outlined,
                                      color: theme.colorScheme.primary,
                                      size: 12,
                                    ),
                                    const SizedBox(width: 3),
                                    Text(
                                      DateFormat('MMM dd, yyyy').format(visit.date),
                                      style: theme.textTheme.bodySmall?.copyWith(
                                        color: theme.colorScheme.onSurface.withOpacity(0.9),
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ),
                                Row(
                                  children: [
                                    Icon(
                                      Icons.access_time_outlined,
                                      color: theme.colorScheme.primary,
                                      size: 12,
                                    ),
                                    const SizedBox(width: 3),
                                    Text(
                                      formattedTime,
                                      style: theme.textTheme.bodySmall?.copyWith(
                                        color: theme.colorScheme.onSurface.withOpacity(0.9),
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 3),
                            Row(
                              children: [
                                Icon(
                                  Icons.location_on_outlined,
                                  color: theme.colorScheme.primary,
                                  size: 12,
                                ),
                                const SizedBox(width: 3),
                                Expanded(
                                  child: Text(
                                    visit.location ?? 'N/A',
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: theme.colorScheme.onSurface.withOpacity(0.9),
                                      fontSize: 12,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                            if (visit.reasons != null && visit.reasons!.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Icon(
                                    Icons.list_alt_outlined,
                                    color: theme.colorScheme.primary,
                                    size: 12,
                                  ),
                                  const SizedBox(width: 3),
                                  Expanded(
                                    child: Wrap(
                                      spacing: 3,
                                      runSpacing: 3,
                                      children: visit.reasons!.map((reason) => Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: theme.colorScheme.onSurface.withOpacity(0.1),
                                          borderRadius: BorderRadius.circular(3),
                                          border: Border.all(
                                            color: theme.colorScheme.onSurface.withOpacity(0.4),
                                            width: 0.5,
                                          ),
                                        ),
                                        child: Text(
                                          reason.item ?? 'N/A',
                                          style: theme.textTheme.bodySmall?.copyWith(
                                            color: theme.colorScheme.onSurface,
                                            fontWeight: FontWeight.w600,
                                            fontSize: 10,
                                          ),
                                        ),
                                      )).toList(),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );

        if (!_canDrag) return visitCard;

        return LongPressDraggable<Visit>(
          data: visit,
          feedback: Material(
            elevation: 4,
            borderRadius: BorderRadius.circular(8),
            child: Opacity(
              opacity: 0.8,
              child: Container(
                width: MediaQuery.of(context).size.width - 32,
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: visitCard,
              ),
            ),
          ),
          childWhenDragging: Opacity(
            opacity: 0.3,
            child: visitCard,
          ),
          child: visitCard,
        );
      },
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
