import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import '../../providers/auth_provider.dart';
import '../../providers/theme_provider.dart';
import '../../widgets/commen/title_text.dart';
import '../../widgets/google/google_login_button.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  LoginScreenState createState() => LoginScreenState();
}

class LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  Map<String, String> _errors = {};
  String? _successMessage;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  String? _validateIdentifier(String? value) {
    if (value?.isEmpty ?? true) return 'Please enter your email or phone number.';
    final emailRegex = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
    final phoneRegex = RegExp(r'^(?:\+\d{11}|\d{8})$');
    if (!emailRegex.hasMatch(value!) && !phoneRegex.hasMatch(value)) {
      return 'Invalid email or phone format. Phone must be 8 digits or + followed by 11 digits.';
    }
    return null;
  }

  String? _validatePassword(String? value) {
    if (value?.isEmpty ?? true) return 'Please enter a password.';
    if (value!.length < 8) return 'Password must be at least 8 characters long.';
    return null;
  }

  bool _validateForm() {
    final newErrors = {
      'identifier': _validateIdentifier(_identifierController.text) ?? '',
      'password': _validatePassword(_passwordController.text) ?? '',
    };
    setState(() => _errors = newErrors);
    return newErrors.values.every((err) => err.isEmpty);
  }

  Future<void> _login() async {
    if (!_validateForm()) return;
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.login(_identifierController.text.trim(), _passwordController.text.trim());
  }

  Future<void> _biometricLogin() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (await authProvider.isFingerprintEnabled() && await authProvider.canUseBiometrics()) {
      try {
        // Use the correct authenticate method for local_auth ^2.3.0
        final authenticated = await authProvider.authenticateWithBiometrics();
        if (authenticated) {
          final email = await authProvider.readStoredEmail();
          final password = await authProvider.readStoredPassword();
          if (email != null && password != null) {
            await authProvider.login(email, password);
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('No stored credentials found. Please log in manually.'),
                backgroundColor: Theme.of(context).colorScheme.error,
              ),
            );
          }
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Biometric authentication failed.'),
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
          );
        }
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error during biometric login: $e'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Biometric login not enabled or supported.'),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  void _resetForm() {
    _identifierController.clear();
    _passwordController.clear();
    setState(() {
      _errors = {};
      _successMessage = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final themeProvider = Provider.of<ThemeProvider>(context);
    final theme = themeProvider.currentTheme;

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      if (authProvider.errorMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(authProvider.errorMessage!),
            backgroundColor: theme.colorScheme.error,
            duration: const Duration(seconds: 5),
          ),
        );
        authProvider.clearError();
      } else if (authProvider.requires2FA) {
        Navigator.pushNamed(context, '/verify-2fa');
      } else if (authProvider.isAuthenticated && authProvider.permissionsLoaded) {
        final fingerprintStatus = await authProvider.getFingerprintStatus();
        if (fingerprintStatus == null && await authProvider.canUseBiometrics()) {
          final enable = await showDialog<bool>(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Enable Biometric Login'),
              content: const Text('Would you like to enable biometric login (fingerprint/face) for future sessions?'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('No'),
                ),
                TextButton(
                  onPressed: () async {
                    await authProvider.enableFingerprintLogin(
                      _identifierController.text.trim(),
                      _passwordController.text.trim(),
                    );
                    Navigator.pop(context, true);
                  },
                  child: const Text('Yes'),
                ),
              ],
            ),
          );
          if (enable != true) {
            await authProvider.disableFingerprintLogin();
          }
        }
        Navigator.pushReplacementNamed(context, '/timesheet-details');
      } else if (_successMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_successMessage!),
            backgroundColor: theme.colorScheme.primary,
            duration: const Duration(seconds: 5),
          ),
        );
        setState(() => _successMessage = null);
      }
    });

    return Scaffold(
      backgroundColor: theme.colorScheme.background,
      body: Stack(
        children: [
          _buildBackgroundOverlay(context),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      CustomTitleText(text: 'TraceFlow'),
                      const SizedBox(height: 8),
                      Text(
                        'Securely Track. Optimize. Succeed.',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onBackground.withOpacity(0.6),
                        ),
                      ),
                      const SizedBox(height: 48),
                      TextFormField(
                        controller: _identifierController,
                        decoration: InputDecoration(
                          labelText: 'Email or Phone',
                          labelStyle: TextStyle(color: theme.colorScheme.onSurfaceVariant),
                          prefixIcon: Icon(Icons.person, color: theme.colorScheme.primary),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide(color: theme.colorScheme.outline),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide(color: theme.colorScheme.outline),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide(color: theme.colorScheme.primary, width: 2),
                          ),
                          errorText: _errors['identifier']?.isNotEmpty == true
                              ? _errors['identifier']
                              : null,
                          errorStyle: TextStyle(color: theme.colorScheme.error),
                        ),
                        enabled: !authProvider.isLoading && authProvider.deviceIdentifier != null,
                        onChanged: (_) => _validateForm(),
                        keyboardType: TextInputType.emailAddress,
                        autocorrect: false,
                        style: TextStyle(color: theme.colorScheme.onSurface),
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _passwordController,
                        decoration: InputDecoration(
                          labelText: 'Password',
                          labelStyle: TextStyle(color: theme.colorScheme.onSurfaceVariant),
                          prefixIcon: Icon(Icons.lock, color: theme.colorScheme.primary),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePassword ? Icons.visibility_off : Icons.visibility,
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                            onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide(color: theme.colorScheme.outline),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide(color: theme.colorScheme.outline),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide(color: theme.colorScheme.primary, width: 2),
                          ),
                          errorText: _errors['password']?.isNotEmpty == true
                              ? _errors['password']
                              : null,
                          errorStyle: TextStyle(color: theme.colorScheme.error),
                        ),
                        enabled: !authProvider.isLoading && authProvider.deviceIdentifier != null,
                        obscureText: _obscurePassword,
                        onChanged: (_) => _validateForm(),
                        autocorrect: false,
                        style: TextStyle(color: theme.colorScheme.onSurface),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              child: ElevatedButton(
                                onPressed: authProvider.isLoading || authProvider.deviceIdentifier == null
                                    ? null
                                    : _login,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: theme.colorScheme.primary,
                                  foregroundColor: theme.colorScheme.onPrimary,
                                  padding: const EdgeInsets.symmetric(vertical: 16),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  elevation: 2,
                                ),
                                child: authProvider.isLoading
                                    ? SpinKitFadingCircle(
                                  color: theme.colorScheme.onPrimary,
                                  size: 24,
                                )
                                    : Text(
                                  'Sign In',
                                  style: theme.textTheme.labelLarge?.copyWith(
                                    color: theme.colorScheme.onPrimary,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          IconButton(
                            icon: Icon(
                              Icons.fingerprint,
                              color: theme.colorScheme.primary,
                              size: 40,
                            ),
                            onPressed: authProvider.isLoading || authProvider.deviceIdentifier == null
                                ? null
                                : _biometricLogin,
                            tooltip: 'Login with Biometrics',
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Divider(color: theme.colorScheme.outline),
                      const SizedBox(height: 16),
                      const GoogleLoginButton(),
                      const SizedBox(height: 16),
                      TextButton(
                        onPressed: () => Navigator.pushNamed(context, '/forgot-password'),
                        child: Text(
                          'Forgot Password?',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.colorScheme.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBackgroundOverlay(BuildContext context) {
    final theme = Provider.of<ThemeProvider>(context).currentTheme;
    return Stack(
      children: [
        Container(
          color: theme.colorScheme.background.withOpacity(0.9),
        ),
        Positioned(
          top: 50,
          left: 20,
          child: Icon(
            Icons.location_pin,
            size: 40,
            color: theme.colorScheme.primary.withOpacity(0.2),
          ),
        ),
        Positioned(
          bottom: 100,
          right: 30,
          child: Icon(
            Icons.access_time,
            size: 50,
            color: theme.colorScheme.secondary.withOpacity(0.2),
          ),
        ),
        Positioned(
          top: 200,
          right: 50,
          child: Icon(
            Icons.qr_code,
            size: 45,
            color: theme.colorScheme.tertiary.withOpacity(0.2),
          ),
        ),
        Positioned(
          top: 100,
          left: 100,
          child: AnimatedContainer(
            duration: const Duration(seconds: 3),
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: theme.colorScheme.primary.withOpacity(0.3),
              shape: BoxShape.circle,
            ),
          ),
        ),
        Positioned(
          bottom: 150,
          left: 50,
          child: AnimatedContainer(
            duration: const Duration(seconds: 4),
            width: 12,
            height: 12,
            decoration: BoxDecoration(
              color: theme.colorScheme.secondary.withOpacity(0.3),
              shape: BoxShape.circle,
            ),
          ),
        ),
      ],
    );
  }
}