import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:TraceFlow/providers/auth_provider.dart';
import 'package:TraceFlow/providers/receipt_book_provider.dart';
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
import 'package:TraceFlow/widgets/Receipt/BookScanner.dart';
import 'package:TraceFlow/widgets/Receipt/OtpValidator.dart';
import 'package:TraceFlow/widgets/qr_scanner/qr_scanner_widget.dart';
import 'dart:async';

import '../../models/receipt_book_type.dart';

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
        receiptBookProvider.fetchReceiptBooksByHolder(authProvider.user!.userID!),
        receiptBookProvider.fetchAllReceiptBookTypes(),
        agentProvider.fetchUniqueLocations(),
      ]);
    } catch (e) {
      setState(() => _error = 'Error loading initial data: $e');
    }
  }

  bool _isTransferable(ReceiptBook book, String userID, String? recipientType) {
    switch (recipientType) {
      case "Agent":
        return book.currentHolderID == userID && book.status == "With Supervisor";
      case "Stub Collection":
        return book.status == "Assigned to Agent" && book.currentHolderID == userID;
      default:
        return false;
    }
  }

  String _getTypeName(String typeID, ReceiptBookProvider provider) {
    return provider.receiptBookTypes
        .firstWhere((t) => t.typeID == typeID, orElse: () => ReceiptBookType(typeID: '', name: 'Unknown Type'))
        .name;
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
      final typeID = decodedText.substring(typeStart + 2, typeStart + 2 + typeLength);

      if (_recipientType == "Stub Collection") {
        if (_scannedQRCodes.contains(decodedText)) {
          setState(() => _error = 'QR code "$number" already scanned.');
          return;
        }
        await receiptBookProvider.fetchReceiptBookByNumber(number);
        if (receiptBookProvider.currentReceiptBook == null) {
          setState(() => _error = 'Book "$number" not found.');
          return;
        }
        if (!_isTransferable(receiptBookProvider.currentReceiptBook!, authProvider.user!.userID!, _recipientType)) {
          setState(() => _error = 'Book "$number" (status: ${receiptBookProvider.currentReceiptBook!.status}) cannot be collected.');
          return;
        }
        setState(() {
          _selectedBookIDs.add(receiptBookProvider.currentReceiptBook!.bookID!);
          _scannedQRCodes.add(decodedText);
          _error = null;
        });
      } else {
        final matchingBook = receiptBookProvider.receiptBooks.firstWhere(
              (r) => r.number == number && r.typeID == typeID,
          orElse: () => ReceiptBook(bookID: '', number: '', status: '', qrCode: '', typeID: ''),
        );
        if (matchingBook.bookID.isEmpty) {
          setState(() => _error = 'QR code "$number" not found.');
          return;
        }
        if (_scannedQRCodes.contains(decodedText) || _selectedBookIDs.contains(matchingBook.bookID)) {
          setState(() => _error = 'QR code "$number" already scanned.');
          return;
        }
        if (!_isTransferable(matchingBook, authProvider.user!.userID!, _recipientType)) {
          setState(() => _error = 'Book "$number" cannot be transferred to $_recipientType.');
          return;
        }
        setState(() {
          _selectedBookIDs.add(matchingBook.bookID);
          _scannedQRCodes.add(decodedText);
          _error = null;
        });
      }
    } catch (err) {
      setState(() => _error = "Invalid QR code: $err");
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
          _error = "OTP expired. Please retry.";
          _transferInitiated = false;
        }
      });
    });
  }

  Future<void> _initiateTransfer() async {
    if (_selectedBookIDs.isEmpty) {
      setState(() => _error = 'Select at least one book.');
      return;
    }
    if (_recipientType == null) {
      setState(() => _error = 'Select a recipient type.');
      return;
    }
    if (_recipientType == "Agent" && _selectedBookIDs.length > 1) {
      setState(() => _error = "Only one book can be assigned to an agent.");
      return;
    }
    if (_recipientType == "Agent" && _recipientID == null) {
      setState(() => _error = "Select an agent.");
      return;
    }

    final receiptBookProvider = Provider.of<ReceiptBookProvider>(context, listen: false);
    final receiptStubProvider = Provider.of<ReceiptStubProvider>(context, listen: false);
    try {
      if (_recipientType == "Stub Collection") {
        await receiptStubProvider.collectStub(_selectedBookIDs);
      } else {
        await receiptBookProvider.transferReceiptBooks(
          bookIDs: _selectedBookIDs,
          recipientID: _recipientID!,
          recipientType: "agent",
        );
      }
      setState(() {
        _transferInitiated = true;
        _error = null;
        _isScannerActive = false;
      });
      _startOtpTimer();
    } catch (e) {
      setState(() => _error = 'Failed to initiate: $e');
    }
  }

  Future<void> _validateTransfer() async {
    if (_otpController.text.isEmpty) {
      setState(() => _error = 'Enter OTP.');
      return;
    }
    final receiptBookProvider = Provider.of<ReceiptBookProvider>(context, listen: false);
    final receiptStubProvider = Provider.of<ReceiptStubProvider>(context, listen: false);
    try {
      if (_recipientType == "Stub Collection") {
        await receiptStubProvider.validateStubCollection(_selectedBookIDs, _otpController.text);
      } else {
        await receiptBookProvider.validateTransfer(
          bookIDs: _selectedBookIDs,
          recipientID: _recipientID!,
          otpCode: _otpController.text,
          recipientType: "agent",
        );
      }
      _otpTimer?.cancel();
      Navigator.pushNamed(context, '/receipt-books');
    } catch (e) {
      setState(() => _error = 'Validation failed: $e');
    }
  }

  String _formatTime(int seconds) {
    final minutes = seconds ~/ 60;
    final secs = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  Future<void> _onRefresh() async {
    setState(() {
      _recipientType = null;
      _recipientID = null;
      _selectedLocation = null;
      _selectedBookIDs.clear();
      _scannedQRCodes.clear();
      _phoneController.clear();
      _error = null;
      _isScannerActive = false;
      _transferInitiated = false;
    });
    await _fetchInitialData();
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
      body: MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: Provider.of<ReceiptBookProvider>(context)),
          ChangeNotifierProvider.value(value: Provider.of<AuthProvider>(context)),
          ChangeNotifierProvider.value(value: Provider.of<AgentProvider>(context)),
          ChangeNotifierProvider.value(value: Provider.of<ReceiptStubProvider>(context)),
        ],
        builder: (context, child) {
          final receiptBookProvider = Provider.of<ReceiptBookProvider>(context);
          final agentProvider = Provider.of<AgentProvider>(context);
          final isLoading = receiptBookProvider.isLoading || agentProvider.isLoading;
          if (isLoading) return const Center(child: CustomProgressIndicator());

          return RefreshIndicator(
            onRefresh: _onRefresh,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (!_transferInitiated) ...[
                      RecipientTypeSelector(
                        recipientType: _recipientType,
                        onChanged: (value) {
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
                              await Provider.of<AgentProvider>(context, listen: false).fetchAgentsByLocation(value);
                            }
                          },
                        ),
                      if (_recipientType != null && (_recipientType == "Stub Collection" || _recipientID != null)) ...[
                        const CustomSpacer(height: 16),
                        BookScanner(
                          selectedBookIDs: _selectedBookIDs,
                          error: _error,
                          recipientType: _recipientType,
                          onScanQR: _scanQRCode,
                          onRemoveBook: (bookID) => setState(() {
                            _selectedBookIDs.remove(bookID);
                            _scannedQRCodes.removeWhere((qr) => qr.contains(bookID));
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
            ),
          );
        },
      ),
    );
  }
}
