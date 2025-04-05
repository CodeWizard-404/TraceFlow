import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:TraceFlow/providers/auth_provider.dart';
import 'package:TraceFlow/providers/receipt_book_provider.dart';
import 'package:TraceFlow/providers/user_provider.dart';
import 'package:TraceFlow/providers/agent_provider.dart';
import 'package:TraceFlow/providers/receipt_stub_provider.dart';
import 'package:TraceFlow/widgets/appbar/app_bar.dart';
import 'package:TraceFlow/widgets/appbar/sidebar.dart';
import 'package:TraceFlow/widgets/commen/button.dart';
import 'package:TraceFlow/widgets/commen/progress_indicator.dart';
import 'package:TraceFlow/widgets/commen/spacer.dart';
import 'package:TraceFlow/models/receipt_book.dart';
import 'package:TraceFlow/widgets/Receipt/RecipientTypeSelector.dart';
import 'package:TraceFlow/widgets/Receipt/AgentSelector.dart';
import 'package:TraceFlow/widgets/Receipt/UserSelector.dart';
import 'package:TraceFlow/widgets/Receipt/BookScanner.dart';
import 'package:TraceFlow/widgets/Receipt/OtpValidator.dart';
import 'package:TraceFlow/widgets/qr_scanner/qr_scanner_widget.dart';
import 'dart:async';

class TransferReceiptBookScreen extends StatefulWidget {
  final String? initialBookID;
  const TransferReceiptBookScreen({this.initialBookID, super.key});

  @override
  State<TransferReceiptBookScreen> createState() => _TransferReceiptBookScreenState();
}

class _TransferReceiptBookScreenState extends State<TransferReceiptBookScreen> {
  final TextEditingController _otpController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  String? _recipientType;
  String? _recipientID;
  String? _selectedLocation;
  List<String> _selectedBookIDs = [];
  bool _transferInitiated = false;
  String? _error;
  bool _isScannerActive = false;
  Timer? _otpTimer;
  int _otpSecondsRemaining = 600;
  Set<String> _scannedQRCodes = {};
  bool _scanLock = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialBookID != null) _selectedBookIDs.add(widget.initialBookID!);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fetchInitialData();
    });
  }

  Future<void> _fetchInitialData() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final agentProvider = Provider.of<AgentProvider>(context, listen: false);
    final receiptBookProvider = Provider.of<ReceiptBookProvider>(context, listen: false);
    try {
      await Future.wait([
        receiptBookProvider.fetchAndFilterReceiptBooksByHolder(authProvider.user!.userID!, authProvider.token!),
        agentProvider.fetchUniqueLocations(authProvider.token!),
      ]);
      print('Unique locations loaded: ${agentProvider.uniqueLocations.length}');
    } catch (e) {
      setState(() => _error = 'Error loading initial data: $e');
    }
  }

  Future<void> _fetchUsersForRole(String role) async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final userProvider = Provider.of<UserProvider>(context, listen: false);
    try {
      await userProvider.getUsersByRole(role, authProvider.token!);
    } catch (e) {
      setState(() => _error = 'Error loading users for $role: $e');
    }
  }

  bool _isTransferable(ReceiptBook book, String userID, String? recipientType) {
    if (book.currentHolderID != userID) return false;
    switch (recipientType) {
      case "Supervisor":
      case "Regional Manager":
        return ["With Supervisor", "Stub Collected"].contains(book.status);
      case "Stock Manager":
        return book.status == "Stub Collected";
      case "Agent":
        return book.status == "With Supervisor";
      case "Stub Collection":
        return book.status == "Assigned to Agent";
      default:
        return false;
    }
  }

  Future<void> _handleScanSuccess(String decodedText) async {
    if (_scanLock) return;
    _scanLock = true;
    try {
      final receiptBookProvider = Provider.of<ReceiptBookProvider>(context, listen: false);
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final numberLength = int.parse(decodedText.substring(2, 4));
      final number = decodedText.substring(4, 4 + numberLength);
      final typeStart = 4 + numberLength + 2;
      final typeLength = int.parse(decodedText.substring(typeStart, typeStart + 2));
      final type = decodedText.substring(typeStart + 2, typeStart + 2 + typeLength);
      final matchingBook = receiptBookProvider.receiptBooks.firstWhere(
            (r) => r.number == number && r.type == type,
        orElse: () => ReceiptBook(number: '', type: '', status: '', qrCode: ''),
      );

      if (matchingBook.bookID == null) {
        setState(() => _error = 'QR code "$number" not found in receipt books.');
        return;
      }
      if (_scannedQRCodes.contains(decodedText) || _selectedBookIDs.contains(matchingBook.bookID!)) {
        setState(() => _error = 'QR code "$number" has already been scanned.');
        return;
      }
      if (!_isTransferable(matchingBook, authProvider.user!.userID!, _recipientType)) {
        setState(() => _error = 'Book "$number" (status: ${matchingBook.status}) cannot be scanned by you or transferred to $_recipientType.');
        return;
      }
      if (_recipientType == "Agent" && _selectedBookIDs.isNotEmpty) {
        setState(() => _error = "Only one book can be assigned to an Agent.");
        return;
      }
      if (_recipientType == "Stub Collection" && _selectedBookIDs.isNotEmpty) {
        setState(() => _error = "Stub collection can only process one book.");
        return;
      }

      setState(() {
        _selectedBookIDs.add(matchingBook.bookID!);
        _scannedQRCodes.add(decodedText);
        _error = null;
      });
    } catch (err) {
      setState(() => _error = "Invalid QR code format: $err");
    } finally {
      _scanLock = false;
    }
  }

  Future<void> _scanQRCode() async {
    final result = await Navigator.push<String>(
      context,
      MaterialPageRoute(builder: (context) => const QRScannerWidget()),
    );
    if (result != null) await _handleScanSuccess(result);
  }

  void _startOtpTimer() {
    _otpTimer?.cancel();
    _otpSecondsRemaining = 600;
    _otpTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() {
        if (_otpSecondsRemaining > 0) _otpSecondsRemaining--;
        else {
          timer.cancel();
          _error = "OTP has expired. Please initiate the transfer again.";
          _transferInitiated = false;
        }
      });
    });
  }

  Future<void> _initiateTransfer() async {
    if (_selectedBookIDs.isEmpty) {
      setState(() => _error = 'Please select at least one book.');
      return;
    }
    if (_recipientType == null) {
      setState(() => _error = 'Please select a recipient type.');
      return;
    }
    if (_recipientType == "Agent" && _selectedBookIDs.length > 1) {
      setState(() => _error = "Only one book can be assigned to an Agent.");
      return;
    }
    if (_recipientType == "Stub Collection" && _selectedBookIDs.length > 1) {
      setState(() => _error = "Stub collection can only process one book.");
      return;
    }
    if (_recipientType != "Stub Collection" && _recipientID == null) {
      setState(() => _error = "Please select a recipient.");
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final receiptBookProvider = Provider.of<ReceiptBookProvider>(context, listen: false);
    final receiptStubProvider = Provider.of<ReceiptStubProvider>(context, listen: false);
    try {
      if (_recipientType == "Stub Collection") {
        await receiptStubProvider.collectStub(_selectedBookIDs.first, authProvider.token!);
      } else {
        await receiptBookProvider.transferReceiptBooks(
          bookIDs: _selectedBookIDs,
          recipientID: _recipientID!,
          recipientType: _recipientType == "Agent" ? "agent" : "user",
          token: authProvider.token!,
        );
      }
      setState(() {
        _transferInitiated = true;
        _error = null;
        _isScannerActive = false;
      });
      _startOtpTimer();
    } catch (e) {
      setState(() => _error = 'Failed to initiate transfer: $e');
    }
  }

  Future<void> _validateTransfer() async {
    if (_otpController.text.isEmpty) {
      setState(() => _error = 'Please enter the OTP.');
      return;
    }
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final receiptBookProvider = Provider.of<ReceiptBookProvider>(context, listen: false);
    final receiptStubProvider = Provider.of<ReceiptStubProvider>(context, listen: false);

    print('Validating transfer: type=$_recipientType, recipientID=$_recipientID, otp=${_otpController.text}, token=${authProvider.token}');

    try {
      if (_recipientType == "Stub Collection") {
        print('Calling validateStubCollection with bookID=${_selectedBookIDs.first}');
        await receiptStubProvider.validateStubCollection(
          _selectedBookIDs.first,
          _otpController.text,
          authProvider.token ?? '', // Handle null token
        );
      } else {
        if (_recipientID == null) {
          setState(() => _error = 'Recipient ID is null, cannot validate transfer.');
          return;
        }
        print('Calling validateTransfer with bookIDs=$_selectedBookIDs, recipientID=$_recipientID');
        await receiptBookProvider.validateTransfer(
          bookIDs: _selectedBookIDs,
          recipientID: _recipientID!,
          otpCode: _otpController.text,
          recipientType: _recipientType == "Agent" ? "agent" : "user",
          token: authProvider.token ?? '', // Handle null token
        );
      }
      print('Validation successful, popping screen');
      _otpTimer?.cancel();
      Navigator.pop(context);
    } catch (e) {
      print('Validation failed: $e');
      setState(() => _error = 'Failed to validate transfer: $e');
    }
  }

  String _formatTime(int seconds) {
    final minutes = seconds ~/ 60;
    final secs = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    _otpTimer?.cancel();
    _otpController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: CustomAppBar(title: 'Transfer Receipt Books', showBackButton: true),
      drawer: const AppSidebar(),
      body: Builder(
        builder: (BuildContext scaffoldContext) {
          return MultiProvider(
            providers: [
              ChangeNotifierProvider.value(value: Provider.of<ReceiptBookProvider>(context)),
              ChangeNotifierProvider.value(value: Provider.of<AuthProvider>(context)),
              ChangeNotifierProvider.value(value: Provider.of<UserProvider>(context)),
              ChangeNotifierProvider.value(value: Provider.of<AgentProvider>(context)),
              ChangeNotifierProvider.value(value: Provider.of<ReceiptStubProvider>(context)),
            ],
            builder: (context, child) {
              final receiptBookProvider = Provider.of<ReceiptBookProvider>(context);
              final userProvider = Provider.of<UserProvider>(context);
              final agentProvider = Provider.of<AgentProvider>(context);
              final isLoading = receiptBookProvider.isLoading || userProvider.isLoading || agentProvider.isLoading;
              if (isLoading) return const Center(child: CustomProgressIndicator());

              return Padding(
                padding: const EdgeInsets.all(16),
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (!_transferInitiated) ...[
                        RecipientTypeSelector(
                          recipientType: _recipientType,
                          onChanged: (value) async {
                            setState(() {
                              _recipientType = value;
                              _recipientID = null;
                              _selectedLocation = null;
                              _selectedBookIDs.clear();
                              _scannedQRCodes.clear();
                              _phoneController.clear();
                              _error = null;
                              _isScannerActive = false;
                            });
                            if (value != null && value != "Agent" && value != "Stub Collection") {
                              await _fetchUsersForRole(value);
                            }
                          },
                        ),
                        const CustomSpacer(height: 16),
                        if (_recipientType == "Agent")
                          AgentSelector(
                            recipientID: _recipientID,
                            selectedLocation: _selectedLocation,
                            phoneController: _phoneController,
                            onRecipientIDChanged: (value) => setState(() => _recipientID = value),
                            onLocationChanged: (value) async {
                              setState(() => _selectedLocation = value);
                              if (value != null) {
                                await Provider.of<AgentProvider>(context, listen: false)
                                    .fetchAgentsByLocation(value, Provider.of<AuthProvider>(context, listen: false).token!);
                                print('Agents for $value: ${Provider.of<AgentProvider>(context, listen: false).agents.length}');
                              }
                            },
                          ),
                        if (_recipientType != "Agent" && _recipientType != "Stub Collection")
                          UserSelector(
                            recipientType: _recipientType,
                            recipientID: _recipientID,
                            onRecipientIDChanged: (value) => setState(() => _recipientID = value),
                          ),
                        if (_recipientType != null && (_recipientType == "Stub Collection" || _recipientID != null)) ...[
                          const CustomSpacer(height: 16),
                          BookScanner(
                            selectedBookIDs: _selectedBookIDs,
                            error: _error,
                            onScanQR: _scanQRCode,
                            onRemoveBook: (bookID) => setState(() {
                              _selectedBookIDs.remove(bookID);
                              _scannedQRCodes.remove(receiptBookProvider.receiptBooks.firstWhere((b) => b.bookID == bookID).qrCode);
                            }),
                          ),
                          const CustomSpacer(height: 16),
                          CustomButton(
                            label: _recipientType == "Stub Collection" ? 'Initiate Stub Collection' : 'Initiate Transfer',
                            icon: Icons.send,
                            onPressed: _initiateTransfer,
                          ),
                        ],
                      ] else ...[
                        OtpValidator(
                          recipientType: _recipientType,
                          recipientID: _recipientID,
                          otpSecondsRemaining: _otpSecondsRemaining,
                          error: _error,
                          otpController: _otpController,
                          onValidateTransfer: _validateTransfer,
                          formatTime: _formatTime,
                        ),
                      ],
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}