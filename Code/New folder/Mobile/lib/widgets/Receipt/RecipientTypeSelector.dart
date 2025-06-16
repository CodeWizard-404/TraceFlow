import 'package:flutter/material.dart';

import '../commen/spacer.dart';

class RecipientTypeSelector extends StatelessWidget {
  final String? recipientType;
  final Function(String?) onChanged;

  const RecipientTypeSelector({
    Key? key,
    required this.recipientType,
    required this.onChanged,
  }) : super(key: key);

  static const List<String> recipientOptions = [
    "Agent",
    "Stub Collection",
    "Regional Manager",
    "Supervisor",
    "Stock Manager",
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return _buildSelector(
      context: context,
      label: 'Recipient Type',
      value: recipientType ?? 'Select Recipient Type',
      icon: Icons.person_outline,
      onTap: () async {
        final TextEditingController searchController = TextEditingController();
        List<String> filteredOptions = List.from(recipientOptions);

        await showDialog(
          context: context,
          builder: (context) => StatefulBuilder(
            builder: (context, setDialogState) => AlertDialog(
              backgroundColor: theme.cardTheme.color,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              title: Text(
                'Select Recipient Type',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: theme.colorScheme.primary,
                ),
              ),
              content: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: searchController,
                      decoration: InputDecoration(
                        hintText: 'Search recipient types...',
                        prefixIcon: Icon(
                          Icons.search,
                          color: theme.colorScheme.primary,
                          size: 18,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: BorderSide(
                            color: theme.colorScheme.primary,
                            width: 1.5,
                          ),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: BorderSide(
                            color: theme.colorScheme.primary.withOpacity(0.7),
                            width: 1.5,
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: BorderSide(
                            color: theme.colorScheme.primary,
                            width: 2,
                          ),
                        ),
                      ),
                      onChanged: (value) {
                        setDialogState(() {
                          filteredOptions = recipientOptions
                              .where((option) => option.toLowerCase().contains(value.toLowerCase()))
                              .toList();
                        });
                      },
                    ),
                    const CustomSpacer(height: 8),
                    SizedBox(
                      height: 300,
                      child: ListView.builder(
                        itemCount: filteredOptions.length,
                        itemBuilder: (context, index) {
                          final option = filteredOptions[index];
                          return ListTile(
                            leading: Icon(
                              Icons.person_outline,
                              color: theme.colorScheme.primary,
                              size: 18,
                            ),
                            title: Text(
                              option,
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: theme.colorScheme.onSurface,
                              ),
                            ),
                            trailing: recipientType == option
                                ? Icon(
                              Icons.check_circle,
                              color: theme.colorScheme.primary,
                              size: 18,
                            )
                                : null,
                            onTap: () {
                              onChanged(option);
                              Navigator.pop(context);
                            },
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text(
                    'Cancel',
                    style: TextStyle(
                      color: theme.colorScheme.onSurface.withOpacity(0.6),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildSelector({
    required BuildContext context,
    required String label,
    required String value,
    required IconData icon,
    VoidCallback? onTap,
    bool disabled = false,
  }) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: InkWell(
          onTap: disabled ? null : onTap,
          borderRadius: BorderRadius.circular(8),
          splashColor: theme.colorScheme.primary.withOpacity(0.2),
          highlightColor: theme.colorScheme.primary.withOpacity(0.1),
          child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
              border: Border.all(
              color: disabled
              ? theme.colorScheme.onSurface.withOpacity(0.3)
              : theme.colorScheme.primary.withOpacity(0.7),
      width: 1.5,
    ),
                borderRadius: BorderRadius.circular(8),
                color: disabled
                    ? theme.colorScheme.background.withOpacity(0.5)
                    : theme.colorScheme.background,
              ),
            child: Row(
              children: [
                Icon(
                  icon,
                  color: disabled
                      ? theme.colorScheme.onSurface.withOpacity(0.5)
                      : theme.colorScheme.primary,
                  size: 18,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: disabled
                              ? theme.colorScheme.onSurface.withOpacity(0.5)
                              : theme.colorScheme.onSurface.withOpacity(0.7),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        value,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: disabled
                              ? theme.colorScheme.onSurface.withOpacity(0.5)
                              : theme.colorScheme.onSurface,
                          fontWeight: FontWeight.w500,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                Icon(
                  Icons.arrow_drop_down,
                  color: disabled
                      ? theme.colorScheme.onSurface.withOpacity(0.5)
                      : theme.colorScheme.primary,
                  size: 24,
                ),
              ],
            ),
          ),
      ),
    );
  }
}