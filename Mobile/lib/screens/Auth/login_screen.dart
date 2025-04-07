import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/commen/button.dart';
import '../../widgets/commen/snack_bar.dar.dart';
import '../../widgets/commen/spacer.dart';
import '../../widgets/commen/text_button.dart';
import '../../widgets/commen/text_field.dart';
import '../../widgets/commen/title_text.dart';
import '../Timesheet/Timesheet_details.dart';
import 'forgot_password_screen.dart';
import 'package:flutter/foundation.dart';
import '../../main.dart'; // Import to access navigatorKey

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

  @override
  void initState() {
    super.initState();
    debugPrint('LoginScreen initialized');
  }

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    debugPrint('LoginScreen disposed');
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) {
      debugPrint('Form validation failed');
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    debugPrint('Attempting login with identifier: ${_identifierController.text}');

    try {
      // Start login and get the future
      final loginFuture = authProvider.login(
        _identifierController.text.trim(),
        _passwordController.text.trim(),
      );

      // Handle navigation outside the widget lifecycle
      loginFuture.then((_) {
        debugPrint('Login completed. requires2FA: ${authProvider.requires2FA}, token: ${authProvider.token}');
        if (authProvider.requires2FA) {
          debugPrint('Pushing Verify2FAScreen via navigatorKey');
          MyApp.navigatorKey.currentState?.pushNamed('/verify-2fa');
        } else if (authProvider.token != null && authProvider.isSupervisor) {
          debugPrint('Replacing with TimesheetDetailsScreen via navigatorKey');
          MyApp.navigatorKey.currentState?.pushReplacementNamed('/timesheet-details');
        } else {
          debugPrint('Access denied: Not a supervisor');
          _showErrorSnackBar('Access denied: Only Supervisors can log in.');
          authProvider.logout();
        }
      }).catchError((e) {
        debugPrint('Login error: $e');
        if (mounted) {
          _showErrorSnackBar(_parseError(e.toString()));
        } else {
          debugPrint('Widget unmounted, showing error via navigatorKey');
          MyApp.navigatorKey.currentState?.push(
            MaterialPageRoute(
              builder: (_) => Scaffold(
                body: Center(
                  child: Text('Login failed: ${_parseError(e.toString())}'),
                ),
              ),
            ),
          );
        }
      });

      // Await the login to keep the loading state in sync
      await loginFuture;
    } catch (e) {
      debugPrint('Unexpected login error: $e');
    }
  }

  void _showErrorSnackBar(String message) {
    if (mounted) {
      debugPrint('Showing error snackbar: $message');
      CustomSnackBar.show(
        context: context,
        message: message,
        backgroundColor: Theme.of(context).colorScheme.error.withOpacity(0.9),
      );
    }
  }

  String _parseError(String error) {
    if (error.contains('Invalid credentials')) {
      _passwordController.clear();
      return 'Invalid email or password';
    } else if (error.contains('User not found')) {
      return 'User not found';
    } else {
      return 'An error occurred. Please try again.';
    }
  }

  String? _validateIdentifier(String? value) {
    if (value?.trim().isEmpty ?? true) return 'Please enter your email or phone';
    if (!RegExp(r'^([^\s@]+@[^\s@]+\.[^\s@]+|\+?\d{10,15})$').hasMatch(value!)) {
      return 'Invalid email or phone format';
    }
    return null;
  }

  String? _validatePassword(String? value) {
    if (value?.trim().isEmpty ?? true) return 'Please enter a password';
    if (value!.length < 8) return 'Password must be at least 8 characters';
    if (!RegExp(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[^\s]+$').hasMatch(value)) {
      return 'Must include uppercase, lowercase, number, and special character';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    debugPrint('Building LoginScreen, isLoading: ${authProvider.isLoading}');
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CustomTitleText(text: 'TraceFlow'),
                  const CustomSpacer(height: 48),
                  CustomTextField(
                    controller: _identifierController,
                    label: 'Email or Phone',
                    prefixIcon: Icons.person,
                    keyboardType: TextInputType.emailAddress,
                    validator: _validateIdentifier,
                  ),
                  const CustomSpacer(height: 16),
                  CustomTextField(
                    controller: _passwordController,
                    label: 'Password',
                    prefixIcon: Icons.lock,
                    suffixIcon: _obscurePassword ? Icons.visibility : Icons.visibility_off,
                    obscureText: _obscurePassword,
                    onSuffixPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    validator: _validatePassword,
                  ),
                  const CustomSpacer(height: 24),
                  CustomButton(
                    label: 'Login',
                    onPressed: _login,
                    isLoading: authProvider.isLoading,
                  ),
                  const CustomSpacer(height: 16),
                  CustomTextButton(
                    label: 'Forgot Password?',
                    onPressed: () {
                      debugPrint('Navigating to ForgotPasswordScreen');
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const ForgotPasswordScreen()),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}