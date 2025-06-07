import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/user.dart';
import '../../providers/auth_provider.dart';
import '../../providers/user_provider.dart';
import '../commen/spacer.dart';

class UserSelector extends StatefulWidget {
  final String role;
  final Function(User) onUserSelected;

  const UserSelector({
    Key? key,
    required this.role,
    required this.onUserSelected,
  }) : super(key: key);

  @override
  _UserSelectorState createState() => _UserSelectorState();
}

class _UserSelectorState extends State<UserSelector> {
  User? _selectedUser;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fetchUsersByRole();
    });
  }

  Future<void> _fetchUsersByRole() async {
    setState(() => _isLoading = true);
    try {
      final userProvider = Provider.of<UserProvider>(context, listen: false);
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      await userProvider.getUsersByRole(widget.role);

      // Filter out the logged-in supervisor if role is 'supervisor'
      final filteredUsers = widget.role == 'Supervisor'
          ? userProvider.users.where((user) => user.userID != authProvider.user!.userID).toList()
          : userProvider.users;

      if (filteredUsers.isNotEmpty) {
        // Auto-select if only one user is available
        if (filteredUsers.length == 1) {
          setState(() => _selectedUser = filteredUsers.first);
          widget.onUserSelected(filteredUsers.first);
        }
      }
    } catch (e) {
      print('Error fetching users in UserSelector: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final userProvider = Provider.of<UserProvider>(context);
    final authProvider = Provider.of<AuthProvider>(context);

    // Filter out the logged-in supervisor
    final filteredUsers = widget.role == 'Supervisor'
        ? userProvider.users.where((user) => user.userID != authProvider.user!.userID).toList()
        : userProvider.users;

    if (_isLoading) {
      return const CircularProgressIndicator();
    }
    if (userProvider.errorMessage != null) {
      return Text(
        'Error: ${userProvider.errorMessage}',
        style: TextStyle(color: theme.colorScheme.error),
      );
    }
    if (filteredUsers.isEmpty) {
      return Text(
        'No users found',
        style: theme.textTheme.bodyMedium?.copyWith(
          color: theme.colorScheme.onSurface,
        ),
      );
    }

    return _buildSelector(
      context: context,
      label: widget.role,
      value: _selectedUser == null
          ? 'Select ${widget.role}'
          : '${_selectedUser!.firstName ?? ''} ${_selectedUser!.lastName ?? ''} (${_selectedUser!.email})',
      icon: Icons.person_outline,
      onTap: () async {
        final TextEditingController searchController = TextEditingController();
        List<User> dialogFilteredUsers = List.from(filteredUsers);

        await showDialog(
          context: context,
          builder: (context) => StatefulBuilder(
              builder: (context, setDialogState) => AlertDialog(
                  backgroundColor: theme.cardTheme.color,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  title: Text(
                    'Select ${widget.role}',
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
                            hintText: 'Search users...',
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
                              dialogFilteredUsers = filteredUsers
                                  .where((user) =>
                              '${user.firstName} ${user.lastName}'
                                  .toLowerCase()
                                  .contains(value.toLowerCase()) ||
                                  user.email.toLowerCase().contains(value.toLowerCase()))
                                  .toList();
                            });
                          },
                        ),
                        const CustomSpacer(height: 8),
                        SizedBox(
                          height: 300,
                          child: ListView.builder(
                            itemCount: dialogFilteredUsers.length,
                            itemBuilder: (context, index) {
                              final user = dialogFilteredUsers[index];
                              return ListTile(
                                leading: Icon(
                                  Icons.person_outline,
                                  color: theme.colorScheme.primary,
                                  size: 18,
                                ),
                                title: Text(
                                  '${user.firstName ?? ''} ${user.lastName ?? ''}',
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    color: theme.colorScheme.onSurface,
                                  ),
                                ),
                                subtitle: Text(
                                  user.email,
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: theme.colorScheme.onSurface.withOpacity(0.6),
                                  ),
                                ),
                                trailing: _selectedUser == user
                                    ? Icon(
                                  Icons.check_circle,
                                  color: theme.colorScheme.primary,
                                  size: 18,
                                )
                                    : null,
                                onTap: () {
                                  setState(() {
                                    _selectedUser = user;
                                    widget.onUserSelected(user);
                                  });
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