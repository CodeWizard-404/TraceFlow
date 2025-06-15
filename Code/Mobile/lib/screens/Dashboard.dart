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
import '../widgets/commen/spacer.dart';

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
  bool _isAnimationInitialized = false; // Flag to track animation initialization

  @override
  void initState() {
    super.initState();
// Initialize AnimationController immediately
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _isAnimationInitialized = true; // Mark as initialized
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fetchData();
      if (_isAnimationInitialized) {
        _animationController.forward(); // Start animation after frame
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
                          children: [_buildHeaderStats(numAgents, numReceiptBooks, numVisits, visitsLast7Days, pendingVisits, activeAgents, avgVisitDuration, validatedVisits, completionRate)],
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
                          children: [_buildAgentsAssigned(agents, agentsWithVisits, numAgents)],
                        ),
                        const CustomSpacer(height: 8),
                        _buildSectionCard(
                          context,
                          title: 'Notifications (${notifications.where((n) => n.status != 'read').length})',
                          children: [_buildNotifications(notifications, notificationProvider)],
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
                          children: [_buildReceiptBooks(receiptBooks, receiptBookProvider)],
                        ),
                        const CustomSpacer(height: 8),
                        _buildSectionCard(
                          context,
                          title: 'Visits',
                          children: [_buildVisits(filteredVisits, agents, timesheets)],
                        ),
                        const CustomSpacer(height: 8),
                        _buildSectionCard(
                          context,
                          title: 'KPIs',
                          children: [_buildKPIs(allVisits, agents, timesheets)],
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

  Widget _buildHeaderStats(int numAgents, int numReceiptBooks, int numVisits, int visitsLast7Days, int pendingVisits, int activeAgents, String avgVisitDuration, int validatedVisits, String completionRate) {
    final theme = Theme.of(context);
    return Wrap(
      spacing: 16,
      runSpacing: 16,
      children: [
        _buildStatItem('Agents', numAgents.toString(), Icons.group, theme),
        _buildStatItem('Receipt Books', numReceiptBooks.toString(), Icons.book, theme),
        _buildStatItem('Visits', numVisits.toString(), Icons.location_on, theme),
        _buildStatItem('Visits (7 Days)', visitsLast7Days.toString(), Icons.timer, theme),
        _buildStatItem('Pending Visits', pendingVisits.toString(), Icons.pending, theme),
        _buildStatItem('Active Agents', activeAgents.toString(), Icons.person, theme),
        _buildStatItem('Avg Duration', '$avgVisitDuration min', Icons.hourglass_empty, theme),
        _buildStatItem('Validated Visits', validatedVisits.toString(), Icons.check_circle, theme),
        _buildStatItem('Completion Rate', '$completionRate%', Icons.percent, theme),
      ],
    );
  }

  Widget _buildStatItem(String title, String value, IconData icon, ThemeData theme) {
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
                Text(value, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                Text(title, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurface.withOpacity(0.7))),
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
        _buildActionButton(context, 'Add Timesheet', Icons.schedule, () => Navigator.pushNamed(context, '/timesheet-details')),
        _buildActionButton(context, 'Assign Receipt Book', Icons.book, () => Navigator.pushNamed(context, '/transfer-receipt-books')),
        _buildActionButton(context, 'Sync to Calendar', Icons.calendar_today, () async {
          final timesheetProvider = Provider.of<TimesheetProvider>(context, listen: false);
          final user = Provider.of<AuthProvider>(context, listen: false).user!;
          await timesheetProvider.syncTimesheetToCalendar(user.userID);
        }),
        _buildActionButton(context, 'Start Visit', Icons.location_on, () => Navigator.pushNamed(context, '/create-visit')),
        _buildActionButton(context, 'Generate Timesheets', Icons.auto_fix_high, () => Navigator.pushNamed(context, '/timesheet-details', arguments: {'openSuggestionModal': true})),
        _buildActionButton(context, 'Edit Profile', Icons.person, () => Navigator.pushNamed(context, '/profile')),
        _buildActionButton(context, 'Notification Preferences', Icons.notifications, () => Navigator.pushNamed(context, '/profile', arguments: {'scrollTo': 'notification-preferences'})),
      ],
    );
  }

  Widget _buildActionButton(BuildContext context, String label, IconData icon, VoidCallback onPressed) {
    final theme = Theme.of(context);
    return ElevatedButton.icon(
      icon: Icon(icon, size: 20),
      label: Text(label, style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: theme.colorScheme.primary.withOpacity(0.1),
        foregroundColor: theme.colorScheme.primary,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
    );
  }

  Widget _buildAgentsAssigned(List<Agent> agents, int agentsWithVisits, int numAgents) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Total Agents: $numAgents', style: theme.textTheme.bodyMedium),
        Text('Agents with Visits: $agentsWithVisits', style: theme.textTheme.bodyMedium),
        const CustomSpacer(height: 8),
        ElevatedButton(
          onPressed: () => Navigator.pushNamed(context, '/agents'),
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

  Widget _buildNotifications(List<AppNotification.Notification> notifications, NotificationProvider provider) {
    final theme = Theme.of(context);
    return Column(
      children: [
        SizedBox(
          height: 150,
          child: ListView.builder(
            itemCount: notifications.length,
            itemBuilder: (context, index) => ListTile(
              title: Text(notifications[index].message, style: theme.textTheme.bodyMedium),
              subtitle: Text(notifications[index].createdAt.toString(), style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurface.withOpacity(0.7))),
              onTap: () => provider.markNotificationAsRead(notifications[index].notificationID),
            ),
          ),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            IconButton(
              icon: Icon(Icons.refresh, color: theme.colorScheme.primary),
              onPressed: provider.fetchNotifications,
            ),
            IconButton(
              icon: Icon(Icons.clear_all, color: theme.colorScheme.primary),
              onPressed: provider.markAllNotificationsAsRead,
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
        Text('Supervisor: ${user.firstName} ${user.lastName}', style: theme.textTheme.bodyMedium),
        if (_regionalManager != null)
          Text('Regional Manager: ${_regionalManager!.firstName} ${_regionalManager!.lastName}', style: theme.textTheme.bodyMedium),
        if (_director != null)
          Text('Director: ${_director!.firstName} ${_director!.lastName}', style: theme.textTheme.bodyMedium),
      ],
    );
  }

  Widget _buildReceiptBooks(List<ReceiptBook> receiptBooks, ReceiptBookProvider provider) {
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
      barRods: [BarChartRodData(toY: e.value.value.toDouble(), color: theme.colorScheme.primary)],
    ))
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Total Receipt Books: ${receiptBooks.length}', style: theme.textTheme.bodyMedium),
        if (barData.isNotEmpty)
          SizedBox(
            height: 200,
            child: BarChart(
              BarChartData(
                barGroups: barData,
                titlesData: FlTitlesData(
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      getTitlesWidget: (value, _) => Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          receiptBooksByType.keys.elementAt(value.toInt()),
                          style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurface.withOpacity(0.7)),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                  ),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      getTitlesWidget: (value, _) => Text(
                        value.toInt().toString(),
                        style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurface.withOpacity(0.7)),
                      ),
                    ),
                  ),
                ),
                borderData: FlBorderData(show: false),
                gridData: FlGridData(show: true, drawVerticalLine: false),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildVisits(List<Visit> filteredVisits, List<Agent> agents, List<Timesheet> timesheets) {
    final theme = Theme.of(context);
    final visitStatusCounts = filteredVisits.fold<Map<String, int>>({}, (acc, visit) {
      acc[visit.status ?? 'Unknown'] = (acc[visit.status ?? 'Unknown'] ?? 0) + 1;
      return acc;
    });
    final pieData = visitStatusCounts.entries
        .map((e) => PieChartSectionData(
      title: e.key,
      value: e.value.toDouble(),
      color: Colors.primaries[visitStatusCounts.keys.toList().indexOf(e.key) % Colors.primaries.length],
      radius: 60,
      titleStyle: theme.textTheme.bodySmall?.copyWith(color: Colors.white, fontWeight: FontWeight.bold),
    ))
        .toList();

    final visitsByDate = filteredVisits.fold<Map<String, int>>({}, (acc, visit) {
      final date = visit.date.toIso8601String().split('T')[0];
      acc[date] = (acc[date] ?? 0) + 1;
      return acc;
    });
    final lineData = visitsByDate.entries
        .map((e) => FlSpot(
      DateTime.parse(e.key).millisecondsSinceEpoch.toDouble(),
      e.value.toDouble(),
    ))
        .toList()
      ..sort((a, b) => a.x.compareTo(b.x));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _buildFilterDropdown(
              value: _visitFilters['status'],
              items: [
                const DropdownMenuItem(value: 'all', child: Text('All Statuses')),
                const DropdownMenuItem(value: 'pending', child: Text('Pending')),
                const DropdownMenuItem(value: 'validated', child: Text('Validated')),
                const DropdownMenuItem(value: 'visited', child: Text('Visited')),
              ],
              onChanged: (value) => setState(() => _visitFilters['status'] = value ?? 'all'),
              label: 'Status',
            ),
            _buildFilterDropdown(
              value: _visitFilters['agent'],
              items: [
                const DropdownMenuItem(value: '', child: Text('All Agents')),
                ...agents.map((a) => DropdownMenuItem(value: a.agentID, child: Text('${a.name} ${a.lastname}')))
              ],
              onChanged: (value) => setState(() => _visitFilters['agent'] = value ?? ''),
              label: 'Agent',
            ),
            _buildDateFilterButton(
              label: 'Start Date',
              value: _visitFilters['dateStart']!.isEmpty ? 'Select' : _visitFilters['dateStart']!,
              onPressed: () async {
                final picked = await showDatePicker(context: context, initialDate: DateTime.now(), firstDate: DateTime(2000), lastDate: DateTime(2100));
                if (picked != null) setState(() => _visitFilters['dateStart'] = picked.toIso8601String().split('T')[0]);
              },
            ),
            _buildDateFilterButton(
              label: 'End Date',
              value: _visitFilters['dateEnd']!.isEmpty ? 'Select' : _visitFilters['dateEnd']!,
              onPressed: () async {
                final picked = await showDatePicker(context: context, initialDate: DateTime.now(), firstDate: DateTime(2000), lastDate: DateTime(2100));
                if (picked != null) setState(() => _visitFilters['dateEnd'] = picked.toIso8601String().split('T')[0]);
              },
            ),
          ],
        ),
        const CustomSpacer(height: 8),
        Text('Total Visits: ${filteredVisits.length}', style: theme.textTheme.bodyMedium),
        if (pieData.isNotEmpty)
          SizedBox(
            height: 200,
            child: PieChart(
              PieChartData(
                sections: pieData,
                centerSpaceRadius: 40,
                sectionsSpace: 2,
              ),
            ),
          ),
        if (lineData.isNotEmpty)
          SizedBox(
            height: 200,
            child: LineChart(
              LineChartData(
                lineBarsData: [
                  LineChartBarData(spots: lineData, isCurved: true, color: theme.colorScheme.primary),
                ],
                titlesData: FlTitlesData(
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      getTitlesWidget: (value, _) => Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          DateTime.fromMillisecondsSinceEpoch(value.toInt()).toString().split(' ')[0],
                          style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurface.withOpacity(0.7)),
                        ),
                      ),
                    ),
                  ),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      getTitlesWidget: (value, _) => Text(
                        value.toInt().toString(),
                        style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurface.withOpacity(0.7)),
                      ),
                    ),
                  ),
                ),
                borderData: FlBorderData(show: false),
                gridData: FlGridData(show: true, drawVerticalLine: false),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildFilterDropdown({required String? value, required List<DropdownMenuItem<String>> items, required ValueChanged<String?> onChanged, required String label}) {
    final theme = Theme.of(context);
    return Container(
      width: 160,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: DropdownButtonFormField<String>(
        value: value,
        items: items,
        onChanged: onChanged,
        decoration: InputDecoration(
          labelText: label,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          filled: true,
          fillColor: theme.colorScheme.surface,
        ),
        style: theme.textTheme.bodyMedium,
      ),
    );
  }

  Widget _buildDateFilterButton({required String label, required String value, required VoidCallback onPressed}) {
    final theme = Theme.of(context);
    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        backgroundColor: theme.colorScheme.primary.withOpacity(0.1),
        foregroundColor: theme.colorScheme.primary,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
      child: Text('$label: $value', style: theme.textTheme.bodyMedium),
    );
  }

  Widget _buildKPIs(List<Visit> allVisits, List<Agent> agents, List<Timesheet> timesheets) {
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
      barRods: [BarChartRodData(toY: (e.value['visits'] as int).toDouble(), color: theme.colorScheme.primary)],
    ))
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (barData.isNotEmpty)
          SizedBox(
            height: 200,
            child: BarChart(
              BarChartData(
                barGroups: barData,
                titlesData: FlTitlesData(
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      getTitlesWidget: (value, _) => Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          visitsPerAgent[value.toInt()]['name'] as String,
                          style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurface.withOpacity(0.7)),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                  ),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      getTitlesWidget: (value, _) => Text(
                        value.toInt().toString(),
                        style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurface.withOpacity(0.7)),
                      ),
                    ),
                  ),
                ),
                borderData: FlBorderData(show: false),
                gridData: FlGridData(show: true, drawVerticalLine: false),
              ),
            ),
          ),
      ],
    );
  }
}
