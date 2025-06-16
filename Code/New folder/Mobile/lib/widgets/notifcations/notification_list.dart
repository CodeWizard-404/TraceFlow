import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/notification.dart' as AppNotification;
import '../../providers/notification_provider.dart';
import '../../widgets/commen/card.dart';
import '../../widgets/commen/spacer.dart';
import '../../widgets/commen/button.dart';
import '../../widgets/commen/list_tile.dart';
import '../../widgets/commen/text_field.dart';
import '../commen/divider.dart';
import '../commen/snack_bar.dar.dart';

class NotificationList extends StatefulWidget {
  const NotificationList({super.key});

  @override
  _NotificationListState createState() => _NotificationListState();
}

class _NotificationListState extends State<NotificationList> {
  bool _showRead = false;
  String _searchQuery = '';
  List<String> _filterTypes = [];
  List<String> _filterEvents = [];
  List<String> _filterStatuses = [];
  String _startDate = '';
  String _endDate = '';
  String _sortBy = 'createdAt';
  String _sortOrder = 'desc';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      setState(() => _searchQuery = _searchController.text);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<NotificationProvider>(context, listen: false).fetchNotifications();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _refreshNotifications() async {
    final notificationProvider = Provider.of<NotificationProvider>(context, listen: false);
    try {
      await notificationProvider.fetchNotifications();
      if (mounted) {
        CustomSnackBar.show(context: context, message: 'Notifications refreshed');
      }
    } catch (e) {
      if (mounted) {
        CustomSnackBar.show(
          context: context,
          message: 'Failed to refresh notifications',
          backgroundColor: Theme.of(context).colorScheme.error,
        );
      }
    }
  }

  Future<void> _markAsRead(String notificationID) async {
    final notificationProvider = Provider.of<NotificationProvider>(context, listen: false);
    try {
      await notificationProvider.markNotificationAsRead(notificationID);
    } catch (e) {
      if (mounted) {
        CustomSnackBar.show(
          context: context,
          message: 'Failed to mark notification as read',
          backgroundColor: Theme.of(context).colorScheme.error,
        );
      }
    }
  }

  Future<void> _markAllAsRead() async {
    final notificationProvider = Provider.of<NotificationProvider>(context, listen: false);
    try {
      await notificationProvider.markAllNotificationsAsRead();
      if (mounted) {
        CustomSnackBar.show(context: context, message: 'All notifications marked as read');
      }
    } catch (e) {
      if (mounted) {
        CustomSnackBar.show(
          context: context,
          message: 'Failed to mark all notifications as read',
          backgroundColor: Theme.of(context).colorScheme.error,
        );
      }
    }
  }

  void _resetFilters() {
    setState(() {
      _searchQuery = '';
      _searchController.clear();
      _showRead = false;
      _filterTypes = [];
      _filterEvents = [];
      _filterStatuses = [];
      _startDate = '';
      _endDate = '';
      _sortBy = 'createdAt';
      _sortOrder = 'desc';
    });
  }

  void _applyFilters({
    required List<String> filterTypes,
    required List<String> filterEvents,
    required List<String> filterStatuses,
    required String startDate,
    required String endDate,
    required String sortBy,
    required String sortOrder,
  }) {
    setState(() {
      _filterTypes = filterTypes;
      _filterEvents = filterEvents;
      _filterStatuses = filterStatuses;
      _startDate = startDate;
      _endDate = endDate;
      _sortBy = sortBy;
      _sortOrder = sortOrder;
    });
  }

  List<String> _getAvailableEventActions(List<AppNotification.Notification> notifications) {
    final actions = <String>{};
    for (var notification in notifications) {
      final parts = notification.message.split(':');
      if (parts.length > 1) {
        actions.add(parts[1].toLowerCase());
      }
    }
    return actions.toList();
  }

  List<AppNotification.Notification> _filterAndSortNotifications(List<AppNotification.Notification> notifications) {
    return notifications
        .where((n) {
      final matchesSearch = n.message.toLowerCase().contains(_searchQuery.toLowerCase());
      final matchesRead = _showRead || n.status != 'read';
      final matchesType = _filterTypes.isEmpty || _filterTypes.contains(n.type);
      final matchesEvent = _filterEvents.isEmpty ||
          _filterEvents.any((action) {
            final eventAction = n.message.split(':').length > 1 ? n.message.split(':')[1].toLowerCase() : '';
            return eventAction == action.toLowerCase();
          });
      final matchesStatus = _filterStatuses.isEmpty || _filterStatuses.contains(n.status);
      final notificationDate = n.createdAt ?? DateTime.now();
      final matchesDate = (_startDate.isEmpty || notificationDate.isAfter(DateTime.parse(_startDate))) &&
          (_endDate.isEmpty || notificationDate.isBefore(DateTime.parse(_endDate).add(Duration(days: 1))));
      return matchesSearch && matchesRead && matchesType && matchesEvent && matchesStatus && matchesDate;
    })
        .toList()
      ..sort((a, b) {
        dynamic valueA, valueB;
        switch (_sortBy) {
          case 'createdAt':
            valueA = a.createdAt?.millisecondsSinceEpoch ?? 0;
            valueB = b.createdAt?.millisecondsSinceEpoch ?? 0;
            break;
          case 'type':
            valueA = a.type.toLowerCase();
            valueB = b.type.toLowerCase();
            break;
          case 'message':
            valueA = a.message.toLowerCase();
            valueB = b.message.toLowerCase();
            break;
        }
        return _sortOrder == 'asc' ? valueA.compareTo(valueB) : valueB.compareTo(valueA);
      });
  }

  void _showFilterSheet(BuildContext context, List<String> availableEventActions, List<String> notificationTypes) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => NotificationFilterSheet(
        typeOptions: notificationTypes.toSet(),
        eventOptions: availableEventActions.toSet(),
        statusOptions: {'pending', 'sent', 'read', 'failed'},
        initialFilters: {
          'type': _filterTypes.toSet(),
          'event': _filterEvents.toSet(),
          'status': _filterStatuses.toSet(),
        },
        initialStartDate: _startDate,
        initialEndDate: _endDate,
        initialSortBy: _sortBy,
        initialSortOrder: _sortOrder,
        onApply: (filters, startDate, endDate, sortBy, sortOrder) {
          _applyFilters(
            filterTypes: filters['type']!.toList(),
            filterEvents: filters['event']!.toList(),
            filterStatuses: filters['status']!.toList(),
            startDate: startDate,
            endDate: endDate,
            sortBy: sortBy,
            sortOrder: sortOrder,
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final notificationProvider = Provider.of<NotificationProvider>(context);
    final notifications = notificationProvider.notifications;
    final filteredNotifications = _filterAndSortNotifications(notifications);
    final availableEventActions = _getAvailableEventActions(notifications);

    return CustomCard(
      title: 'Notifications',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: CustomTextField(
                  label: 'Search notifications...',
                  controller: _searchController,
                ),
              ),
              const CustomSpacer(width: 12),
              IconButton(
                icon: Icon(
                  Icons.filter_alt_rounded,
                  color: theme.colorScheme.primary,
                ),
                onPressed: () => _showFilterSheet(context, availableEventActions, notificationProvider.notificationTypes),
                tooltip: 'Filter',
                style: IconButton.styleFrom(
                  backgroundColor: theme.colorScheme.background,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
              const CustomSpacer(width: 12),
              IconButton(
                icon: Icon(
                  _showRead ? Icons.visibility_off : Icons.visibility,
                  color: theme.colorScheme.primary,
                ),
                onPressed: () => setState(() => _showRead = !_showRead),
                tooltip: _showRead ? 'Hide Read' : 'Show All',
                style: IconButton.styleFrom(
                  backgroundColor: theme.colorScheme.background,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
              const CustomSpacer(width: 12),
              IconButton(
                icon: Icon(
                  Icons.refresh,
                  color: theme.colorScheme.primary,
                ),
                onPressed: notificationProvider.isLoading ? null : _refreshNotifications,
                tooltip: 'Refresh',
                style: IconButton.styleFrom(
                  backgroundColor: theme.colorScheme.background,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
              const CustomSpacer(width: 12),
              IconButton(
                icon: Icon(
                  Icons.mark_email_read,
                  color: theme.colorScheme.primary,
                ),
                onPressed: notificationProvider.isLoading ? null : _markAllAsRead,
                tooltip: 'Mark All Read',
                style: IconButton.styleFrom(
                  backgroundColor: theme.colorScheme.background,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ],
          ),
          const CustomSpacer(height: 16),
          if (notificationProvider.isLoading)
            Center(
              child: CircularProgressIndicator(color: theme.colorScheme.primary),
            )
          else if (notificationProvider.errorMessage != null)
            Text(
              notificationProvider.errorMessage!,
              style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.error),
            )
          else if (filteredNotifications.isEmpty)
              Text(
                'No notifications found',
                style: theme.textTheme.bodyMedium,
              )
            else
              Column(
                children: filteredNotifications
                    .asMap()
                    .entries
                    .map((entry) {
                  final notification = entry.value;
                  return Column(
                    children: [
                      CustomListTile(
                        title: notification.message,
                        subtitle:
                        '${notification.type} • ${notification.status} • ${notification.channel} • ${notification.createdAt?.toLocal().toString().split('.')[0] ?? 'N/A'}',
                        leadingIcon: Icons.notifications,
                        onTap: () => _markAsRead(notification.notificationID),
                      ),
                      if (entry.key < filteredNotifications.length - 1) const CustomDivider(),
                    ],
                  );
                })
                    .toList(),
              ),
        ],
      ),
    );
  }
}

class NotificationFilterSheet extends StatefulWidget {
  final Set<String> typeOptions;
  final Set<String> eventOptions;
  final Set<String> statusOptions;
  final Map<String, Set<String>> initialFilters;
  final String initialStartDate;
  final String initialEndDate;
  final String initialSortBy;
  final String initialSortOrder;
  final Function(Map<String, Set<String>>, String, String, String, String) onApply;

  const NotificationFilterSheet({
    required this.typeOptions,
    required this.eventOptions,
    required this.statusOptions,
    required this.initialFilters,
    required this.initialStartDate,
    required this.initialEndDate,
    required this.initialSortBy,
    required this.initialSortOrder,
    required this.onApply,
    super.key,
  });

  @override
  State<NotificationFilterSheet> createState() => _NotificationFilterSheetState();
}

class _NotificationFilterSheetState extends State<NotificationFilterSheet> {
  late Map<String, Set<String>> _filters;
  late String _startDate;
  late String _endDate;
  late String _sortBy;
  late String _sortOrder;

  @override
  void initState() {
    super.initState();
    _filters = Map.from(widget.initialFilters);
    _startDate = widget.initialStartDate;
    _endDate = widget.initialEndDate;
    _sortBy = widget.initialSortBy;
    _sortOrder = widget.initialSortOrder;
  }

  Widget _buildSectionCard(BuildContext context, {required String title, required List<Widget> children}) {
    final theme = Theme.of(context);
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: theme.colorScheme.primary.withOpacity(0.7),
          width: 1.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: Text(
              title,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: theme.colorScheme.primary,
              ),
            ),
          ),
          const Divider(height: 1, thickness: 1, color: Colors.grey),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(children: children),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildChips(Set<String> options, String key) {
    final theme = Theme.of(context);
    return options.map<Widget>((option) {
      final isSelected = _filters[key]!.contains(option);
      return GestureDetector(
        onTap: () => setState(() {
          if (isSelected) {
            _filters[key]!.remove(option);
          } else {
            _filters[key]!.add(option);
          }
        }),
        child: Chip(
          label: Text(
            option[0].toUpperCase() + option.substring(1),
            style: theme.textTheme.bodySmall?.copyWith(
              color: isSelected ? theme.colorScheme.primary : theme.colorScheme.onSurface,
            ),
          ),
          backgroundColor: isSelected
              ? theme.colorScheme.primary.withOpacity(0.2)
              : theme.colorScheme.background,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(
              color: isSelected
                  ? theme.colorScheme.primary
                  : theme.colorScheme.primary.withOpacity(0.7),
              width: 1,
            ),
          ),
        ),
      );
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: theme.colorScheme.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Filter Notifications',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
                color: theme.colorScheme.onSurface,
              ),
            ),
            const CustomSpacer(height: 16),
            _buildSectionCard(
              context,
              title: 'Type',
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _buildChips(widget.typeOptions, 'type'),
                ),
              ],
            ),
            const CustomSpacer(height: 8),
            _buildSectionCard(
              context,
              title: 'Event',
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _buildChips(widget.eventOptions, 'event'),
                ),
              ],
            ),
            const CustomSpacer(height: 8),
            _buildSectionCard(
              context,
              title: 'Status',
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _buildChips(widget.statusOptions, 'status'),
                ),
              ],
            ),
            const CustomSpacer(height: 8),
            _buildSectionCard(
              context,
              title: 'Date Range',
              children: [
                TextField(
                  decoration: InputDecoration(
                    labelText: 'Start Date',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  controller: TextEditingController(text: _startDate),
                  onTap: () async {
                    final date = await showDatePicker(
                      context: context,
                      initialDate: _startDate.isNotEmpty ? DateTime.parse(_startDate) : DateTime.now(),
                      firstDate: DateTime(2000),
                      lastDate: DateTime.now(),
                    );
                    if (date != null) setState(() => _startDate = date.toIso8601String().split('T')[0]);
                  },
                  readOnly: true,
                ),
                const CustomSpacer(height: 12),
                TextField(
                  decoration: InputDecoration(
                    labelText: 'End Date',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  controller: TextEditingController(text: _endDate),
                  onTap: () async {
                    final date = await showDatePicker(
                      context: context,
                      initialDate: _endDate.isNotEmpty ? DateTime.parse(_endDate) : DateTime.now(),
                      firstDate: DateTime(2000),
                      lastDate: DateTime.now(),
                    );
                    if (date != null) setState(() => _endDate = date.toIso8601String().split('T')[0]);
                  },
                  readOnly: true,
                ),
              ],
            ),
            const CustomSpacer(height: 8),
            _buildSectionCard(
              context,
              title: 'Sort',
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    GestureDetector(
                      onTap: () => setState(() {
                        _sortBy = 'createdAt';
                        _sortOrder = 'desc';
                      }),
                      child: Chip(
                        label: Text(
                          'Newest First',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: _sortBy == 'createdAt' && _sortOrder == 'desc'
                                ? theme.colorScheme.primary
                                : theme.colorScheme.onSurface,
                          ),
                        ),
                        backgroundColor: _sortBy == 'createdAt' && _sortOrder == 'desc'
                            ? theme.colorScheme.primary.withOpacity(0.2)
                            : theme.colorScheme.background,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(
                            color: _sortBy == 'createdAt' && _sortOrder == 'desc'
                                ? theme.colorScheme.primary
                                : theme.colorScheme.primary.withOpacity(0.7),
                            width: 1,
                          ),
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => setState(() {
                        _sortBy = 'createdAt';
                        _sortOrder = 'asc';
                      }),
                      child: Chip(
                        label: Text(
                          'Oldest First',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: _sortBy == 'createdAt' && _sortOrder == 'asc'
                                ? theme.colorScheme.primary
                                : theme.colorScheme.onSurface,
                          ),
                        ),
                        backgroundColor: _sortBy == 'createdAt' && _sortOrder == 'asc'
                            ? theme.colorScheme.primary.withOpacity(0.2)
                            : theme.colorScheme.background,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(
                            color: _sortBy == 'createdAt' && _sortOrder == 'asc'
                                ? theme.colorScheme.primary
                                : theme.colorScheme.primary.withOpacity(0.7),
                            width: 1,
                          ),
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => setState(() {
                        _sortBy = 'type';
                        _sortOrder = 'asc';
                      }),
                      child: Chip(
                        label: Text(
                          'Type (A-Z)',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: _sortBy == 'type' && _sortOrder == 'asc'
                                ? theme.colorScheme.primary
                                : theme.colorScheme.onSurface,
                          ),
                        ),
                        backgroundColor: _sortBy == 'type' && _sortOrder == 'asc'
                            ? theme.colorScheme.primary.withOpacity(0.2)
                            : theme.colorScheme.background,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(
                            color: _sortBy == 'type' && _sortOrder == 'asc'
                                ? theme.colorScheme.primary
                                : theme.colorScheme.primary.withOpacity(0.7),
                            width: 1,
                          ),
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => setState(() {
                        _sortBy = 'type';
                        _sortOrder = 'desc';
                      }),
                      child: Chip(
                        label: Text(
                          'Type (Z-A)',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: _sortBy == 'type' && _sortOrder == 'desc'
                                ? theme.colorScheme.primary
                                : theme.colorScheme.onSurface,
                          ),
                        ),
                        backgroundColor: _sortBy == 'type' && _sortOrder == 'desc'
                            ? theme.colorScheme.primary.withOpacity(0.2)
                            : theme.colorScheme.background,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(
                            color: _sortBy == 'type' && _sortOrder == 'desc'
                                ? theme.colorScheme.primary
                                : theme.colorScheme.primary.withOpacity(0.7),
                            width: 1,
                          ),
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => setState(() {
                        _sortBy = 'message';
                        _sortOrder = 'asc';
                      }),
                      child: Chip(
                        label: Text(
                          'Message (A-Z)',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: _sortBy == 'message' && _sortOrder == 'asc'
                                ? theme.colorScheme.primary
                                : theme.colorScheme.onSurface,
                          ),
                        ),
                        backgroundColor: _sortBy == 'message' && _sortOrder == 'asc'
                            ? theme.colorScheme.primary.withOpacity(0.2)
                            : theme.colorScheme.background,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(
                            color: _sortBy == 'message' && _sortOrder == 'asc'
                                ? theme.colorScheme.primary
                                : theme.colorScheme.primary.withOpacity(0.7),
                            width: 1,
                          ),
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => setState(() {
                        _sortBy = 'message';
                        _sortOrder = 'desc';
                      }),
                      child: Chip(
                        label: Text(
                          'Message (Z-A)',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: _sortBy == 'message' && _sortOrder == 'desc'
                                ? theme.colorScheme.primary
                                : theme.colorScheme.onSurface,
                          ),
                        ),
                        backgroundColor: _sortBy == 'message' && _sortOrder == 'desc'
                            ? theme.colorScheme.primary.withOpacity(0.2)
                            : theme.colorScheme.background,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(
                            color: _sortBy == 'message' && _sortOrder == 'desc'
                                ? theme.colorScheme.primary
                                : theme.colorScheme.primary.withOpacity(0.7),
                            width: 1,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const CustomSpacer(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                CustomButton(
                  label: 'Clear',
                  onPressed: () => setState(() {
                    _filters['type']!.clear();
                    _filters['event']!.clear();
                    _filters['status']!.clear();
                    _startDate = '';
                    _endDate = '';
                    _sortBy = 'createdAt';
                    _sortOrder = 'desc';
                  }),
                  isOutlined: true,
                  backgroundColor: theme.colorScheme.surface,
                  textColor: theme.colorScheme.onSurface,
                ),
                CustomButton(
                  label: 'Apply',
                  onPressed: () {
                    widget.onApply(_filters, _startDate, _endDate, _sortBy, _sortOrder);
                    Navigator.pop(context);
                  },
                  backgroundColor: theme.colorScheme.primary.withOpacity(0.8),
                  textColor: theme.colorScheme.primary,
                  isOutlined: true,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}