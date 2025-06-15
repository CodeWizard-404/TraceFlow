import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:TraceFlow/providers/agent_provider.dart';
import 'package:TraceFlow/providers/receipt_book_provider.dart';
import 'package:TraceFlow/providers/timesheet_provider.dart';
import 'package:TraceFlow/providers/user_provider.dart';
import 'package:TraceFlow/providers/notification_provider.dart';
import 'package:TraceFlow/providers/auth_provider.dart';
import 'package:TraceFlow/models/agent.dart';
import 'package:TraceFlow/models/receipt_book.dart';
import 'package:TraceFlow/models/timesheet.dart';
import 'package:TraceFlow/models/user.dart';
import 'package:TraceFlow/models/notification.dart' as AppNotification;
import '../models/receipt_book_type.dart';
import '../models/visit.dart';
import '../widgets/appbar/app_bar.dart';
import '../widgets/appbar/sidebar.dart';
import '../widgets/commen/button.dart';
import '../widgets/commen/spacer.dart';
import 'package:url_launcher/url_launcher.dart';

class SupervisorDashboard extends StatefulWidget {
  const SupervisorDashboard({super.key});

  @override
  State<SupervisorDashboard> createState() => _SupervisorDashboardState();
}

class _SupervisorDashboardState extends State<SupervisorDashboard> with SingleTickerProviderStateMixin {
  bool _isLoading = true;
  String? _errorMessage;
  final Map<String, String> _visitFilters = {
    'status': 'all',
    'agent': '',
    'dateStart': '',
    'dateEnd': '',
  };
  User? _regionalManager;
  User? _director;
  late AnimationController _animationController;
  bool _isAnimationInitialized = false;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _isAnimationInitialized = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fetchData();
      if (_isAnimationInitialized) {
        _animationController.forward();
      }
    });
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  Future<void> _fetchData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final userProvider = Provider.of<UserProvider>(context, listen: false);

    if (authProvider.isLoading) {
      await Future.doWhile(() async {
        await Future.delayed(const Duration(milliseconds: 100));
        return authProvider.isLoading;
      });
    }

    if (!authProvider.isAuthenticated || authProvider.user == null) {
      setState(() {
        _errorMessage = 'User not authenticated. Please log in again.';
        _isLoading = false;
      });
      return;
    }

    try {
      await Future.wait([
        Provider.of<AgentProvider>(context, listen: false).getAgentsByUser(authProvider.user!.userID),
        Provider.of<ReceiptBookProvider>(context, listen: false).fetchReceiptBooksByHolder(authProvider.user!.userID),
        Provider.of<TimesheetProvider>(context, listen: false).fetchTimesheetsBySupervisor(authProvider.user!.userID),
        Provider.of<NotificationProvider>(context, listen: false).fetchNotifications(),
        Provider.of<ReceiptBookProvider>(context, listen: false).fetchAllReceiptBookTypes(),
      ]);

      _regionalManager = await userProvider.getRegionalManagerBySupervisor(authProvider.user!.userID);
      if (_regionalManager != null && _regionalManager!.userID != 'none') {
        await userProvider.getDirectorByUser(_regionalManager!.regionalManagerID ?? _regionalManager!.userID);
        _director = userProvider.currentUser;
      } else {
        _director = null;
      }
    } catch (e) {
      _regionalManager = null;
      _director = null;
      _errorMessage = e.toString();
      if (kDebugMode) print('Error fetching hierarchy: $_errorMessage');
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (_isLoading) {
      return Scaffold(
        appBar: const CustomAppBar(title: 'Dashboard', showBackButton: false),
        drawer: const AppSidebar(),
        body: Center(child: CircularProgressIndicator(color: theme.colorScheme.primary)),
      );
    }

    if (_errorMessage != null) {
      return Scaffold(
        appBar: const CustomAppBar(title: 'Dashboard', showBackButton: false),
        drawer: const AppSidebar(),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(_errorMessage!, style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.error)),
              const CustomSpacer(height: 16),
              ElevatedButton(
                onPressed: _errorMessage!.contains('User not authenticated')
                    ? () => Navigator.pushReplacementNamed(context, '/login')
                    : _fetchData,
                style: ElevatedButton.styleFrom(
                  backgroundColor: theme.colorScheme.primary,
                  foregroundColor: theme.colorScheme.onPrimary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: Text(_errorMessage!.contains('User not authenticated') ? 'Log In' : 'Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final agentProvider = Provider.of<AgentProvider>(context);
    final receiptBookProvider = Provider.of<ReceiptBookProvider>(context);
    final timesheetProvider = Provider.of<TimesheetProvider>(context);
    final userProvider = Provider.of<UserProvider>(context);
    final notificationProvider = Provider.of<NotificationProvider>(context);

    final agents = agentProvider.agents;
    final receiptBooks = receiptBookProvider.receiptBooks;
    final timesheets = timesheetProvider.timesheets;
    final user = userProvider.currentUser;
    final notifications = notificationProvider.notifications;

    if (user == null) {
      return Scaffold(
        appBar: const CustomAppBar(title: 'Dashboard', showBackButton: false),
        drawer: const AppSidebar(),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('User profile not loaded.', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.error)),
              const CustomSpacer(height: 16),
              ElevatedButton(
                onPressed: _fetchData,
                style: ElevatedButton.styleFrom(
                  backgroundColor: theme.colorScheme.primary,
                  foregroundColor: theme.colorScheme.onPrimary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final allVisits = timesheets.expand((ts) => ts.visits ?? <Visit>[]).toList() as List<Visit>;
    final numAgents = agents.length;
    final numReceiptBooks = receiptBooks.length;
    final numVisits = allVisits.length;
    final sevenDaysAgo = DateTime.now().subtract(const Duration(days: 7));
    final visitsLast7Days = allVisits.where((v) => v.date.isAfter(sevenDaysAgo)).length;
    final pendingVisits = allVisits.where((v) => v.status == 'pending').length;
    final agentsWithVisits = allVisits.map((v) => v.agentID).toSet().length;
    final activeAgents = agents.where((a) => allVisits.any((v) => v.agentID == a.agentID && v.date.isAfter(sevenDaysAgo))).length;
    final avgVisitDuration = allVisits.isNotEmpty
        ? (allVisits.fold<int>(0, (sum, v) => sum + (v.duration ?? 0)) / allVisits.length).toStringAsFixed(2)
        : '0';
    final validatedVisits = allVisits.where((v) => v.status == 'validated').length;
    final completionRate = allVisits.isNotEmpty
        ? ((allVisits.where((v) => v.status == 'visited').length / allVisits.length) * 100).toStringAsFixed(1)
        : '0';

    final filteredVisits = allVisits.where((visit) {
      final statusMatch = _visitFilters['status'] == 'all' || visit.status == _visitFilters['status'];
      final agentMatch = _visitFilters['agent']!.isEmpty || visit.agentID == _visitFilters['agent'];
      final dateStart = _visitFilters['dateStart']!.isEmpty ? null : DateTime.parse(_visitFilters['dateStart']!);
      final dateEnd = _visitFilters['dateEnd']!.isEmpty ? null : DateTime.parse(_visitFilters['dateEnd']!);
      final dateMatch = (dateStart == null || visit.date.isAfter(dateStart)) && (dateEnd == null || visit.date.isBefore(dateEnd));
      return statusMatch && agentMatch && dateMatch;
    }).toList();

    return Scaffold(
      appBar: const CustomAppBar(title: 'Supervisor Dashboard', showBackButton: false),
      drawer: const AppSidebar(),
      body: RefreshIndicator(
        onRefresh: _fetchData,
        color: theme.colorScheme.primary,
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.all(8.0),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  _isAnimationInitialized
                      ? FadeTransition(
                    opacity: _animationController,
                    child: Column(
                      children: [
                        _buildSectionCard(
                          context,
                          title: 'Key Statistics',
                          children: [
                            _buildHeaderStats(numAgents, numReceiptBooks,
                                numVisits, visitsLast7Days, pendingVisits,
                                activeAgents, avgVisitDuration,
                                validatedVisits, completionRate)
                          ],
                        ),
                        const CustomSpacer(height: 8),
                        _buildSectionCard(
                          context,
                          title: 'Quick Actions',
                          children: [_buildQuickActions(context)],
                        ),
                        const CustomSpacer(height: 8),
                        _buildSectionCard(
                          context,
                          title: 'Agents Assigned',
                          children: [
                            _buildAgentsAssigned(
                                agents, agentsWithVisits, numAgents)
                          ],
                        ),
                        const CustomSpacer(height: 8),
                        _buildSectionCard(
                          context,
                          title:
                          'Notifications (${notifications.where((n) => n.status != 'read').length})',
                          children: [
                            _buildNotifications(
                                notifications, notificationProvider)
                          ],
                        ),
                        const CustomSpacer(height: 8),
                        _buildSectionCard(
                          context,
                          title: 'Hierarchy',
                          children: [_buildHierarchy(user, userProvider)],
                        ),
                        const CustomSpacer(height: 8),
                        _buildSectionCard(
                          context,
                          title: 'Receipt Books',
                          children: [
                            _buildReceiptBooks(
                                receiptBooks, receiptBookProvider)
                          ],
                        ),
                        const CustomSpacer(height: 8),
                        _buildSectionCard(
                          context,
                          title: 'Visits',
                          children: [
                            _buildVisits(filteredVisits, agents, timesheets)
                          ],
                        ),
                        const CustomSpacer(height: 8),
                        _buildSectionCard(
                          context,
                          title: 'KPIs',
                          children: [
                            _buildKPIs(allVisits, agents, timesheets)
                          ],
                        ),
                      ],
                    ),
                  )
                      : const Center(child: CircularProgressIndicator()),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionCard(BuildContext context,
      {required String title, required List<Widget> children}) {
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

  Widget _buildHeaderStats(
      int numAgents,
      int numReceiptBooks,
      int numVisits,
      int visitsLast7Days,
      int pendingVisits,
      int activeAgents,
      String avgVisitDuration,
      int validatedVisits,
      String completionRate) {
    final theme = Theme.of(context);
    return Wrap(
      spacing: 16,
      runSpacing: 16,
      children: [
        _buildStatItem('Agents', numAgents.toString(), Icons.group, theme),
        _buildStatItem(
            'Receipt Books', numReceiptBooks.toString(), Icons.book, theme),
        _buildStatItem('Visits', numVisits.toString(), Icons.location_on, theme),
        _buildStatItem(
            'Visits (7 Days)', visitsLast7Days.toString(), Icons.timer, theme),
        _buildStatItem(
            'Pending Visits', pendingVisits.toString(), Icons.pending, theme),
        _buildStatItem(
            'Active Agents', activeAgents.toString(), Icons.person, theme),
        _buildStatItem('Avg Duration', '$avgVisitDuration min',
            Icons.hourglass_empty, theme),
        _buildStatItem('Validated Visits', validatedVisits.toString(),
            Icons.check_circle, theme),
        _buildStatItem(
            'Completion Rate', '$completionRate%', Icons.percent, theme),
      ],
    );
  }

  Widget _buildStatItem(
      String title, String value, IconData icon, ThemeData theme) {
    return AnimatedBuilder(
      animation: _animationController,
      builder: (context, child) => Transform.translate(
        offset: Offset(0, 20 * (1 - _animationController.value)),
        child: Opacity(
          opacity: _animationController.value,
          child: Container(
            width: 117,
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: theme.colorScheme.surface,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: theme.colorScheme.primary.withOpacity(0.3)),
            ),
            child: Column(
              children: [
                Icon(icon, size: 32, color: theme.colorScheme.primary),
                const CustomSpacer(height: 4),
                Text(value,
                    style: theme.textTheme.titleMedium
                        ?.copyWith(fontWeight: FontWeight.bold)),
                Text(
                    title,
                    style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurface.withOpacity(0.7))),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildQuickActions(BuildContext context) {
    final theme = Theme.of(context);
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        _buildActionButton(context, 'Add Timesheet', Icons.schedule,
                () => Navigator.pushNamed(context, '/timesheet-details')),
        _buildActionButton(context, 'Assign Receipt Book', Icons.book,
                () => Navigator.pushNamed(context, '/transfer-receipt-books')),
        _buildActionButton(context, 'Sync to Calendar', Icons.calendar_today,
                () async {
              final timesheetProvider =
              Provider.of<TimesheetProvider>(context, listen: false);
              final user = Provider.of<AuthProvider>(context, listen: false).user!;
              await timesheetProvider.syncTimesheetToCalendar(user.userID);
            }),
        _buildActionButton(context, 'Start Visit', Icons.location_on,
                () => Navigator.pushNamed(context, '/create-visit')),
        _buildActionButton(
            context,
            'Generate Timesheets',
            Icons.auto_fix_high,
                () => Navigator.pushNamed(context, '/timesheet-details',
                arguments: {'openSuggestionModal': true})),
        _buildActionButton(context, 'Edit Profile', Icons.person,
                () => Navigator.pushNamed(context, '/profile')),
        _buildActionButton(
            context,
            'Notification Preferences',
            Icons.notifications,
                () => Navigator.pushNamed(context, '/profile',
                arguments: {'scrollTo': 'notification-preferences'})),
      ],
    );
  }

  Widget _buildActionButton(
      BuildContext context, String label, IconData icon, VoidCallback onPressed) {
    final theme = Theme.of(context);
    return ElevatedButton.icon(
      icon: Icon(icon, size: 20),
      label: Text(label,
          style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: theme.colorScheme.primary.withOpacity(0.1),
        foregroundColor: theme.colorScheme.primary,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
    );
  }

  Widget _buildAgentsAssigned(
      List<Agent> agents, int agentsWithVisits, int numAgents) {
    final theme = Theme.of(context);
    final TextEditingController _searchController = TextEditingController();
    String _searchQuery = '';

    List<Agent> _filterAgents(List<Agent> agents, String query) {
      if (query.isEmpty) return agents;
      final lowercaseQuery = query.toLowerCase();
      return agents.where((agent) {
        final fullName = '${agent.name} ${agent.lastname}'.toLowerCase();
        final phone = agent.phone?.toLowerCase() ?? '';
        return fullName.contains(lowercaseQuery) || phone.contains(lowercaseQuery);
      }).toList();
    }

    Future<void> _makePhoneCall(String? phoneNumber) async {
      if (phoneNumber == null || phoneNumber.isEmpty || phoneNumber == 'N/A') {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No valid phone number available')),
        );
        return;
      }
      final Uri phoneUri = Uri(scheme: 'tel', path: phoneNumber);
      if (await canLaunchUrl(phoneUri)) {
        await launchUrl(phoneUri);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not launch phone call')),
        );
      }
    }

    void _showAgentsPopup() {
      showDialog(
        context: context,
        builder: (BuildContext context) {
          return StatefulBuilder(
            builder: (context, setState) {
              final filteredAgents = _filterAgents(agents, _searchQuery);
              return AlertDialog(
                title: Text(
                  'Assigned Agents',
                  style: theme.textTheme.titleLarge?.copyWith(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                content: Container(
                  width: double.maxFinite,
                  constraints: BoxConstraints(
                    maxHeight: MediaQuery.of(context).size.height * 0.5,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      TextField(
                        controller: _searchController,
                        decoration: InputDecoration(
                          labelText: 'Search by name or phone',
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8)),
                          prefixIcon:
                          Icon(Icons.search, color: theme.colorScheme.primary),
                        ),
                        onChanged: (value) {
                          setState(() {
                            _searchQuery = value;
                          });
                        },
                      ),
                      const CustomSpacer(height: 8),
                      Expanded(
                        child: filteredAgents.isEmpty
                            ? Text(
                          'No agents found.',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.colorScheme.onSurface,
                          ),
                        )
                            : ListView.builder(
                          shrinkWrap: true,
                          itemCount: filteredAgents.length,
                          itemBuilder: (context, index) {
                            final agent = filteredAgents[index];
                            return ListTile(
                              leading: Icon(Icons.person,
                                  color: theme.colorScheme.primary),
                              title: Text(
                                '${agent.name} ${agent.lastname}',
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              subtitle: Text(
                                'Phone: ${agent.phone ?? 'N/A'}',
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: theme.colorScheme.onSurface
                                      .withOpacity(0.7),
                                ),
                              ),
                              trailing: IconButton(
                                icon: Icon(Icons.phone,
                                    color: theme.colorScheme.primary),
                                onPressed: () => _makePhoneCall(agent.phone),
                              ),
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
                    style: TextButton.styleFrom(
                      foregroundColor: theme.colorScheme.primary,
                    ),
                    child: const Text('Close'),
                  ),
                ],
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                backgroundColor: theme.colorScheme.surface,
              );
            },
          );
        },
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Total Agents: $numAgents', style: theme.textTheme.bodyMedium),
        Text('Agents with Visits: $agentsWithVisits',
            style: theme.textTheme.bodyMedium),
        const CustomSpacer(height: 8),
        ElevatedButton(
          onPressed: _showAgentsPopup,
          style: ElevatedButton.styleFrom(
            backgroundColor: theme.colorScheme.primary,
            foregroundColor: theme.colorScheme.onPrimary,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          child: const Text('View All Agents'),
        ),
      ],
    );
  }

  Widget _buildNotifications(
      List<AppNotification.Notification> notifications, NotificationProvider provider) {
    final theme = Theme.of(context);
    final sentNotifications = notifications.where((n) => n.status == 'sent').toList();

    // Map notification types to icons
    final notificationIcons = {
      'visit': Icons.location_on,
      'receipt': Icons.book,
      'timesheet': Icons.schedule,
      'alert': Icons.warning,
      'info': Icons.info,
    };

    return Column(
      children: [
        SizedBox(
          height: 150,
          child: ListView.builder(
            itemCount: sentNotifications.length,
            itemBuilder: (context, index) {
              final notification = sentNotifications[index];
              final icon = notificationIcons[notification.type ?? 'info'] ?? Icons.info;
              return Card(
                elevation: 2,
                margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 0),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                  side: BorderSide(
                    color: theme.colorScheme.primary.withOpacity(0.3),
                    width: 1,
                  ),
                ),
                child: ListTile(
                  leading: Icon(
                    icon,
                    color: theme.colorScheme.primary,
                    size: 24,
                  ),
                  title: Text(
                    notification.message,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: theme.colorScheme.onSurface,
                    ),
                  ),
                  subtitle: Text(
                    notification.createdAt.toString(),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurface.withOpacity(0.7),
                    ),
                  ),
                  onTap: () => provider.markNotificationAsRead(notification.notificationID),
                  trailing: notification.status == 'sent'
                      ? Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: theme.colorScheme.primary,
                    ),
                  )
                      : null,
                ),
              );
            },
          ),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            IconButton(
              icon: Icon(Icons.refresh, color: theme.colorScheme.primary),
              onPressed: provider.fetchNotifications,
              tooltip: 'Refresh',
              style: IconButton.styleFrom(
                backgroundColor: theme.colorScheme.background,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
            IconButton(
              icon: Icon(Icons.clear_all, color: theme.colorScheme.primary),
              onPressed: provider.markAllNotificationsAsRead,
              tooltip: 'Clear All',
              style: IconButton.styleFrom(
                backgroundColor: theme.colorScheme.background,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildHierarchy(User user, UserProvider userProvider) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Organization Hierarchy',
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w600,
            color: theme.colorScheme.primary,
          ),
        ),
        const CustomSpacer(height: 8),
        if (_regionalManager != null || _director != null)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: theme.colorScheme.background,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: theme.colorScheme.primary.withOpacity(0.3),
                width: 1,
              ),
            ),
            child: Column(
              children: [
                if (_director != null) ...[
                  _buildHierarchyItem(
                    context,
                    title: 'Director',
                    name: '${_director!.firstName} ${_director!.lastName}',
                    phone: _director!.phone ?? 'N/A',
                    email: _director!.email ?? 'N/A',
                    icon: Icons.star,
                  ),
                  if (_regionalManager != null)
                    const CustomSpacer(height: 8),
                ],
                if (_regionalManager != null)
                  _buildHierarchyItem(
                    context,
                    title: 'Regional Manager',
                    name: '${_regionalManager!.firstName} ${_regionalManager!.lastName}',
                    phone: _regionalManager!.phone ?? 'N/A',
                    email: _regionalManager!.email ?? 'N/A',
                    icon: Icons.person,
                  ),
              ],
            ),
          )
        else
          Text(
            'No hierarchy information available.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurface.withOpacity(0.6),
            ),
          ),
      ],
    );
  }

  Widget _buildHierarchyItem(BuildContext context,
      {required String title,
        required String name,
        required String phone,
        required String email,
        required IconData icon}) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      decoration: BoxDecoration(
        border: Border(
          left: BorderSide(
            color: theme.colorScheme.primary,
            width: 3,
          ),
        ),
      ),
      child: Row(
        children: [
          Icon(icon, color: theme.colorScheme.primary, size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: theme.colorScheme.primary,
                  ),
                ),
                Text(
                  name,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  'Phone: $phone',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurface.withOpacity(0.7),
                  ),
                ),
                Text(
                  'Email: $email',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurface.withOpacity(0.7),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReceiptBooks(
      List<ReceiptBook> receiptBooks, ReceiptBookProvider provider) {
    final theme = Theme.of(context);
    final receiptBooksByType = receiptBooks.fold<Map<String, int>>({}, (acc, book) {
      final type = provider.receiptBookTypes.firstWhere(
            (t) => t.typeID == book.typeID,
        orElse: () => ReceiptBookType(typeID: book.typeID, name: 'Unknown'),
      );
      acc[type.name] = (acc[type.name] ?? 0) + 1;
      return acc;
    });
    final barData = receiptBooksByType.entries
        .toList()
        .asMap()
        .entries
        .map((e) => BarChartGroupData(
      x: e.key,
      barRods: [
        BarChartRodData(
            toY: e.value.value.toDouble(),
            color: theme.colorScheme.primary,
            width: 20)
      ],
    ))
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Receipt books by type.',
            style: theme.textTheme.bodySmall
                ?.copyWith(color: theme.colorScheme.onSurface.withOpacity(0.7))),
        const CustomSpacer(height: 8),
        Text('Total Receipt Books: ${receiptBooks.length}',
            style: theme.textTheme.bodyMedium),
        if (barData.isNotEmpty)
          Container(
            height: 250,
            width: MediaQuery.of(context).size.width - 24,
            child: BarChart(
              BarChartData(
                barGroups: barData,
                titlesData: FlTitlesData(
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 80,
                      getTitlesWidget: (value, _) => Transform.rotate(
                        angle: -45 * 3.141592653589793 / 180,
                        child: Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: SizedBox(
                            width: 120,
                            child: Text(
                              receiptBooksByType.keys.elementAt(value.toInt()),
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: theme.colorScheme.onSurface.withOpacity(0.7),
                                fontSize: 14,
                              ),
                              textAlign: TextAlign.left,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 50,
                      getTitlesWidget: (value, _) => Text(
                        value.toInt().toString(),
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurface.withOpacity(0.7),
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ),
                ),
                borderData: FlBorderData(show: false),
                gridData: FlGridData(show: true, drawVerticalLine: false),
                barTouchData: BarTouchData(
                  enabled: true,
                  touchTooltipData: BarTouchTooltipData(
                    tooltipPadding: const EdgeInsets.all(8),
                    getTooltipItem: (group, groupIndex, rod, rodIndex) =>
                        BarTooltipItem(
                          '${receiptBooksByType.keys.elementAt(group.x.toInt())}: ${rod.toY.toInt()}',
                          theme.textTheme.bodyMedium!.copyWith(
                            color: Colors.white,
                            fontSize: 16,
                          ),
                        ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildVisits(
      List<Visit> filteredVisits, List<Agent> agents, List<Timesheet> timesheets) {
    final theme = Theme.of(context);
    final visitStatusCounts = filteredVisits.fold<Map<String, int>>(
        {}, (acc, visit) {
      acc[visit.status ?? 'Unknown'] = (acc[visit.status ?? 'Unknown'] ?? 0) + 1;
      return acc;
    });

    final statusColors = {
      'pending': Colors.orange,
      'validated': Colors.green,
      'visited': theme.colorScheme.primary,
      'rejected': Colors.red,
      'Unknown': Colors.grey,
    };

    final pieData = visitStatusCounts.entries
        .map((e) => PieChartSectionData(
      title: e.key,
      value: e.value.toDouble(),
      color: statusColors[e.key] ?? Colors.grey,
      radius: 60,
      titleStyle: theme.textTheme.bodyMedium?.copyWith(
        color: Colors.white,
        fontWeight: FontWeight.bold,
        fontSize: 14,
      ),
    ))
        .toList();

    final visitsByDate = filteredVisits.fold<Map<String, int>>({}, (acc, visit) {
      final date = visit.date.toIso8601String().split('T')[0];
      acc[date] = (acc[date] ?? 0) + 1;
      return acc;
    });

    final filteredVisitsByDate = visitsByDate.entries.where((e) => e.value > 0).toList();
    final barData = filteredVisitsByDate
        .asMap()
        .entries
        .map((e) => BarChartGroupData(
      x: e.key,
      barRods: [
        BarChartRodData(
            toY: e.value.value.toDouble(),
            color: theme.colorScheme.primary,
            width: 20)
      ],
    ))
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Visit statuses and counts per date.',
            style: theme.textTheme.bodySmall
                ?.copyWith(color: theme.colorScheme.onSurface.withOpacity(0.7))),
        const CustomSpacer(height: 8),
        Row(
          children: [
            IconButton(
              icon: Icon(
                Icons.filter_alt_rounded,
                color: theme.colorScheme.primary,
              ),
              onPressed: () => showModalBottomSheet(
                context: context,
                isScrollControlled: true,
                shape: const RoundedRectangleBorder(
                  borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                ),
                builder: (_) => VisitFilterSheet(
                  agents: agents,
                  initialFilters: _visitFilters,
                  onApply: (filters) => setState(() => _visitFilters.addAll(filters)),
                ),
              ),
              tooltip: 'Filter',
              style: IconButton.styleFrom(
                backgroundColor: theme.colorScheme.background,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
            const SizedBox(width: 8),
            IconButton(
              icon: Icon(
                Icons.clear,
                color: theme.colorScheme.primary,
              ),
              onPressed: () => setState(() {
                _visitFilters['status'] = 'all';
                _visitFilters['agent'] = '';
                _visitFilters['dateStart'] = '';
                _visitFilters['dateEnd'] = '';
              }),
              tooltip: 'Clear Filters',
              style: IconButton.styleFrom(
                backgroundColor: theme.colorScheme.background,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
        const CustomSpacer(height: 8),
        Text('Total Visits: ${filteredVisits.length}',
            style: theme.textTheme.bodyMedium),
        if (pieData.isNotEmpty)
          Container(
            height: 250,
            width: visitStatusCounts.length * 130.0,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: SizedBox(
                width: visitStatusCounts.length * 130.0,
                child: PieChart(
                  PieChartData(
                    sections: pieData,
                    centerSpaceRadius: 40,
                    sectionsSpace: 4,
                    borderData: FlBorderData(show: false),
                    pieTouchData: PieTouchData(
                      enabled: true,
                      touchCallback: (FlTouchEvent event, pieTouchResponse) {},
                    ),
                  ),
                ),
              ),
            ),
          ),
        if (barData.isNotEmpty)
          Container(
            height: 250,
            width: filteredVisitsByDate.length * 50.0,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: SizedBox(
                width: filteredVisitsByDate.length * 50.0,
                child: BarChart(
                  BarChartData(
                    barGroups: barData,
                    titlesData: FlTitlesData(
                      bottomTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: 80,
                          getTitlesWidget: (value, _) => Transform.rotate(
                            angle: -45 * 3.141592653589793 / 180,
                            child: Padding(
                              padding: const EdgeInsets.only(top: 12),
                              child: SizedBox(
                                width: 120,
                                child: Text(
                                  filteredVisitsByDate[value.toInt()].key,
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    color: theme.colorScheme.onSurface.withOpacity(0.7),
                                    fontSize: 14,
                                  ),
                                  textAlign: TextAlign.left,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      leftTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: 50,
                          getTitlesWidget: (value, _) => Text(
                            value.toInt().toString(),
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.colorScheme.onSurface.withOpacity(0.7),
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ),
                    ),
                    borderData: FlBorderData(show: false),
                    gridData: FlGridData(show: true, drawVerticalLine: false),
                    barTouchData: BarTouchData(
                      enabled: true,
                      touchTooltipData: BarTouchTooltipData(
                        tooltipPadding: const EdgeInsets.all(8),
                        getTooltipItem: (group, groupIndex, rod, rodIndex) =>
                            BarTooltipItem(
                              '${filteredVisitsByDate[group.x.toInt()].key}: ${rod.toY.toInt()} visits',
                              theme.textTheme.bodyMedium!.copyWith(
                                color: Colors.white,
                                fontSize: 16,
                              ),
                            ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildKPIs(
      List<Visit> allVisits, List<Agent> agents, List<Timesheet> timesheets) {
    final theme = Theme.of(context);
    final visitsPerAgent = agents
        .map((a) => {
      'name': '${a.name} ${a.lastname}',
      'visits': allVisits.where((v) => v.agentID == a.agentID).length,
    })
        .where((d) => (d['visits'] as int) > 0)
        .toList();
    final barData = visitsPerAgent
        .asMap()
        .entries
        .map((e) => BarChartGroupData(
      x: e.key,
      barRods: [
        BarChartRodData(
            toY: (e.value['visits'] as int).toDouble(),
            color: theme.colorScheme.primary,
            width: 20)
      ],
    ))
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Visits per agent.',
            style: theme.textTheme.bodySmall
                ?.copyWith(color: theme.colorScheme.onSurface.withOpacity(0.7))),
        const CustomSpacer(height: 8),
        if (barData.isNotEmpty)
          Container(
            height: 250,
            width: visitsPerAgent.length * 80.0,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: SizedBox(
                width: visitsPerAgent.length * 80.0,
                child: BarChart(
                  BarChartData(
                    barGroups: barData,
                    titlesData: FlTitlesData(
                      bottomTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: 80,
                          getTitlesWidget: (value, _) => Transform.rotate(
                            angle: -45 * 3.141592653589793 / 180,
                            child: Padding(
                              padding: const EdgeInsets.only(top: 12),
                              child: SizedBox(
                                width: 120,
                                child: Text(
                                  visitsPerAgent[value.toInt()]['name'] as String,
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    color: theme.colorScheme.onSurface.withOpacity(0.7),
                                    fontSize: 14,
                                  ),
                                  textAlign: TextAlign.left,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      leftTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: 50,
                          getTitlesWidget: (value, _) => Text(
                            value.toInt().toString(),
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.colorScheme.onSurface.withOpacity(0.7),
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ),
                    ),
                    borderData: FlBorderData(show: false),
                    gridData: FlGridData(show: true, drawVerticalLine: false),
                    barTouchData: BarTouchData(
                      enabled: true,
                      touchTooltipData: BarTouchTooltipData(
                        tooltipPadding: const EdgeInsets.all(8),
                        getTooltipItem: (group, groupIndex, rod, rodIndex) =>
                            BarTooltipItem(
                              '${visitsPerAgent[group.x.toInt()]['name']}: ${rod.toY.toInt()} visits',
                              theme.textTheme.bodyMedium!.copyWith(
                                color: Colors.white,
                                fontSize: 16,
                              ),
                            ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class VisitFilterSheet extends StatefulWidget {
  final List<Agent> agents;
  final Map<String, String> initialFilters;
  final Function(Map<String, String>) onApply;

  const VisitFilterSheet({
    required this.agents,
    required this.initialFilters,
    required this.onApply,
    super.key,
  });

  @override
  State<VisitFilterSheet> createState() => _VisitFilterSheetState();
}

class _VisitFilterSheetState extends State<VisitFilterSheet> {
  late Map<String, String> _filters;
  DateTime? _startDate;
  DateTime? _endDate;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _filters = Map.from(widget.initialFilters);
    _startDate = _filters['dateStart']!.isEmpty ? null : DateTime.parse(_filters['dateStart']!);
    _endDate = _filters['dateEnd']!.isEmpty ? null : DateTime.parse(_filters['dateEnd']!);
  }

  List<Agent> _filterAgents(List<Agent> agents, String query) {
    if (query.isEmpty) return agents;
    final lowercaseQuery = query.toLowerCase();
    return agents.where((agent) {
      final fullName = '${agent.name} ${agent.lastname}'.toLowerCase();
      final phone = agent.phone?.toLowerCase() ?? '';
      return fullName.contains(lowercaseQuery) || phone.contains(lowercaseQuery);
    }).toList();
  }

  Widget _buildSectionCard(BuildContext context,
      {required String title, required List<Widget> children}) {
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final allStatusOptions = {'all', 'pending', 'validated', 'visited', 'rejected'};
    final filteredAgents = _filterAgents(widget.agents, _searchQuery);

    return Container(
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: theme.colorScheme.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Filter Visits',
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w700,
              color: theme.colorScheme.onSurface,
            ),
          ),
          const CustomSpacer(height: 16),
          _buildSectionCard(
            context,
            title: 'Status',
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: allStatusOptions.map((option) {
                  final isSelected = _filters['status'] == option;
                  return GestureDetector(
                    onTap: () => setState(() => _filters['status'] = option),
                    child: Chip(
                      label: Text(
                        option.capitalize(),
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: isSelected
                              ? theme.colorScheme.primary
                              : theme.colorScheme.onSurface,
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
                }).toList(),
              ),
            ],
          ),
          const CustomSpacer(height: 8),
          _buildSectionCard(
            context,
            title: 'Agent',
            children: [
              TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  labelText: 'Search by name or phone',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  prefixIcon: Icon(Icons.search, color: theme.colorScheme.primary),
                ),
                onChanged: (value) {
                  setState(() {
                    _searchQuery = value;
                  });
                },
              ),
              const CustomSpacer(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  GestureDetector(
                    onTap: () => setState(() => _filters['agent'] = ''),
                    child: Chip(
                      label: Text(
                        'All Agents',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: _filters['agent']!.isEmpty
                              ? theme.colorScheme.primary
                              : theme.colorScheme.onSurface,
                        ),
                      ),
                      backgroundColor: _filters['agent']!.isEmpty
                          ? theme.colorScheme.primary.withOpacity(0.2)
                          : theme.colorScheme.background,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(
                          color: _filters['agent']!.isEmpty
                              ? theme.colorScheme.primary
                              : theme.colorScheme.primary.withOpacity(0.7),
                          width: 1,
                        ),
                      ),
                    ),
                  ),
                  ...filteredAgents.map((agent) {
                    final isSelected = _filters['agent'] == agent.agentID;
                    return GestureDetector(
                      onTap: () => setState(() => _filters['agent'] = agent.agentID),
                      child: Chip(
                        label: Text(
                          '${agent.name} ${agent.lastname}',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: isSelected
                                ? theme.colorScheme.primary
                                : theme.colorScheme.onSurface,
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
                  }).toList(),
                ],
              ),
            ],
          ),
          const CustomSpacer(height: 8),
          _buildSectionCard(
            context,
            title: 'Date Range',
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: TextButton(
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: _startDate ?? DateTime.now(),
                          firstDate: DateTime(2000),
                          lastDate: DateTime(2100),
                        );
                        if (picked != null) {
                          setState(() {
                            _startDate = picked;
                            _filters['dateStart'] =
                            picked.toIso8601String().split('T')[0];
                          });
                        }
                      },
                      style: TextButton.styleFrom(
                        backgroundColor: theme.colorScheme.primary.withOpacity(0.1),
                        foregroundColor: theme.colorScheme.primary,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                        padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                      child: Text(
                        _startDate == null
                            ? 'Select Start Date'
                            : _filters['dateStart']!,
                        style: theme.textTheme.bodyMedium,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextButton(
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: _endDate ?? DateTime.now(),
                          firstDate: DateTime(2000),
                          lastDate: DateTime(2100),
                        );
                        if (picked != null) {
                          setState(() {
                            _endDate = picked;
                            _filters['dateEnd'] =
                            picked.toIso8601String().split('T')[0];
                          });
                        }
                      },
                      style: TextButton.styleFrom(
                        backgroundColor: theme.colorScheme.primary.withOpacity(0.1),
                        foregroundColor: theme.colorScheme.primary,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                        padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                      child: Text(
                        _endDate == null ? 'Select End Date' : _filters['dateEnd']!,
                        style: theme.textTheme.bodyMedium,
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
                  _filters['status'] = 'all';
                  _filters['agent'] = '';
                  _filters['dateStart'] = '';
                  _filters['dateEnd'] = '';
                  _startDate = null;
                  _endDate = null;
                  _searchQuery = '';
                  _searchController.clear();
                }),
                isOutlined: true,
                backgroundColor: theme.colorScheme.surface,
                textColor: theme.colorScheme.onSurface,
              ),
              CustomButton(
                label: 'Apply',
                onPressed: () {
                  widget.onApply(_filters);
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
    );
  }
}

// Extension to capitalize strings
extension StringExtension on String {
  String capitalize() {
    return "${this[0].toUpperCase()}${substring(1)}";
  }
}