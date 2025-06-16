import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'dart:async';
import 'dart:developer' as developer;

import '../../models/agent.dart';
import '../../models/receipt_book.dart';
import '../../models/receipt_book_type.dart';
import '../../models/user.dart';
import '../../providers/agent_provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/location_provider.dart';
import '../../providers/receipt_book_provider.dart';
import '../../providers/receipt_stub_provider.dart';
import '../../providers/user_provider.dart';
import '../../services/location_service.dart';
import '../../widgets/appbar/app_bar.dart';
import '../../widgets/appbar/sidebar.dart';
import '../../widgets/commen/button.dart';
import '../../widgets/commen/snack_bar.dar.dart';
import '../../widgets/commen/spacer.dart';
import '../../widgets/Receipt/RecipientTypeSelector.dart';
import '../../widgets/Receipt/BookScanner.dart';
import '../../widgets/Receipt/OtpValidator.dart';
import '../../widgets/Receipt/UserSelector.dart';
import '../../widgets/qr_scanner/qr_scanner_widget.dart';

class TransferReceiptBookScreen extends StatefulWidget {
  final String? initialBookID;
  const TransferReceiptBookScreen({this.initialBookID, super.key});

  @override
  State<TransferReceiptBookScreen> createState() => _TransferReceiptBookScreenState();
}

class _TransferReceiptBookScreenState extends State<TransferReceiptBookScreen> {
  final TextEditingController _otpController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  String? _recipientType;
  String? _recipientID;
  String? _selectedRegionId;
  String? _selectedGovernorateId;
  String? _selectedDelegationId;
  List<String> _selectedBookIDs = [];
  bool _transferInitiated = false;
  String? _error;
  bool _isScannerActive = false;
  Timer? _otpTimer;
  int _otpSecondsRemaining = 600;
  Set<String> _scannedQRCodes = {};
  bool _scanLock = false;
  List<dynamic> _regions = [];
  Map<String, dynamic>? _selectedGovernorate;
  Map<String, dynamic>? _selectedDelegation;
  bool _isLoading = false;
  String? _phoneError;
  String? _transferOtpID;

  @override
  void initState() {
    super.initState();
    if (widget.initialBookID != null) _selectedBookIDs.add(widget.initialBookID!);
    WidgetsBinding.instance.addPostFrameCallback((_) => _fetchInitialData());
  }

  Future<void> _fetchInitialData() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final agentProvider = Provider.of<AgentProvider>(context, listen: false);
    final receiptBookProvider = Provider.of<ReceiptBookProvider>(context, listen: false);
    final userProvider = Provider.of<UserProvider>(context, listen: false);
    final locationProvider = Provider.of<LocationProvider>(context, listen: false);
    setState(() => _isLoading = true);
    try {
      final supervisorID = authProvider.user!.userID;
      final regionalManager = await userProvider.getRegionalManagerBySupervisor(supervisorID);
      final regionalManagerID = regionalManager.userID;
      if (regionalManagerID != null) {
        await locationProvider.getRegionsByUser(regionalManagerID);
      } else {
        await locationProvider.getAllRegions();
      }
      _regions = locationProvider.regions;
      await Future.wait([
        receiptBookProvider.fetchReceiptBooksByHolder(authProvider.user!.userID!),
        receiptBookProvider.fetchAllReceiptBookTypes(),
      ]);
    } catch (e) {
      setState(() => _error = 'Error loading initial data: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  bool _isTransferable(ReceiptBook book, String userID, String? recipientType) {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final supervisorID = authProvider.user!.userID;

    // Validate currentHolderID matches supervisorID for transmission
    if (recipientType != "Stub Collection" && book.currentHolderID != supervisorID) {
      return false;
    }

    // Status validation
    final validStatuses = [
      "With Supervisor",
      "Stub Collected",
      "Assigned to Agent",
    ];
    final isValidStatus = validStatuses.contains(book.status);

    // Specific validations per recipient type
    if (recipientType == "Agent") {
      return book.status == "With Supervisor";
    } else if (recipientType == "Stub Collection") {
      return book.status == "Assigned to Agent" && book.agentID != null;
    } else if (recipientType == "Stock Manager") {
      return book.status == "Stub Collected";
    } else if (recipientType == "Regional Manager" || recipientType == "Supervisor") {
      return isValidStatus;
    }
    return false;
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
      final typeIDFromQR = decodedText.substring(typeStart + 2, typeStart + 2 + typeLength);

      String? mappedTypeID;
      final matchingType = receiptBookProvider.receiptBookTypes.firstWhere(
            (t) => t.name.toLowerCase() == typeIDFromQR.toLowerCase() || t.typeID == typeIDFromQR,
        orElse: () => ReceiptBookType(typeID: '', name: ''),
      );
      if (matchingType.typeID.isNotEmpty) {
        mappedTypeID = matchingType.typeID;
      } else {
        setState(() => _error = 'Invalid typeID in QR code: $typeIDFromQR');
        _showSnackBar('Invalid typeID in QR code: $typeIDFromQR');
        return;
      }

      if (_recipientType == "Stub Collection") {
        if (_scannedQRCodes.contains(decodedText)) {
          setState(() => _error = 'QR code "$number" already scanned.');
          _showSnackBar('QR code "$number" already scanned.');
          return;
        }
        await receiptBookProvider.fetchReceiptBookByNumber(number);
        if (receiptBookProvider.currentReceiptBook == null) {
          setState(() => _error = 'Book "$number" not found.');
          _showSnackBar('Book "$number" not found.');
          return;
        }
        if (!_isTransferable(receiptBookProvider.currentReceiptBook!, authProvider.user!.userID!, _recipientType)) {
          setState(() => _error = 'Book "$number" (status: ${receiptBookProvider.currentReceiptBook!.status}) cannot be collected.');
          _showSnackBar('Book "$number" cannot be collected.');
          return;
        }
        setState(() {
          _selectedBookIDs.add(receiptBookProvider.currentReceiptBook!.bookID!);
          _scannedQRCodes.add(decodedText);
          _error = null;
        });
        _showSnackBar('Book "$number" added successfully.');
      } else {
        final matchingBook = receiptBookProvider.receiptBooks.firstWhere(
              (r) => r.number == number && r.typeID == mappedTypeID,
          orElse: () => ReceiptBook(bookID: '', number: '', status: '', qrCode: '', typeID: ''),
        );
        if (matchingBook.bookID.isEmpty) {
          setState(() => _error = 'QR code "$number" not found.');
          _showSnackBar('QR code "$number" not found.');
          return;
        }
        if (_scannedQRCodes.contains(decodedText) || _selectedBookIDs.contains(matchingBook.bookID)) {
          setState(() => _error = 'QR code "$number" already scanned.');
          _showSnackBar('QR code "$number" already scanned.');
          return;
        }
        if (!_isTransferable(matchingBook, authProvider.user!.userID!, _recipientType)) {
          setState(() => _error = 'Book "$number" cannot be transferred to $_recipientType.');
          _showSnackBar('Book "$number" cannot be transferred to $_recipientType.');
          return;
        }
        setState(() {
          _selectedBookIDs.add(matchingBook.bookID);
          _scannedQRCodes.add(decodedText);
          _error = null;
        });
        _showSnackBar('Book "$number" added successfully.');
      }
    } catch (err) {
      setState(() => _error = "Invalid QR code: $err");
      _showSnackBar("Invalid QR code: $err");
    } finally {
      _scanLock = false;
      if (_isScannerActive) {
        _continueScanning();
      }
    }
  }

  Future<void> _continueScanning() async {
    if (!_isScannerActive) return;
    final result = await Navigator.push<String>(
      context,
      MaterialPageRoute(builder: (context) => const QRScannerWidget()),
    );
    if (result != null) {
      await _handleScanSuccess(result);
    } else {
      setState(() => _isScannerActive = false);
    }
  }

  Future<void> _scanQRCode() async {
    setState(() => _isScannerActive = true);
    await _continueScanning();
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
      _showSnackBar('Select at least one book.');
      return;
    }
    if (_recipientType == null) {
      setState(() => _error = 'Select a recipient type.');
      _showSnackBar('Select a recipient type.');
      return;
    }
    if (_recipientType == "Agent" && _recipientID == null) {
      setState(() => _error = "Select an agent.");
      _showSnackBar('Select an agent.');
      return;
    }

    final receiptBookProvider = Provider.of<ReceiptBookProvider>(context, listen: false);
    final receiptStubProvider = Provider.of<ReceiptStubProvider>(context, listen: false);

    // Map frontend recipientType to backend-compatible values
    String backendRecipientType;
    switch (_recipientType) {
      case "Agent":
        backendRecipientType = "agent";
        break;
      case "Stub Collection":
        backendRecipientType = "stub_collection";
        break;
      case "Regional Manager":
      case "Supervisor":
      case "Stock Manager":
        backendRecipientType = "user";
        break;
      default:
        setState(() => _error = 'Invalid recipient type.');
        _showSnackBar('Invalid recipient type.');
        return;
    }

    try {
      setState(() => _isLoading = true);
      if (_recipientType == "Stub Collection") {
        await receiptStubProvider.collectStub(_selectedBookIDs);
      } else {
        final response = await receiptBookProvider.transferReceiptBooks(
          bookIDs: _selectedBookIDs,
          recipientID: _recipientID!,
          recipientType: backendRecipientType,
        );
        _transferOtpID = response['otpID']; // Store OTP ID
      }
      setState(() {
        _transferInitiated = true;
        _error = null;
        _isScannerActive = false;
      });
      _startOtpTimer();
      _showSnackBar('Transfer initiated successfully.');
    } catch (e) {
      final errorMessage = 'Failed to initiate transfer: $e';
      if (kDebugMode) print(errorMessage);
      setState(() => _error = errorMessage);
      _showSnackBar(errorMessage);
    } finally {
      setState(() => _isLoading = false);
    }
  }


  Future<void> _validateTransfer() async {
    if (_otpController.text.isEmpty) {
      setState(() => _error = 'Enter OTP.');
      _showSnackBar('Enter OTP.');
      return;
    }
    if (_transferOtpID == null) {
      setState(() => _error = 'Transfer not initiated.');
      _showSnackBar('Transfer not initiated. Please initiate transfer first.');
      return;
    }

    final receiptBookProvider = Provider.of<ReceiptBookProvider>(context, listen: false);
    final receiptStubProvider = Provider.of<ReceiptStubProvider>(context, listen: false);

    // Map frontend recipientType to backend-compatible values
    String backendRecipientType;
    switch (_recipientType) {
      case "Agent":
        backendRecipientType = "agent";
        break;
      case "Stub Collection":
        backendRecipientType = "stub_collection";
        break;
      case "Regional Manager":
      case "Supervisor":
      case "Stock Manager":
        backendRecipientType = "user";
        break;
      default:
        setState(() => _error = 'Invalid recipient type.');
        _showSnackBar('Invalid recipient type.');
        return;
    }

    try {
      setState(() => _isLoading = true);
      if (_recipientType == "Stub Collection") {
        await receiptStubProvider.validateStubCollection(_selectedBookIDs, _otpController.text);
      } else {
        await receiptBookProvider.validateTransfer(
          bookIDs: _selectedBookIDs,
          recipientID: _recipientID!,
          otpCode: _otpController.text,
          recipientType: backendRecipientType,
          otpID: _transferOtpID!, // Pass otpID
        );
      }
      _otpTimer?.cancel();
      setState(() {
        _transferOtpID = null; // Clear OTP ID after validation
        _transferInitiated = false;
      });
      Navigator.pushNamed(context, '/receipt-books');
      _showSnackBar('Transfer validated successfully.');
    } catch (e) {
      setState(() => _error = 'Error validating transfer: $e');
      _showSnackBar('Error processing transfer: $e');
    } finally {
      setState(() => _isLoading = false);
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
      _selectedRegionId = null;
      _selectedGovernorateId = null;
      _selectedDelegationId = null;
      _selectedBookIDs.clear();
      _scannedQRCodes.clear();
      _phoneController.clear();
      _error = null;
      _isScannerActive = false;
      _transferInitiated = false;
      _phoneError = null;
    });
    await _fetchInitialData();
  }

  Future<void> _onPhoneChanged(String value, AgentProvider agentProvider) async {
    setState(() {
      _phoneController.text = value;
      _phoneError = null;
    });
    if (value.isEmpty) {
      setState(() {
        _recipientID = null;
        _selectedRegionId = null;
        _selectedGovernorateId = null;
        _selectedDelegationId = null;
        _phoneError = null;
      });
      return;
    }
    if (value.length >= 8) {
      setState(() => _isLoading = true);
      try {
        final authProvider = Provider.of<AuthProvider>(context, listen: false);
        final agent = await agentProvider.fetchAgentByPhone(value);
        if (agent != null) {
          await agentProvider.getAgentsByUser(authProvider.user!.userID);
          final supervisorAgents = agentProvider.agents;
          if (supervisorAgents.any((a) => a.agentID == agent.agentID)) {
            setState(() {
              _recipientID = agent.agentID;
              _selectedDelegationId = agent.delegationID;
              _phoneError = null;
            });
            final locationDetails = await LocationService.getLocationDetailsById(agent.delegationID!);
            if (locationDetails['success'] == true && locationDetails.containsKey('address')) {
              setState(() {
                _selectedRegionId = locationDetails['regionID'] as String?;
                _selectedGovernorateId = locationDetails['governorateID'] as String?;
              });
            } else {
              setState(() => _phoneError = 'Invalid location data for agent');
            }
          } else {
            setState(() {
              _phoneError = 'Agent not assigned to supervisor';
              _recipientID = null;
              _selectedDelegationId = null;
            });
          }
        } else {
          setState(() {
            _phoneError = 'Agent not found';
            _recipientID = null;
            _selectedDelegationId = null;
          });
        }
      } catch (e) {
        setState(() {
          _phoneError = 'Error fetching agent: $e';
          _recipientID = null;
          _selectedDelegationId = null;
        });
      } finally {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _showLocationDialog(BuildContext context, String type) async {
    final locationProvider = Provider.of<LocationProvider>(context, listen: false);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    List<dynamic> items;
    String? selectedValue;

    switch (type) {
      case 'region':
        items = _regions;
        selectedValue = _selectedRegionId;
        break;
      case 'governorate':
        final regionGovs = await LocationService.getGovernoratesByRegion(_selectedRegionId!);
        final supervisorGovs = await LocationService.getGovernoratesByUser(authProvider.user!.userID);
        items = regionGovs.where((g) => supervisorGovs.any((sg) => sg['governorateID'] == g['governorateID'])).toList();
        selectedValue = _selectedGovernorateId;
        break;
      case 'delegation':
        final govDels = await LocationService.getDelegationsByGovernorate(_selectedGovernorateId!);
        final supervisorDels = await LocationService.getDelegationsByUser(authProvider.user!.userID);
        items = govDels.where((d) => supervisorDels.any((sd) => sd['delegationID'] == d['delegationID'])).toList();
        selectedValue = _selectedDelegationId;
        break;
      default:
        return;
    }

    // Auto-select if only one option is available
    if (items.length == 1) {
      setState(() {
        if (type == 'region') {
          _selectedRegionId = items[0]['regionID'];
          _selectedGovernorateId = null;
          _selectedGovernorate = null;
          _selectedDelegationId = null;
          _selectedDelegation = null;
        } else if (type == 'governorate') {
          _selectedGovernorate = items[0];
          _selectedGovernorateId = items[0]['governorateID'];
          _selectedDelegationId = null;
          _selectedDelegation = null;
        } else {
          _selectedDelegation = items[0];
          _selectedDelegationId = items[0]['delegationID'];
        }
        _recipientID = null;
        _phoneController.clear();
        _phoneError = null;
      });
      return;
    }

    final TextEditingController searchController = TextEditingController();
    List<dynamic> filteredItems = List.from(items);

    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: Theme.of(context).cardTheme.color,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          title: Text(
            'Select $type',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: Theme.of(context).colorScheme.primary,
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
                    hintText: 'Search ${type}s...',
                    prefixIcon: Icon(
                      Icons.search,
                      color: Theme.of(context).colorScheme.primary,
                      size: 18,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.primary,
                        width: 1.5,
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.primary.withOpacity(0.7),
                        width: 1.5,
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.primary,
                        width: 2,
                      ),
                    ),
                  ),
                  onChanged: (value) {
                    setDialogState(() {
                      filteredItems = items.where((item) => item['name'].toLowerCase().contains(value.toLowerCase())).toList();
                    });
                  },
                ),
                const CustomSpacer(height: 8),
                SizedBox(
                  height: 300,
                  child: ListView.builder(
                    itemCount: filteredItems.length,
                    itemBuilder: (context, index) {
                      final item = filteredItems[index];
                      return ListTile(
                        leading: Icon(
                          Icons.location_on_outlined,
                          color: Theme.of(context).colorScheme.primary,
                          size: 18,
                        ),
                        title: Text(
                          item['name'],
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Theme.of(context).colorScheme.onSurface,
                          ),
                        ),
                        trailing: selectedValue == item['${type}ID']
                            ? Icon(
                          Icons.check_circle,
                          color: Theme.of(context).colorScheme.primary,
                          size: 18,
                        )
                            : null,
                        onTap: () {
                          setState(() {
                            if (type == 'region') {
                              _selectedRegionId = item['${type}ID'];
                              _selectedGovernorateId = null;
                              _selectedGovernorate = null;
                              _selectedDelegationId = null;
                              _selectedDelegation = null;
                            } else if (type == 'governorate') {
                              _selectedGovernorate = item;
                              _selectedGovernorateId = item['${type}ID'];
                              _selectedDelegationId = null;
                              _selectedDelegation = null;
                            } else {
                              _selectedDelegation = item;
                              _selectedDelegationId = item['${type}ID'];
                            }
                            _recipientID = null;
                            _phoneController.clear();
                            _phoneError = null;
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
                  color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showAgentDialog(BuildContext context, AgentProvider agentProvider) async {
    if (!mounted) return;

    final BuildContext dialogContext = _navigatorKey.currentContext ?? context;
    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    setState(() => _isLoading = true);

    try {
      await agentProvider.getAgentsByUser(authProvider.user!.userID);
      final supervisorAgents = List<Agent>.from(agentProvider.agents);
      final delegationAgents = await agentProvider.fetchAgentsByDelegation(_selectedDelegationId!);
      final filteredAgents = supervisorAgents.where((a) => delegationAgents.any((da) => da.agentID == a.agentID)).toList();

      setState(() => _isLoading = false);

      // Auto-select if only one agent is available
      if (filteredAgents.length == 1) {
        setState(() {
          _recipientID = filteredAgents.first.agentID;
          _phoneController.text = filteredAgents.first.phone ?? '';
          _phoneError = null;
        });
        return;
      }

      final TextEditingController searchController = TextEditingController();
      List<Agent> filteredItems = List.from(filteredAgents);

      if (dialogContext.mounted) {
        await showDialog<void>(
          context: dialogContext,
          builder: (BuildContext dialogBuilderContext) => StatefulBuilder(
            builder: (BuildContext dialogBuilderContext, StateSetter setDialogState) => AlertDialog(
              backgroundColor: Theme.of(dialogBuilderContext).cardTheme.color,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              title: Text(
                'Select Agent',
                style: Theme.of(dialogBuilderContext).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: Theme.of(dialogBuilderContext).colorScheme.primary,
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
                        hintText: 'Search agents...',
                        prefixIcon: Icon(
                          Icons.search,
                          color: Theme.of(dialogBuilderContext).colorScheme.primary,
                          size: 18,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: BorderSide(
                            color: Theme.of(dialogBuilderContext).colorScheme.primary,
                            width: 1.5,
                          ),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: BorderSide(
                            color: Theme.of(dialogBuilderContext).colorScheme.primary.withOpacity(0.7),
                            width: 1.5,
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: BorderSide(
                            color: Theme.of(dialogBuilderContext).colorScheme.primary,
                            width: 2,
                          ),
                        ),
                      ),
                      onChanged: (value) {
                        setDialogState(() {
                          filteredItems = filteredAgents
                              .where((agent) =>
                          '${agent.name} ${agent.lastname}'.toLowerCase().contains(value.toLowerCase()) ||
                              agent.agentID.toLowerCase().contains(value.toLowerCase()))
                              .toList();
                        });
                      },
                    ),
                    const CustomSpacer(height: 8),
                    SizedBox(
                      height: 300,
                      child: filteredItems.isEmpty
                          ? Center(
                        child: Text(
                          'No agents available',
                          style: Theme.of(dialogBuilderContext).textTheme.bodyMedium?.copyWith(
                            color: Colors.grey,
                          ),
                        ),
                      )
                          : ListView.builder(
                        itemCount: filteredItems.length,
                        itemBuilder: (context, index) {
                          final agent = filteredItems[index];
                          return ListTile(
                            leading: Icon(
                              Icons.person_outline,
                              color: Theme.of(context).colorScheme.primary,
                              size: 18,
                            ),
                            title: Text(
                              '${agent.name} ${agent.lastname}',
                              style: Theme.of(dialogBuilderContext).textTheme.bodyMedium?.copyWith(
                                color: Theme.of(dialogBuilderContext).colorScheme.onSurface,
                              ),
                            ),
                            trailing: _recipientID == agent.agentID
                                ? Icon(
                              Icons.check_circle,
                              color: Theme.of(context).colorScheme.primary,
                              size: 18,
                            )
                                : null,
                            onTap: () {
                              if (mounted) {
                                setState(() {
                                  _recipientID = agent.agentID;
                                  _phoneController.text = agent.phone ?? '';
                                  _phoneError = null;
                                });
                                Navigator.pop(dialogBuilderContext);
                              }
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
                  onPressed: () => Navigator.pop(dialogBuilderContext),
                  child: Text(
                    'Cancel',
                    style: TextStyle(
                      color: Theme.of(dialogBuilderContext).colorScheme.onSurface.withOpacity(0.6),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      } else {
        _showSnackBar('Unable to show agents: Screen is no longer active');
      }
    } catch (e, stackTrace) {
      if (mounted) {
        setState(() => _isLoading = false);
        _showSnackBar('Failed to load agents: $e');
      }
      developer.log('[TransferReceiptBookScreen] Error in showAgentDialog: $e', name: 'TransferReceiptBookScreen.showAgentDialog', error: e, stackTrace: stackTrace);
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _showSnackBar(String message) {
    if (mounted) {
      CustomSnackBar.show(
        context: context,
        message: message,
        backgroundColor: message.contains('successfully')
            ? Theme.of(context).colorScheme.primary.withOpacity(0.9)
            : Theme.of(context).colorScheme.error.withOpacity(0.9),
      );
    }
  }

  Widget _buildAgentSelector(BuildContext context) {
    final theme = Theme.of(context);
    return _buildSectionCard(
      context,
      title: 'Agent',
      children: [
        Consumer2<AgentProvider, LocationProvider>(
          builder: (context, agentProvider, locationProvider, child) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildSelector(
                  context: context,
                  label: 'Region',
                  value: _selectedRegionId == null
                      ? 'Select Region'
                      : _regions.firstWhere((r) => r['regionID'] == _selectedRegionId, orElse: () => {'name': 'Select Region'})['name'],
                  icon: Icons.location_on_outlined,
                  onTap: () => _showLocationDialog(context, 'region'),
                ),
                _buildSelector(
                  context: context,
                  label: 'Governorate',
                  value: _selectedGovernorate == null ? 'Select Governorate' : _selectedGovernorate!['name'],
                  icon: Icons.location_city_outlined,
                  onTap: _selectedRegionId == null ? null : () => _showLocationDialog(context, 'governorate'),
                  disabled: _selectedRegionId == null,
                ),
                _buildSelector(
                  context: context,
                  label: 'Delegation',
                  value: _selectedDelegation == null ? 'Select Delegation' : _selectedDelegation!['name'],
                  icon: Icons.place_outlined,
                  onTap: _selectedGovernorateId == null ? null : () => _showLocationDialog(context, 'delegation'),
                  disabled: _selectedGovernorateId == null,
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: TextField(
                    controller: _phoneController,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    maxLength: 8,
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: theme.colorScheme.background,
                      hintText: "Enter agent's phone number",
                      prefixIcon: Icon(
                        Icons.phone_outlined,
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
                      counterText: '',
                      hintStyle: TextStyle(
                        color: theme.colorScheme.onSurface.withOpacity(0.6),
                      ),
                    ),
                    style: TextStyle(
                      fontSize: 16,
                      color: theme.colorScheme.onSurface,
                    ),
                    onChanged: (value) => _onPhoneChanged(value, agentProvider),
                  ),
                ),
                if (_phoneError != null) ...[
                  Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: Text(
                      _phoneError!,
                      style: TextStyle(
                        color: theme.colorScheme.error,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
                _buildSelector(
                  context: context,
                  label: 'Agent',
                  value: _recipientID == null
                      ? (_phoneController.text.isNotEmpty
                      ? 'Selected via phone'
                      : _selectedDelegationId == null
                      ? 'Select a delegation first'
                      : 'Select Agent')
                      : '${agentProvider.agents.firstWhere((agent) => agent.agentID == _recipientID, orElse: () => Agent(agentID: '', name: 'Unknown', lastname: '', delegationID: '')).name} ${agentProvider.agents.firstWhere((agent) => agent.agentID == _recipientID, orElse: () => Agent(agentID: '', name: '', lastname: 'Unknown', delegationID: '')).lastname}',
                  icon: Icons.person_outline,
                  onTap: _phoneController.text.isNotEmpty || _selectedDelegationId == null
                      ? null
                      : () => _showAgentDialog(context, agentProvider),
                  disabled: _phoneController.text.isNotEmpty || _selectedDelegationId == null,
                ),
              ],
            );
          },
        ),
      ],
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

  @override
  void dispose() {
    _otpTimer?.cancel();
    _otpController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: CustomAppBar(title: 'Transfer Receipt Books', showBackButton: true),
      drawer: const AppSidebar(),
      body: Navigator(
        key: _navigatorKey,
        onGenerateRoute: (settings) => MaterialPageRoute(
          builder: (context) => MultiProvider(
            providers: [
              ChangeNotifierProvider.value(value: Provider.of<ReceiptBookProvider>(context)),
              ChangeNotifierProvider.value(value: Provider.of<AuthProvider>(context)),
              ChangeNotifierProvider.value(value: Provider.of<AgentProvider>(context)),
              ChangeNotifierProvider.value(value: Provider.of<ReceiptStubProvider>(context)),
              ChangeNotifierProvider.value(value: Provider.of<LocationProvider>(context)),
              ChangeNotifierProvider.value(value: Provider.of<UserProvider>(context)),
            ],
            builder: (context, child) {
              final receiptBookProvider = Provider.of<ReceiptBookProvider>(context);
              final agentProvider = Provider.of<AgentProvider>(context);
              final isLoading = _isLoading || receiptBookProvider.isLoading || agentProvider.isLoading;

              return Builder(
                builder: (scaffoldContext) {
                  return Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: Column(
                      children: [
                        Expanded(
                          child: isLoading
                              ? const Center(child: CircularProgressIndicator())
                              : RefreshIndicator(
                            onRefresh: _onRefresh,
                            child: ListView(
                              children: [
                                _buildSectionCard(
                                  scaffoldContext,
                                  title: 'Recipient Type',
                                  children: [
                                    RecipientTypeSelector(
                                      recipientType: _recipientType,
                                      onChanged: (value) {
                                        setState(() {
                                          _recipientType = value;
                                          _recipientID = null;
                                          _selectedRegionId = null;
                                          _selectedGovernorateId = null;
                                          _selectedDelegationId = null;
                                          _selectedGovernorate = null;
                                          _selectedDelegation = null;
                                          _selectedBookIDs.clear();
                                          _scannedQRCodes.clear();
                                          _phoneController.clear();
                                          _error = null;
                                          _phoneError = null;
                                          _isScannerActive = false;
                                          // Trigger user list refresh
                                          if (value != null && value != "Agent" && value != "Stub Collection") {
                                            Provider.of<UserProvider>(context, listen: false).getUsersByRole(value);
                                          }
                                        });
                                      },
                                    ),
                                  ],
                                ),
                                const CustomSpacer(height: 8),
                                if (_recipientType == "Agent") ...[
                                  _buildAgentSelector(scaffoldContext),
                                ],
                                if (_recipientType == "Regional Manager" ||
                                    _recipientType == "Supervisor" ||
                                    _recipientType == "Stock Manager") ...[
                                  _buildSectionCard(
                                    scaffoldContext,
                                    title: _recipientType!,
                                    children: [
                                      UserSelector(
                                        role: _recipientType!,
                                        onUserSelected: (User user) {
                                          setState(() {
                                            _recipientID = user.userID;
                                            _phoneController.text = user.phone ?? '';
                                            _phoneError = null;
                                            _error = null;
                                          });
                                        },
                                      ),
                                    ],
                                  ),
                                ],
                                if (_recipientType != null &&
                                    (_recipientType == "Stub Collection" || _recipientID != null)) ...[
                                  const CustomSpacer(height: 8),
                                  _buildSectionCard(
                                    scaffoldContext,
                                    title: 'Receipt Books',
                                    children: [
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
                                    ],
                                  ),
                                  const CustomSpacer(height: 8),
                                  if (!_transferInitiated) ...[
                                    _buildSectionCard(
                                      scaffoldContext,
                                      title: 'Actions',
                                      children: [
                                        CustomButton(
                                          label: _recipientType == "Stub Collection"
                                              ? 'Initiate Stub Collection'
                                              : 'Initiate Transfer',
                                          icon: Icons.send,
                                          onPressed: _initiateTransfer,
                                          backgroundColor: theme.colorScheme.primary.withOpacity(0.8),
                                          textColor: theme.colorScheme.primary,
                                          isOutlined: true,
                                          isLoading: _isLoading,
                                        ),
                                      ],
                                    ),
                                  ],
                                ],
                                if (_transferInitiated) ...[
                                  const CustomSpacer(height: 8),
                                  _buildSectionCard(
                                    scaffoldContext,
                                    title: 'OTP Validation',
                                    children: [
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
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              );
            },
          ),
        ),
      ),
    );
  }
}