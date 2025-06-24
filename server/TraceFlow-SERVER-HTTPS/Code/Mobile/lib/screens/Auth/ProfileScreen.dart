import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import '../../providers/auth_provider.dart';
import '../../providers/user_provider.dart';
import '../../widgets/appbar/app_bar.dart';
import '../../widgets/appbar/sidebar.dart';
import '../../widgets/commen/button.dart';
import '../../widgets/commen/custom_formatter.dart';
import '../../widgets/commen/snack_bar.dar.dart';
import '../../widgets/commen/spacer.dart';
import '../../widgets/commen/text_field.dart';
import '../../widgets/commen/card.dart';
import '../../widgets/commen/section_title.dart';
import '../../widgets/commen/divider.dart';
import '../../widgets/commen/list_tile.dart';
import 'login_screen.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:mime/mime.dart'; // Add this package for MIME type detection
import 'package:http_parser/http_parser.dart'; // For MediaType

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  ProfileScreenState createState() => ProfileScreenState();
}

class ProfileScreenState extends State<ProfileScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  late TextEditingController _firstnameController;
  late TextEditingController _lastnameController;
  late TextEditingController _emailController;
  late TextEditingController _phoneController;
  late TextEditingController _newPasswordController;
  late TextEditingController _confirmPasswordController;
  String? _profilePicBase64;
  String? _editingField;
  bool _hasChanges = false;
  bool _isLoading = true;
  String? _errorMessage;
  String? _updateMessage;
  Map<String, String> _formErrors = {};

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _firstnameController = TextEditingController();
    _lastnameController = TextEditingController();
    _emailController = TextEditingController();
    _phoneController = TextEditingController();
    _newPasswordController = TextEditingController();
    _confirmPasswordController = TextEditingController();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _fetchProfile();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _firstnameController.dispose();
    _lastnameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _fetchProfile() async {
    final userProvider = Provider.of<UserProvider>(context, listen: false);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (kDebugMode) print('Fetching profile');
    setState(() => _isLoading = true);
    try {
      await userProvider.fetchUserProfile();
      final user = userProvider.currentUser;
      if (user != null) {
        setState(() {
          _firstnameController.text = user.firstName ?? '';
          _lastnameController.text = user.lastName ?? '';
          _emailController.text = user.email ?? '';
          _phoneController.text = user.phone ?? '';
          _profilePicBase64 = user.pfp;
          _isLoading = false;
        });
        if (kDebugMode) print('Profile fetched: ${user.userID}');
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load profile: $e';
        _isLoading = false;
      });
      if (kDebugMode) print(_errorMessage);
      if (_errorMessage!.contains('Invalid or expired token') ||
          _errorMessage!.contains('401')) {
        await authProvider.logout();
        _redirectToLogin();
      }
    }
  }

  Future<void> _updateProfile(String field) async {
    final userProvider = Provider.of<UserProvider>(context, listen: false);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (kDebugMode) print('Updating profile field: $field');
    final updates = {
      field:
          field == 'phone'
              ? _phoneController.text.replaceAll(RegExp(r'[^\d]'), '')
              : (field == 'firstname'
                  ? _firstnameController.text
                  : field == 'lastname'
                  ? _lastnameController.text
                  : _emailController.text),
    };

    setState(() => _isLoading = true);
    try {
      await userProvider.updateProfile(updates);
      setState(() {
        _isLoading = false;
        _updateMessage = 'Profile updated successfully';
        _editingField = null;
        _hasChanges = false;
        _formErrors.clear();
      });
      if (kDebugMode) print('Profile updated successfully');
      await _fetchProfile();
    } catch (e) {
      setState(() {
        _isLoading = false;
        _updateMessage = 'Failed to update profile: $e';
      });
      if (kDebugMode) print(_updateMessage);
      if (_updateMessage!.contains('Invalid or expired token') ||
          _updateMessage!.contains('401')) {
        await authProvider.logout();
        _redirectToLogin();
      }
    }
  }

  Future<void> _updateProfilePicture() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);
    if (pickedFile != null) {
      final bytes = await pickedFile.readAsBytes();
      String? mimeType = lookupMimeType(pickedFile.path, headerBytes: bytes);
      if (mimeType == null ||
          !['image/jpeg', 'image/jpg', 'image/png'].contains(mimeType)) {
        mimeType = 'image/jpeg';
      }
      final multipartFile = http.MultipartFile.fromBytes(
        'PFP',
        bytes,
        filename: 'profile.jpg',
        contentType: MediaType.parse(mimeType),
      );
      final updates = {'PFP': multipartFile};
      final userProvider = Provider.of<UserProvider>(context, listen: false);
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      if (kDebugMode) print('Updating profile picture');

      setState(() => _isLoading = true);
      try {
        await userProvider.updateProfile(updates);
        setState(() {
          _profilePicBase64 = userProvider.currentUser?.pfp;
          _isLoading = false;
          _updateMessage = 'Profile picture updated successfully';
        });
        if (kDebugMode) print('Profile picture updated');
        await _fetchProfile();
      } catch (e) {
        setState(() {
          _isLoading = false;
          _updateMessage = 'Failed to update profile picture: $e';
        });
        if (kDebugMode) print(_updateMessage);
        if (_updateMessage!.contains('Invalid or expired token') ||
            _updateMessage!.contains('401')) {
          await authProvider.logout();
          _redirectToLogin();
        }
      }
    }
  }

  Future<void> _updatePassword() async {
    final newPassword = _newPasswordController.text;
    final confirmPassword = _confirmPasswordController.text;
    if (newPassword != confirmPassword) {
      setState(() => _updateMessage = 'Passwords do not match');
      if (kDebugMode) print(_updateMessage);
      return;
    }
    final userProvider = Provider.of<UserProvider>(context, listen: false);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final updates = {'password': newPassword};
    if (kDebugMode) print('Updating password');

    setState(() => _isLoading = true);
    try {
      await userProvider.updateProfile(updates);
      setState(() {
        _newPasswordController.clear();
        _confirmPasswordController.clear();
        _isLoading = false;
        _updateMessage = 'Password updated successfully';
      });
      if (kDebugMode) print('Password updated');
      await _fetchProfile();
    } catch (e) {
      setState(() {
        _isLoading = false;
        _updateMessage = 'Failed to update password: $e';
      });
      if (kDebugMode) print(_updateMessage);
      if (_updateMessage!.contains('Invalid or expired token') ||
          _updateMessage!.contains('401')) {
        await authProvider.logout();
        _redirectToLogin();
      }
    }
  }

  void _redirectToLogin() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => const LoginScreen()),
          (route) => false,
        );
      }
    });
  }

  // Validation Functions (unchanged)
  String _validateName(String value, String field) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return '$field is required';
    if (trimmed.length < 3) return '$field must be at least 3 characters';
    if (trimmed.length > 20) return '$field must be 20 characters or less';
    if (!RegExp(r"^[a-zA-Z\s'-]+$").hasMatch(trimmed))
      return '$field can only contain letters, spaces, hyphens, or apostrophes';
    return '';
  }

  String _validateEmail(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return 'Email is required';
    if (trimmed.length > 70) return 'Email must be 70 characters or less';
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(trimmed))
      return 'Invalid email format';
    return '';
  }

  String _validatePhone(String value) {
    final digits = value.replaceAll(RegExp(r'[^\d]'), '');
    if (digits.isEmpty) return 'Phone is required';
    if (digits.length != 8) return 'Phone must be 8 digits';
    return '';
  }

  String _validatePassword(String value) {
    if (value.isNotEmpty && value.length < 8)
      return 'Password must be at least 8 characters';
    if (value.length > 128) return 'Password must be 128 characters or less';
    if (value.isNotEmpty &&
        !RegExp(
          r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[^\s]+$',
        ).hasMatch(value)) {
      return 'Password must include uppercase, lowercase, digit, and special character, no spaces';
    }
    return '';
  }

  String _validatePasswordConfirm(String password, String confirm) {
    if (password.isNotEmpty && confirm.isEmpty)
      return 'Password confirmation is required';
    if (password.isNotEmpty && confirm.isNotEmpty && password != confirm)
      return 'Passwords do not match';
    return '';
  }

  // Formatting Functions (unchanged)
  String _formatPhoneDisplay(String rawValue) {
    final digits = rawValue.replaceAll(RegExp(r'[^\d]'), '');
    String formatted = '';
    if (digits.isNotEmpty)
      formatted += digits.substring(0, digits.length > 2 ? 2 : digits.length);
    if (digits.length > 2)
      formatted +=
          ' ' + digits.substring(2, digits.length > 5 ? 5 : digits.length);
    if (digits.length > 5)
      formatted +=
          ' ' + digits.substring(5, digits.length > 8 ? 8 : digits.length);
    return formatted;
  }

  void _startEditing(String field) {
    setState(() {
      _editingField = field;
      _formErrors.clear();
      _updateMessage = null;
    });
  }

  void _checkForChanges(String field, String value) {
    final userProvider = Provider.of<UserProvider>(context, listen: false);
    final originalValue =
        field == 'firstname'
            ? userProvider.currentUser?.firstName
            : field == 'lastname'
            ? userProvider.currentUser?.lastName
            : field == 'email'
            ? userProvider.currentUser?.email
            : field == 'phone'
            ? userProvider.currentUser?.phone
            : null;
    if (value != originalValue) {
      setState(() => _hasChanges = true);
      _formErrors[field] =
          field == 'firstname' || field == 'lastname'
              ? _validateName(
                value,
                field == 'firstname' ? 'First Name' : 'Last Name',
              )
              : field == 'email'
              ? _validateEmail(value)
              : field == 'phone'
              ? _validatePhone(value)
              : '';
    } else {
      setState(() => _hasChanges = false);
    }
  }

  void _resetField(String field) {
    final userProvider = Provider.of<UserProvider>(context, listen: false);
    setState(() {
      if (field == 'firstname')
        _firstnameController.text = userProvider.currentUser?.firstName ?? '';
      if (field == 'lastname')
        _lastnameController.text = userProvider.currentUser?.lastName ?? '';
      if (field == 'email')
        _emailController.text = userProvider.currentUser?.email ?? '';
      if (field == 'phone')
        _phoneController.text = userProvider.currentUser?.phone ?? '';
      _editingField = null;
      _hasChanges = false;
      _formErrors.clear();
    });
  }

  Future<void> _handleOutsideTap() async {
    if (_editingField == null) return; // No edit mode active

    if (!_hasChanges) {
      // No changes, simply close edit mode
      setState(() {
        _editingField = null;
      });
    } else {
      // Changes detected, show confirmation dialog
      final shouldSave = await showDialog<bool>(
        context: context,
        builder:
            (context) => AlertDialog(
              title: const Text('Save Changes?'),
              content: const Text(
                'You have unsaved changes. Would you like to save them?',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context, false), // Cancel
                  child: const Text('Cancel'),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(context, true), // Save
                  child: const Text('Save'),
                ),
              ],
            ),
      );

      if (shouldSave == true) {
        // Save changes and refresh
        if (_formErrors[_editingField]?.isEmpty ?? true) {
          await _updateProfile(_editingField!);
        } else {
          setState(() {
            _updateMessage = 'Cannot save due to validation errors';
          });
        }
      } else {
        // Cancel changes and refresh
        _resetField(_editingField!);
        await _fetchProfile();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final userProvider = Provider.of<UserProvider>(context);

    if (_updateMessage != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          CustomSnackBar.show(
            context: context,
            message: _updateMessage!,
            backgroundColor:
                _updateMessage!.contains('successfully')
                    ? theme.colorScheme.primary
                    : theme.colorScheme.error,
          );
          setState(() => _updateMessage = null);
        }
      });
    }

    if (_errorMessage != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          CustomSnackBar.show(
            context: context,
            message: _errorMessage!,
            backgroundColor: theme.colorScheme.error,
          );
          setState(() => _errorMessage = null);
        }
      });
    }

    if (_isLoading) {
      return Scaffold(
        body: Center(
          child: CircularProgressIndicator(color: theme.colorScheme.primary),
        ),
      );
    }

    if (userProvider.currentUser == null) {
      return Scaffold(
        body: Center(
          child: Text(
            'Failed to load profile.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.error,
            ),
          ),
        ),
      );
    }

    return Scaffold(
      drawer: const AppSidebar(),
      body: RefreshIndicator(
        onRefresh: _fetchProfile, // Pull-to-refresh triggers profile fetch
        color: theme.colorScheme.primary,
        child: GestureDetector(
          onTap: _handleOutsideTap, // Handle tap outside edit field
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: CustomAppBar(title: 'Profile', showBackButton: true),
              ),
              SliverToBoxAdapter(
                child: _buildProfileHeader(theme, userProvider),
              ),
              SliverToBoxAdapter(child: _buildTabBar(theme)),
              SliverFillRemaining(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    _buildInfoTab(theme, userProvider),
                    _buildSettingsTab(theme),
                    _buildActivityTab(theme),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProfileHeader(ThemeData theme, UserProvider userProvider) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: [
          Stack(
            alignment: Alignment.center,
            children: [
              GestureDetector(
                onTap:
                    _profilePicBase64 != null
                        ? () {
                          // Show full-screen image preview
                          showDialog(
                            context: context,
                            builder:
                                (context) => Dialog(
                                  backgroundColor: Colors.transparent,
                                  insetPadding: const EdgeInsets.all(0),
                                  child: GestureDetector(
                                    onTap:
                                        () => Navigator.pop(
                                          context,
                                        ), // Close on tap
                                    child: SizedBox(
                                      width: double.infinity,
                                      height: double.infinity,
                                      child: InteractiveViewer(
                                        panEnabled: true,
                                        scaleEnabled: true,
                                        minScale: 0.5,
                                        maxScale: 4.0,
                                        child: Image.memory(
                                          base64Decode(_profilePicBase64!),
                                          fit: BoxFit.contain,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                          );
                        }
                        : null, // Do nothing if no profile picture
                child: CircleAvatar(
                  radius: 50,
                  backgroundImage:
                      _profilePicBase64 != null
                          ? MemoryImage(base64Decode(_profilePicBase64!))
                          : null,
                  backgroundColor: theme.colorScheme.surface,
                  child:
                      _profilePicBase64 == null
                          ? Icon(
                            Icons.person,
                            size: 50,
                            color: theme.colorScheme.onSurface.withOpacity(0.6),
                          )
                          : null,
                ),
              ),
              Positioned(
                bottom: 4,
                right: 5,
                child: GestureDetector(
                  onTap: _updateProfilePicture,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: theme.colorScheme.primary,
                    ),
                    child: Icon(
                      Icons.camera_alt,
                      color: Colors.white,
                      size: 12,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const CustomSpacer(height: 12),
          Text(
            '${userProvider.currentUser!.firstName} ${userProvider.currentUser!.lastName}',
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const CustomSpacer(height: 4),
          Text(
            'User ID: ${userProvider.currentUser!.userID}',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.secondary,
            ),
          ),
          const CustomSpacer(height: 8),
          CustomDivider(color: theme.dividerColor.withOpacity(0.5)),
        ],
      ),
    );
  }

  Widget _buildTabBar(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: theme.scaffoldBackgroundColor,
      child: TabBar(
        controller: _tabController,
        indicatorColor: theme.colorScheme.primary,
        labelColor: theme.colorScheme.primary,
        unselectedLabelColor: theme.colorScheme.onSurface.withOpacity(0.6),
        labelStyle: theme.textTheme.bodyMedium?.copyWith(
          fontWeight: FontWeight.w600,
        ),
        tabs: const [
          Tab(icon: Icon(Icons.person), text: 'Info'),
          Tab(icon: Icon(Icons.settings), text: 'Settings'),
          Tab(icon: Icon(Icons.history), text: 'Activity'),
        ],
      ),
    );
  }

  Widget _buildInfoTab(ThemeData theme, UserProvider userProvider) {
    return SingleChildScrollView(
      physics:
          const AlwaysScrollableScrollPhysics(), // Ensure scrollable for RefreshIndicator
      padding: const EdgeInsets.all(16),
      child: CustomCard(
        title: 'Profile Information',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const CustomSpacer(height: 8),
            _buildEditableField(
              label: 'First Name',
              field: 'firstname',
              controller: _firstnameController,
              displayValue:
                  _firstnameController.text.isEmpty
                      ? 'Not set'
                      : _firstnameController.text,
              icon: Icons.person_outline,
            ),
            const CustomDivider(thickness: 0.5),
            _buildEditableField(
              label: 'Last Name',
              field: 'lastname',
              controller: _lastnameController,
              displayValue:
                  _lastnameController.text.isEmpty
                      ? 'Not set'
                      : _lastnameController.text,
              icon: Icons.person_outline,
            ),
            const CustomDivider(thickness: 0.5),
            _buildEditableField(
              label: 'Email',
              field: 'email',
              controller: _emailController,
              displayValue:
                  _emailController.text.isEmpty
                      ? 'Not set'
                      : _emailController.text,
              icon: Icons.email_outlined,
              keyboardType: TextInputType.emailAddress,
            ),
            const CustomDivider(thickness: 0.5),
            _buildEditableField(
              label: 'Phone',
              field: 'phone',
              controller: _phoneController,
              displayValue:
                  _phoneController.text.isEmpty
                      ? 'Not set'
                      : '+216 ${_formatPhoneDisplay(_phoneController.text)}',
              icon: Icons.phone_outlined,
              keyboardType: TextInputType.phone,
              maxLength: 8,
              onChanged:
                  (value) => _checkForChanges(
                    'phone',
                    value.replaceAll(RegExp(r'[^\d]'), ''),
                  ),
              inputFormat: (value) => _formatPhoneDisplay(value),
            ),
            if (_hasChanges) ...[
              const CustomSpacer(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  CustomButton(
                    label: 'Cancel',
                    onPressed: () => _resetField(_editingField!),
                    isOutlined: true,
                  ),
                  const CustomSpacer(width: 12),
                  CustomButton(
                    label: 'Save',
                    icon: Icons.save,
                    onPressed:
                        _formErrors[_editingField]?.isEmpty ?? true
                            ? () => _updateProfile(_editingField!)
                            : () {},
                    isLoading: _isLoading,
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildEditableField({
    required String label,
    required String field,
    required TextEditingController controller,
    required String displayValue,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    int? maxLength,
    void Function(String)? onChanged,
    String Function(String)? inputFormat,
  }) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: GestureDetector(
        onTap: () => _startEditing(field),
        behavior: HitTestBehavior.opaque, // Ensure tap is detected
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: theme.colorScheme.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 24, color: theme.colorScheme.primary),
            ),
            const CustomSpacer(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: theme.colorScheme.onSurface.withOpacity(0.8),
                      letterSpacing: 0.5,
                    ),
                  ),
                  const CustomSpacer(height: 4),
                  _editingField == field
                      ? CustomTextField(
                        controller: controller,
                        label: label,
                        keyboardType: keyboardType,
                        maxLength: inputFormat == null ? maxLength : null,
                        onChanged: (value) {
                          if (onChanged != null) {
                            onChanged(value);
                          } else {
                            _checkForChanges(field, value);
                          }
                        },
                        inputFormatters:
                            inputFormat != null
                                ? [
                                  FilteringTextInputFormatter.digitsOnly,
                                  CustomFormatter(
                                    inputFormat,
                                    maxLength: maxLength,
                                  ),
                                ]
                                : null,
                        autofocus: true,
                      )
                      : Text(
                        displayValue,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurface,
                          fontSize: 16,
                        ),
                      ),
                  if (_formErrors[field]?.isNotEmpty ?? false)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        _formErrors[field]!,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.error,
                          fontSize: 12,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSettingsTab(ThemeData theme) {
    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      child: CustomCard(
        title: 'Account Settings',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CustomSectionTitle(text: 'Change Password'),
            const CustomSpacer(height: 12),
            CustomTextField(
              controller: _newPasswordController,
              label: 'New Password',
              obscureText: true,
              onChanged: (value) {
                _formErrors['newPassword'] = _validatePassword(value);
                _formErrors['confirmPassword'] = _validatePasswordConfirm(
                  value,
                  _confirmPasswordController.text,
                );
                setState(() {});
              },
            ),
            if (_formErrors['newPassword']?.isNotEmpty ?? false)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  _formErrors['newPassword']!,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.error,
                  ),
                ),
              ),
            const CustomSpacer(height: 16),
            CustomTextField(
              controller: _confirmPasswordController,
              label: 'Confirm Password',
              obscureText: true,
              onChanged: (value) {
                _formErrors['confirmPassword'] = _validatePasswordConfirm(
                  _newPasswordController.text,
                  value,
                );
                setState(() {});
              },
            ),
            if (_formErrors['confirmPassword']?.isNotEmpty ?? false)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  _formErrors['confirmPassword']!,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.error,
                  ),
                ),
              ),
            const CustomSpacer(height: 24),
            CustomButton(
              label: 'Update Password',
              onPressed:
                  _formErrors.values.every((e) => e.isEmpty)
                      ? _updatePassword
                      : () {},
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActivityTab(ThemeData theme) {
    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      child: CustomCard(
        title: 'Recent Activity',
        child: Column(
          children: [
            CustomListTile(
              title: 'Visit Logged',
              subtitle:
                  'April 07, 2025 - 10:45\nAgent: John Doe | Location: Tunis',
              leadingIcon: Icons.history,
              onTap: () {},
            ),
            const CustomDivider(),
            CustomListTile(
              title: 'Timesheet Submitted',
              subtitle: 'April 06, 2025 - 16:20\nDuration: 8h 30m',
              leadingIcon: Icons.access_time,
              onTap: () {},
            ),
            const CustomDivider(),
            CustomListTile(
              title: 'Carnet Distributed',
              subtitle:
                  'April 05, 2025 - 09:15\nCarnet ID: #CRN12345 | Agent: Amina K.',
              leadingIcon: Icons.credit_card,
              onTap: () {},
            ),
            const CustomDivider(),
            CustomListTile(
              title: 'Souche Collected',
              subtitle:
                  'April 04, 2025 - 14:00\nCarnet ID: #CRN12345 | Status: Validated',
              leadingIcon: Icons.check_circle,
              onTap: () {},
            ),
          ],
        ),
      ),
    );
  }
}
