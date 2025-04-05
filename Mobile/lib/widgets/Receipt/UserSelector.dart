import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:TraceFlow/models/user.dart';
import 'package:TraceFlow/providers/user_provider.dart';
import 'package:TraceFlow/widgets/commen/spacer.dart';
import 'package:TraceFlow/widgets/commen/text_field.dart';

class UserSelector extends StatefulWidget {
  final String? recipientType;
  final String? recipientID;
  final void Function(String?) onRecipientIDChanged;

  const UserSelector({
    required this.recipientType,
    required this.recipientID,
    required this.onRecipientIDChanged,
    super.key,
  });

  @override
  _UserSelectorState createState() => _UserSelectorState();
}

class _UserSelectorState extends State<UserSelector> {
  final TextEditingController _searchController = TextEditingController();
  List<User> _filteredUsers = [];
  int _visibleUsersLimit = 10; // Cap at 10 initially

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_filterUsers);
    // Initialize filtered list with all users
    final userProvider = Provider.of<UserProvider>(context, listen: false);
    _filteredUsers = List.from(userProvider.users);
  }

  @override
  void dispose() {
    _searchController.removeListener(_filterUsers);
    _searchController.dispose();
    super.dispose();
  }

  void _filterUsers() {
    final userProvider = Provider.of<UserProvider>(context, listen: false);
    final query = _searchController.text.toLowerCase();
    setState(() {
      _filteredUsers = userProvider.users.where((user) {
        final fullName = '${user.firstname} ${user.lastname}'.toLowerCase();
        final phone = user.phone?.toLowerCase() ?? '';
        return fullName.contains(query) || phone.contains(query);
      }).toList();
      _visibleUsersLimit = 10; // Reset limit when filtering
    });
  }

  @override
  Widget build(BuildContext context) {
    final userProvider = Provider.of<UserProvider>(context);
    final usersToShow = _searchController.text.isEmpty ? userProvider.users : _filteredUsers;
    final visibleUsers = usersToShow.take(_visibleUsersLimit).toList();
    final hasMore = usersToShow.length > _visibleUsersLimit;

    final selectedUser = widget.recipientID != null
        ? usersToShow.firstWhere(
          (user) => user.userID == widget.recipientID,
      orElse: () => userProvider.currentUser ??
          User(userID: '', firstname: 'Unknown', lastname: '', phone: ''),
    )
        : null;

    print('Building UI, recipientID: ${widget.recipientID}, selectedUser: ${selectedUser?.firstname}, users: ${userProvider.users.length}, filtered: ${usersToShow.length}, visible: ${visibleUsers.length}');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CustomTextField(
          controller: _searchController,
          label: 'Search ${widget.recipientType} (Name, Lastname, Phone)',
        ),
        const CustomSpacer(height: 16),
        if (usersToShow.isEmpty)
          const Text('No users match your search', style: TextStyle(color: Colors.red))
        else ...[
          SizedBox(
            height: 200,
            child: ListView.builder(
              itemCount: visibleUsers.length,
              itemBuilder: (context, index) {
                final user = visibleUsers[index];
                return RadioListTile<String>(
                  title: Text('${user.firstname} ${user.lastname} (${user.phone ?? "No phone"})'),
                  value: user.userID!,
                  groupValue: widget.recipientID,
                  onChanged: (value) {
                    print('Selected user ID: $value');
                    widget.onRecipientIDChanged(value);
                    setState(() {}); // Force rebuild
                  },
                );
              },
            ),
          ),
          if (hasMore) ...[
            const CustomSpacer(height: 8),
            ElevatedButton(
              onPressed: () {
                setState(() {
                  _visibleUsersLimit += 10; // Load 10 more
                });
              },
              child: const Text('Show More'),
            ),
          ],
        ],
        if (selectedUser != null && widget.recipientID != null) ...[
          const CustomSpacer(height: 16),
          Text('Selected ${widget.recipientType}: ${selectedUser.firstname} ${selectedUser.lastname}'),
        ],
      ],
    );
  }
}