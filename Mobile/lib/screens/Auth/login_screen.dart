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
    if (kDebugMode) print('LoginScreen initialized');
  }

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    if (kDebugMode) print('LoginScreen disposed');
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) {
      if (kDebugMode) print('Form validation failed');
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (kDebugMode) print('Attempting login with identifier: ${_identifierController.text}');

    authProvider.clearError();
    await authProvider.login(_identifierController.text.trim(), _passwordController.text.trim());

    if (kDebugMode) print('Login attempt completed, waiting for state update');
  }

  void _showErrorSnackBar(String message) {
    if (mounted) {
      if (kDebugMode) print('Showing error snackbar: $message');
      CustomSnackBar.show(
        context: context,
        message: message,
        backgroundColor: Theme.of(context).colorScheme.error.withOpacity(0.9),
      );
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
    if (value.length > 128) return 'Password cannot exceed 128 characters';
    if (!RegExp(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[^\s]+$').hasMatch(value)) {
      return 'Must include uppercase, lowercase, number, and special character (no spaces)';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (authProvider.errorMessage != null) {
        _showErrorSnackBar(authProvider.errorMessage!);
        authProvider.clearError();
      } else if (authProvider.requires2FA && ModalRoute.of(context)?.settings.name != '/verify-2fa') {
        if (kDebugMode) print('Navigating to Verify2FAScreen from listener');
        Navigator.pushNamed(context, '/verify-2fa');
      } else if (authProvider.token != null && authProvider.permissionsLoaded && authProvider.isSupervisor) {
        if (kDebugMode) print('Navigating to TimesheetDetailsScreen (Home) from listener');
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const TimesheetDetailsScreen()),
        );
      } else if (authProvider.token != null && authProvider.permissionsLoaded && !authProvider.isSupervisor) {
        if (kDebugMode) print('Access denied: Not a supervisor');
        _showErrorSnackBar('Access denied: Only Supervisors can log in.');
        authProvider.logout();
      }
    });

    if (kDebugMode) print('Building LoginScreen, isLoading: ${authProvider.isLoading}');
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
                  const CustomSpacer(height: 8),
                  Text(
                    'Securely Track. Optimize. Succeed.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey),
                  ),
                  const CustomSpacer(height: 48),
                  CustomTextField(
                    controller: _identifierController,
                    label: 'Email or Phone',
                    prefixIcon: Icons.person,
                    keyboardType: TextInputType.emailAddress,
                    validator: _validateIdentifier,
                    enabled: !authProvider.isLoading,
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
                    enabled: !authProvider.isLoading,
                  ),
                  const CustomSpacer(height: 24),
                  CustomButton(
                    label: 'Sign In',
                    onPressed: _login,
                    isLoading: authProvider.isLoading,
                  ),
                  const CustomSpacer(height: 16),
                  CustomTextButton(
                    label: 'Forgot Password?',
                    onPressed: () {
                      if (kDebugMode) print('Navigating to ForgotPasswordScreen');
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