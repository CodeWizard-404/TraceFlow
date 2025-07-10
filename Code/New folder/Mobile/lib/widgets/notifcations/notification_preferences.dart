import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/notification_provider.dart';
import '../../providers/auth_provider.dart'; // Assume this exists
import '../../widgets/commen/card.dart';
import '../../widgets/commen/spacer.dart';
import '../../widgets/commen/button.dart';
import '../../models/notification_rule.dart';

class NotificationPreferences extends StatefulWidget {
  const NotificationPreferences({super.key});

  @override
  _NotificationPreferencesState createState() => _NotificationPreferencesState();
}

class _NotificationPreferencesState extends State<NotificationPreferences> {
  Map<String, Map<String, bool>> _updatedPreferences = {};
  Map<String, Map<String, bool>> _originalPreferences = {};
  bool _hasChanges = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final notificationProvider = Provider.of<NotificationProvider>(context, listen: false);
      notificationProvider.fetchPreferences().then((_) {
        if (mounted) {
          setState(() {
            _updatedPreferences = Map<String, Map<String, bool>>.from(
              notificationProvider.preferences.map(
                    (key, value) => MapEntry(
                  key,
                  Map<String, bool>.from(value),
                ),
              ),
            );
            _originalPreferences = Map<String, Map<String, bool>>.from(
              notificationProvider.preferences.map(
                    (key, value) => MapEntry(
                  key,
                  Map<String, bool>.from(value),
                ),
              ),
            );
          });
        }
      });
    });
  }

  void _checkForChanges() {
    final hasChanged = _updatedPreferences.entries.any((entry) {
      final event = entry.key;
      final channels = entry.value;
      final originalChannels = _originalPreferences[event] ?? {};
      return channels.entries.any((channelEntry) {
        return channelEntry.value != (originalChannels[channelEntry.key] ?? false);
      });
    });
    setState(() {
      _hasChanges = hasChanged;
    });
  }

  void _handlePreferenceChange(String event, String channel, bool? newValue, NotificationRule? rule) {
    if (rule?.priority == 'high') {
      if (kDebugMode) print('Blocked preference change for high-priority rule: $event, $channel');
      return;
    }
    setState(() {
      _updatedPreferences[event] = {
        ..._updatedPreferences[event] ?? {},
        channel: newValue ?? false,
      };
    });
    _checkForChanges();
  }

  Future<void> _refreshPreferences() async {
    final notificationProvider = Provider.of<NotificationProvider>(context, listen: false);
    try {
      await notificationProvider.fetchPreferences();
      if (mounted) {
        setState(() {
          _updatedPreferences = Map<String, Map<String, bool>>.from(
            notificationProvider.preferences.map(
                  (key, value) => MapEntry(
                key,
                Map<String, bool>.from(value),
              ),
            ),
          );
          _originalPreferences = Map<String, Map<String, bool>>.from(
            notificationProvider.preferences.map(
                  (key, value) => MapEntry(
                key,
                Map<String, bool>.from(value),
              ),
            ),
          );
          _hasChanges = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Preferences refreshed successfully')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to refresh preferences: $e'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }

  Future<void> _savePreferences() async {
    final notificationProvider = Provider.of<NotificationProvider>(context, listen: false);
    try {
      await notificationProvider.updatePreferences(_updatedPreferences);
      if (mounted) {
        setState(() {
          _originalPreferences = Map<String, Map<String, bool>>.from(
            _updatedPreferences.map(
                  (key, value) => MapEntry(
                key,
                Map<String, bool>.from(value),
              ),
            ),
          );
          _hasChanges = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Preferences saved successfully')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save preferences: $e'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }

  Future<void> _resetPreferences() async {
    final notificationProvider = Provider.of<NotificationProvider>(context, listen: false);
    try {
      final defaultPrefs = <String, Map<String, bool>>{};
      for (var rule in notificationProvider.rules) {
        defaultPrefs[rule.event] = {
          'email': rule.channels['email'] as bool? ?? false,
          'sms': rule.channels['sms'] as bool? ?? false,
          'inApp': rule.channels['inApp'] as bool? ?? false,
        };
      }
      setState(() {
        _updatedPreferences = defaultPrefs;
        _originalPreferences = Map<String, Map<String, bool>>.from(
          defaultPrefs.map(
                (key, value) => MapEntry(
              key,
              Map<String, bool>.from(value),
            ),
          ),
        );
        _hasChanges = false;
      });
      await notificationProvider.updatePreferences(defaultPrefs);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Preferences reset successfully')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to reset preferences: $e'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }

  void _cancelChanges() {
    setState(() {
      _updatedPreferences = Map<String, Map<String, bool>>.from(
        _originalPreferences.map(
              (key, value) => MapEntry(
            key,
            Map<String, bool>.from(value),
          ),
        ),
      );
      _hasChanges = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final notificationProvider = Provider.of<NotificationProvider>(context);

    // Group preferences by type
    final groupedPreferences = <String, List<Map<String, String>>>{};
    for (var type in notificationProvider.notificationTypes) {
      groupedPreferences[type] = [];
      for (var rule in notificationProvider.rules) {
        if (rule.type.toLowerCase() == type.toLowerCase()) {
          groupedPreferences[type]!.add({
            'value': rule.event,
            'label': rule.event.replaceFirst(rule.event[0], rule.event[0].toUpperCase()),
          });
        }
      }
    }
    groupedPreferences.removeWhere((key, value) => value.isEmpty);

    return CustomCard(
      title: 'Notification Preferences',
      child: notificationProvider.isLoading
          ? const Center(child: CircularProgressIndicator())
          : groupedPreferences.isEmpty
          ? const Center(child: Text('No preferences available'))
          : SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ...groupedPreferences.entries.map((entry) {
              final type = entry.key;
              final events = entry.value;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8.0, horizontal: 16.0),
                    child: Text(
                      type.replaceFirst(type[0], type[0].toUpperCase()),
                      style: theme.textTheme.titleMedium,
                    ),
                  ),
                  Table(
                    border: TableBorder.all(color: theme.dividerColor),
                    columnWidths: const {
                      0: FlexColumnWidth(2),
                      1: FlexColumnWidth(1),
                      2: FlexColumnWidth(1),
                      3: FlexColumnWidth(1),
                    },
                    children: [
                      TableRow(
                        decoration: BoxDecoration(color: theme.colorScheme.surfaceVariant),
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(8.0),
                            child: Text('Event', style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold)),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(8.0),
                            child: Text('Email', style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold), textAlign: TextAlign.center),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(8.0),
                            child: Text('SMS', style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold), textAlign: TextAlign.center),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(8.0),
                            child: Text('In-App', style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold), textAlign: TextAlign.center),
                          ),
                        ],
                      ),
                      ...events.map((event) {
                        final eventValue = event['value']!;
                        final eventLabel = event['label']!;
                        final rule = notificationProvider.rules.firstWhere(
                              (r) => r.event == eventValue,
                          orElse: () => NotificationRule(
                            ruleID: '',
                            event: eventValue,
                            type: type,
                            recipients: {},
                            channels: {'email': false, 'sms': false, 'inApp': false},
                            messageTemplate: '',
                            enabled: false,
                            priority: 'low',
                            createdAt: DateTime.now(),
                            updatedAt: DateTime.now(),
                          ),
                        );
                        final isHighPriority = rule.priority == 'high';
                        final prefs = _updatedPreferences[eventValue] ?? {'email': false, 'sms': false, 'inApp': false};
                        return TableRow(
                          children: [
                            Padding(
                              padding: const EdgeInsets.all(8.0),
                              child: Text(eventLabel, style: theme.textTheme.bodyMedium),
                            ),
                            TableCell(
                              child: Checkbox(
                                value: prefs['email'] ?? false,
                                onChanged: (value) => _handlePreferenceChange(eventValue, 'email', value, rule),
                                activeColor: isHighPriority ? theme.colorScheme.onSurface.withOpacity(0.5) : null,
                                checkColor: isHighPriority ? theme.colorScheme.onSurface.withOpacity(0.5) : null,
                              ),
                            ),
                            TableCell(
                              child: Checkbox(
                                value: prefs['sms'] ?? false,
                                onChanged: (value) => _handlePreferenceChange(eventValue, 'sms', value, rule),
                                activeColor: isHighPriority ? theme.colorScheme.onSurface.withOpacity(0.5) : null,
                                checkColor: isHighPriority ? theme.colorScheme.onSurface.withOpacity(0.5) : null,
                              ),
                            ),
                            TableCell(
                              child: Checkbox(
                                value: prefs['inApp'] ?? false,
                                onChanged: (value) => _handlePreferenceChange(eventValue, 'inApp', value, rule),
                                activeColor: isHighPriority ? theme.colorScheme.onSurface.withOpacity(0.5) : null,
                                checkColor: isHighPriority ? theme.colorScheme.onSurface.withOpacity(0.5) : null,
                              ),
                            ),
                          ],
                        );
                      }),
                    ],
                  ),
                  const CustomSpacer(height: 16),
                ],
              );
            }).toList(),
            const CustomSpacer(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Visibility(
                  visible: !_hasChanges,
                  child: CustomButton(
                    label: 'Refresh',
                    onPressed: _refreshPreferences,
                    isOutlined: true,
                  ),
                ),
                if (!_hasChanges) const CustomSpacer(width: 12),
                Visibility(
                  visible: !_hasChanges,
                  child: CustomButton(
                    label: 'Reset',
                    onPressed: _resetPreferences,
                    isOutlined: true,
                  ),
                ),
                if (_hasChanges) ...[
                  const CustomSpacer(width: 12),
                  CustomButton(
                    label: 'Cancel',
                    onPressed: _cancelChanges,
                    isOutlined: true,
                  ),
                  const CustomSpacer(width: 12),
                  CustomButton(
                    label: 'Save',
                    onPressed: _savePreferences,
                    isLoading: notificationProvider.isLoading,
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}