import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/agent.dart';
import '../../models/visit.dart';
import '../../providers/agent_provider.dart';
import '../../services/visits_service.dart';
import '../../widgets/qr_scanner_widget.dart';
import '../Error.dart';
import 'log_visit_screen.dart';

class VisitDetailsScreen extends StatelessWidget {
  final Visit visit;

  const VisitDetailsScreen({required this.visit, super.key});

  @override
  Widget build(BuildContext context) {
    Future.microtask(() {
      debugPrint("Visit Details: ${visit.toJson()}");
    });

    final agentProvider = Provider.of<AgentProvider>(context, listen: false);

    return Scaffold(
      backgroundColor: Colors.grey[50],
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 200,
            floating: true,
            pinned: true,
            leading: IconButton(
              icon: Icon(
                Icons.arrow_back_ios_rounded,
                color: Colors.white, // Set the color to white
              ),
              onPressed: () => Navigator.of(context).pop(),
            ),
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF4CB1C7), Color(0xFF64C9D1)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.2),
                      blurRadius: 20,
                      offset: Offset(0, 4),
                    ),
                  ],
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(30),
                    bottomRight: Radius.circular(30),
                  ),
                ),
                child: SafeArea(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                'Visit Details',
                                style: TextStyle(
                                  fontSize: 28,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                  shadows: [Shadow(color: Colors.black26, blurRadius: 4, offset: Offset(0, 2))],
                                ),
                              ),
                              SizedBox(height: 16),
                              Row(
                                children: [
                                  Container(
                                    padding: EdgeInsets.all(6),
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: Colors.white.withOpacity(0.2),
                                    ),
                                    child: Icon(Icons.location_on, color: Colors.white, size: 20),
                                  ),
                                  SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      visit.location ?? 'N/A',
                                      style: TextStyle(fontSize: 16, color: Colors.white, fontWeight: FontWeight.w500),
                                    ),
                                  ),
                                ],
                              ),
                              SizedBox(height: 12),
                              Row(
                                children: [
                                  Container(
                                    padding: EdgeInsets.all(6),
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: Colors.white.withOpacity(0.2),
                                    ),
                                    child: Icon(Icons.access_time, color: Colors.white, size: 20),
                                  ),
                                  SizedBox(width: 12),
                                  Text(
                                    '${visit.date?.day}/${visit.date?.month}/${visit.date?.year} - ${visit.time}',
                                    style: TextStyle(fontSize: 16, color: Colors.white, fontWeight: FontWeight.w500),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        if (visit.status == "visited")
                          _buildDurationClock(visit.duration ?? 0),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          SliverPadding(
            padding: EdgeInsets.all(16),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                FutureBuilder<Agent>(
                  future: agentProvider.fetchAgentById(visit.agentID!),
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return Center(child: CircularProgressIndicator());
                    }
                    if (snapshot.hasError) {
                      return _buildGlassCard(
                        title: 'Agent Information',
                        icon: Icons.person,
                        content: [
                          Text(
                            'Error loading agent data',
                            style: TextStyle(color: Colors.red),
                          ),
                        ],
                      );
                    }
                    if (!snapshot.hasData) {
                      return _buildGlassCard(
                        title: 'Agent Information',
                        icon: Icons.person,
                        content: [
                          Text('No agent data available'),
                        ],
                      );
                    }

                    final agent = snapshot.data!;
                    return _buildGlassCard(
                      title: 'Agent Information',
                      icon: Icons.person,
                      content: [
                        _buildDetailRow('Name:', '${agent.name} ${agent.lastname}'),
                        _buildDetailRow('Phone:', agent.phone ?? 'N/A'),
                        _buildDetailRow(
                          'Status:',
                          visit.status ?? 'N/A',
                          statusColor: _getStatusColor(visit.status),
                        ),
                      ],
                    );
                  },
                ),
                SizedBox(height: 16),
                _buildGlassCard(
                  title: 'Checklists',
                  icon: Icons.checklist,
                  content: [
                    if (visit.checklists == null || visit.checklists!.isEmpty)
                      Text(
                        'No checklists available',
                        style: TextStyle(fontSize: 14, color: Colors.grey[600], fontWeight: FontWeight.w500),
                      )
                    else
                      ...visit.checklists!.map(
                            (checklist) => _buildChecklistRow(
                          checklist.item ?? 'N/A',
                          checklist.visitChecklist?.checked ?? false,
                        ),
                      ),
                  ],
                ),
                SizedBox(height: 16),
                _buildGlassCard(
                  title: 'Reasons',
                  icon: Icons.notes,
                  content: [
                    if (visit.reasons == null || visit.reasons!.isEmpty)
                      Text(
                        'No reasons provided',
                        style: TextStyle(fontSize: 14, color: Colors.grey[600], fontWeight: FontWeight.w500),
                      )
                    else
                      ...visit.reasons!.map(
                            (reason) => _buildDetailRow('•', reason.item ?? 'N/A'),
                      ),
                  ],
                ),
                SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _buildActionButton(
                      icon: Icons.edit,
                      label: 'Edit Visit',
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const ErrorPage(errorMessage: 'Page not available yet'),
                          ),
                        );
                      },
                    ),
                    _buildActionButton(
                      icon: Icons.check_circle,
                      label: 'Log Visit',
                      gradientColors: [Color(0xFFE81F76), Color(0xFFF06292)],
                      onPressed: () async {
                        if (visit.date == null) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Visit date is missing. Cannot log visit.'),
                              backgroundColor: Colors.red.withOpacity(0.9),
                              behavior: SnackBarBehavior.floating,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          );
                          return;
                        }

                        // Open QR Scanner
                        final scannedData = await Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => QRScannerWidget()),
                        );

                        if (scannedData != null) {
                          final verificationResult = await VisitService.verifyQRCode(
                            qrData: scannedData,
                            visitId: visit.visitID!,
                          );

                          if (verificationResult['valid'] == true) {
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
                              SnackBar(
                                content: Text(verificationResult['message'] ?? 'Invalid QR code'),
                                backgroundColor: Colors.red.withOpacity(0.9),
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

  Widget _buildDurationClock(int duration) {
    return Container(
      padding: EdgeInsets.all(12),
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
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white.withOpacity(0.2)),
                ),
              ),
              Icon(
                Icons.timer,
                color: Colors.white,
                size: 28,
              ),
            ],
          ),
          Text(
            '$duration',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          Text(
            'min',
            style: TextStyle(
              fontSize: 12,
              color: Colors.white.withOpacity(0.8),
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGlassCard({required String title, required IconData icon, required List<Widget> content}) {
    return AnimatedContainer(
      duration: Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.white.withOpacity(0.9),
            Colors.grey[50]!.withOpacity(0.9),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0xFF4CB1C7).withOpacity(0.1),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Color(0xFF4CB1C7).withOpacity(0.1),
                  ),
                  child: Icon(icon, color: Color(0xFF4CB1C7), size: 20),
                ),
                SizedBox(width: 12),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF4CB1C7),
                    shadows: [Shadow(color: Colors.black12, blurRadius: 2)],
                  ),
                ),
              ],
            ),
            SizedBox(height: 16),
            ...content,
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {Color? statusColor}) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: Colors.grey[700],
            ),
          ),
          SizedBox(width: 12),
          Expanded(
            child: statusColor != null
                ? Container(
              padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: LinearGradient(
                  colors: [
                    statusColor.withOpacity(0.2),
                    statusColor.withOpacity(0.1),
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: statusColor.withOpacity(0.2),
                    blurRadius: 8,
                    offset: Offset(0, 2),
                  ),
                ],
              ),
              child: Text(
                value,
                style: TextStyle(
                  fontSize: 14,
                  color: statusColor,
                  fontWeight: FontWeight.bold,
                ),
              ),
            )
                : Text(
              value,
              style: TextStyle(
                fontSize: 14,
                color: Colors.black87,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChecklistRow(String item, bool isChecked) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Container(
            padding: EdgeInsets.all(4),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isChecked ? Colors.green.withOpacity(0.1) : Colors.grey.withOpacity(0.1),
            ),
            child: Icon(
              isChecked ? Icons.check_circle : Icons.radio_button_unchecked,
              color: isChecked ? Colors.green : Colors.grey,
              size: 18,
            ),
          ),
          SizedBox(width: 12),
          Expanded(
            child: Text(
              item,
              style: TextStyle(
                fontSize: 14,
                color: Colors.black87,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required VoidCallback onPressed,
    List<Color> gradientColors = const [Color(0xFF4CB1C7), Color(0xFF64C9D1)],
  }) {
    return GestureDetector(
      onTap: onPressed,
      child: AnimatedContainer(
        duration: Duration(milliseconds: 300),
        curve: Curves.easeInOut,
        padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: gradientColors,
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: gradientColors[0].withOpacity(0.4),
              blurRadius: 12,
              offset: Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: Colors.white, size: 20),
            SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 16,
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color? _getStatusColor(String? status) {
    switch (status?.toLowerCase()) {
      case 'visited':
        return Colors.green;
      case 'pending':
        return Colors.orange;
      case 'rejected':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  int _getWeekNumber(DateTime date) {
    final startOfYear = DateTime(date.year, 1, 1);
    return (date.difference(startOfYear).inDays / 7).ceil();
  }
}