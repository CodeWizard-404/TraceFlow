import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:TraceFlow/providers/agent_provider.dart';
import 'package:TraceFlow/providers/receipt_book_provider.dart';
import 'package:TraceFlow/providers/user_provider.dart';
import 'package:TraceFlow/widgets/commen/progress_indicator.dart';
import 'package:TraceFlow/widgets/commen/spacer.dart';
import 'package:TraceFlow/widgets/commen/text_field.dart';
import '../../models/receipt_book_type.dart';
import '../../providers/auth_provider.dart';
import '../commen/dropdown.dar.dart';

class TransferForm extends StatelessWidget {
  final String? recipientType;
  final String? recipientID;
  final String? selectedLocation;
  final List<String> selectedBookIDs;
  final bool transferInitiated;
  final String? error;
  final bool isScannerActive;
  final int otpSecondsRemaining;
  final Set<String> scannedQRCodes;
  final TextEditingController otpController;
  final TextEditingController searchController;
  final TextEditingController phoneController;
  final void Function(String?) onRecipientTypeChanged;
  final void Function(String?) onRecipientIDChanged;
  final Future<void> Function(String?) onLocationChanged;
  final Future<void> Function() onScanQR;
  final void Function(String) onRemoveBook;
  final Future<void> Function() onInitiateTransfer;
  final Future<void> Function() onValidateTransfer;
  final String Function(int) formatTime;

  const TransferForm({
    required this.recipientType,
    required this.recipientID,
    required this.selectedLocation,
    required this.selectedBookIDs,
    required this.transferInitiated,
    required this.error,
    required this.isScannerActive,
    required this.otpSecondsRemaining,
    required this.scannedQRCodes,
    required this.otpController,
    required this.searchController,
    required this.phoneController,
    required this.onRecipientTypeChanged,
    required this.onRecipientIDChanged,
    required this.onLocationChanged,
    required this.onScanQR,
    required this.onRemoveBook,
    required this.onInitiateTransfer,
    required this.onValidateTransfer,
    required this.formatTime,
    super.key,
  });

  String _getTypeName(String typeID, ReceiptBookProvider provider) {
    return provider.receiptBookTypes
        .firstWhere((t) => t.typeID == typeID, orElse: () => ReceiptBookType(typeID: '', name: 'Unknown Type'))
        .name;
  }

  String? _mapRecipientTypeToRole(String? recipientType) {
    switch (recipientType) {
      case 'Regional Manager':
        return 'Regional manager';
      case 'Supervisor':
        return 'Supervisor';
      case 'Stock Manager':
        return 'Stock manager';
      default:
        return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final receiptBookProvider = Provider.of<ReceiptBookProvider>(context);
    final userProvider = Provider.of<UserProvider>(context);
    final agentProvider = Provider.of<AgentProvider>(context);
    const recipientOptions = [
      "Agent",
      "Stub Collection",
      "Regional Manager",
      "Supervisor",
      "Stock Manager",
    ];

    // Fetch users by role when recipientType changes
    final role = _mapRecipientTypeToRole(recipientType);
    if (role != null && !userProvider.isLoading && userProvider.users.isEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        userProvider.getUsersByRole(role);
      });
    }

    final filteredAgents = agentProvider.agents.where((a) =>
    (a.name.toLowerCase().contains(searchController.text.toLowerCase()) ||
        a.lastname.toLowerCase().contains(searchController.text.toLowerCase()) ||
        a.phone?.contains(searchController.text) == true)).toList();

    return Padding(
      padding: const EdgeInsets.all(16),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (!transferInitiated) ...[
              CustomDropdown<String>(
                value: recipientType,
                items: recipientOptions,
                hint: 'Select Recipient Type',
                onChanged: (value) {
                  onRecipientTypeChanged(value);
                  // Clear users and fetch new ones for the selected role
                  if (value != null) {
                    final newRole = _mapRecipientTypeToRole(value);
                    if (newRole != null) {
                      userProvider.getUsersByRole(newRole);
                    }
                  }
                },
              ),
              const CustomSpacer(height: 16),
              if (recipientType != null) ...[
                if (recipientType == "Agent") ...[
                  CustomTextField(
                    controller: phoneController,
                    label: 'Agent Phone Number',
                    keyboardType: TextInputType.phone,
                  ),
                  const CustomSpacer(height: 16),
                  FutureBuilder(
                    future: phoneController.text.length >= 10
                        ? agentProvider.fetchAgentByPhone(phoneController.text)
                        : Future.value(),
                    builder: (context, snapshot) {
                      if (phoneController.text.length >= 10 &&
                          snapshot.connectionState == ConnectionState.waiting) {
                        return const CustomProgressIndicator();
                      }
                      if (snapshot.hasError) {
                        if (snapshot.error.toString().contains('401')) {
                          Provider.of<AuthProvider>(context, listen: false).logout();
                          Navigator.pushReplacementNamed(context, '/login');
                          return const SizedBox.shrink();
                        }
                        return const Text('No agent found.', style: TextStyle(color: Colors.red));
                      }
                      if (agentProvider.currentAgent != null) {
                        onRecipientIDChanged(agentProvider.currentAgent!.agentID);
                        return Text(
                            'Selected Agent: ${agentProvider.currentAgent!.name} ${agentProvider.currentAgent!.lastname}');
                      }
                      return Column(
                        children: [
                          const Text('OR',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                          const CustomSpacer(height: 8),
                          CustomDropdown<String>(
                            value: selectedLocation,
                            items: agentProvider.uniqueLocations,
                            hint: 'Select Location',
                            onChanged: onLocationChanged,
                          ),
                          if (selectedLocation != null) ...[
                            const CustomSpacer(height: 16),
                            CustomTextField(
                              controller: searchController,
                              label: 'Search Agents (Name, Lastname, Phone)',
                            ),
                            const CustomSpacer(height: 16),
                            CustomDropdown<String>(
                              value: recipientID,
                              items: filteredAgents.map((a) => a.agentID).toList(),
                              hint: 'Select Agent',
                              itemToString: (id) =>
                              '${filteredAgents.firstWhere((a) => a.agentID == id).name} ${filteredAgents.firstWhere((a) => a.agentID == id).lastname} (${filteredAgents.firstWhere((a) => a.agentID == id).phone})',
                              onChanged: onRecipientIDChanged,
                            ),
                          ],
                        ],
                      );
                    },
                  ),
                ],
                if (recipientType != "Agent" && recipientType != "Stub Collection") ...[
                  if (userProvider.isLoading) ...[
                    const CustomProgressIndicator(),
                  ] else if (userProvider.errorMessage != null) ...[
                    Text(userProvider.errorMessage!, style: const TextStyle(color: Colors.red)),
                  ] else ...[
                    CustomTextField(
                      controller: searchController,
                      label: 'Search $recipientType (Name, Lastname, Phone)',
                    ),
                    const CustomSpacer(height: 16),
                    CustomDropdown<String>(
                      value: recipientID,
                      items: userProvider.users.map((u) => u.userID!).toList(),
                      hint: 'Select $recipientType',
                      itemToString: (id) =>
                      '${userProvider.users.firstWhere((u) => u.userID == id).firstName} ${userProvider.users.firstWhere((u) => u.userID == id).lastName} (${userProvider.users.firstWhere((u) => u.userID == id).phone})',
                      onChanged: onRecipientIDChanged,
                    ),
                  ],
                ],
                if (recipientType == "Stub Collection" || recipientID != null) ...[
                  const CustomSpacer(height: 16),
                  Text('Selected Books (${selectedBookIDs.length}):',
                      style: theme.textTheme.titleMedium),
                  ...selectedBookIDs.map((bookID) {
                    final book =
                    receiptBookProvider.receiptBooks.firstWhere((b) => b.bookID == bookID);
                    return ListTile(
                      title: Text('Receipt #${book.number}'),
                      subtitle: Text('Type: ${_getTypeName(book.typeID, receiptBookProvider)} | Status: ${book.status}'),
                      trailing: IconButton(
                        icon: const Icon(Icons.remove_circle, color: Colors.red),
                        onPressed: () => onRemoveBook(bookID),
                      ),
                    );
                  }),
                  if (error != null) ...[
                    const CustomSpacer(height: 16),
                    Text(error!, style: const TextStyle(color: Colors.red)),
                  ],
                  const CustomSpacer(height: 24),
                  Card(
                    elevation: 4,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          ElevatedButton.icon(
                            onPressed: onScanQR,
                            icon: const Icon(Icons.qr_code_scanner, size: 24),
                            label: const Text('Scan QR Code', style: TextStyle(fontSize: 16)),
                            style: ElevatedButton.styleFrom(
                              foregroundColor: theme.colorScheme.primary,
                              backgroundColor: theme.colorScheme.primary,
                              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              elevation: 2,
                            ),
                          ),
                          const SizedBox(height: 12),
                          ElevatedButton.icon(
                            onPressed: onInitiateTransfer,
                            icon: const Icon(Icons.send, size: 24),
                            label: Text(
                              recipientType == "Stub Collection"
                                  ? 'Initiate Stub Collection'
                                  : 'Initiate Transfer',
                              style: const TextStyle(fontSize: 16),
                            ),
                            style: ElevatedButton.styleFrom(
                              foregroundColor: theme.colorScheme.primary,
                              backgroundColor: theme.colorScheme.primary,
                              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              elevation: 2,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ] else ...[
              Text(
                'OTP expires in: ${formatTime(otpSecondsRemaining)}',
                style: TextStyle(
                    color: otpSecondsRemaining <= 30 ? Colors.red : null, fontSize: 16),
              ),
              const CustomSpacer(height: 16),
              CustomTextField(
                controller: otpController,
                label: 'Enter OTP',
                keyboardType: TextInputType.number,
              ),
              if (error != null) ...[
                const CustomSpacer(height: 16),
                Text(error!, style: const TextStyle(color: Colors.red)),
              ],
              const CustomSpacer(height: 24),
              Card(
                elevation: 4,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: ElevatedButton.icon(
                    onPressed: onValidateTransfer,
                    icon: const Icon(Icons.check, size: 24),
                    label: Text(
                      recipientType == "Stub Collection"
                          ? 'Validate Stub Collection'
                          : 'Validate Transfer',
                      style: const TextStyle(fontSize: 16),
                    ),
                    style: ElevatedButton.styleFrom(
                      foregroundColor: theme.colorScheme.primary,
                      backgroundColor: theme.colorScheme.primary,
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      elevation: 2,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}