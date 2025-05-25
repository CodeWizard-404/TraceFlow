import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../main.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/commen/button.dart';
import '../../widgets/commen/snack_bar.dar.dart';
import '../../widgets/commen/spacer.dart';
import '../../widgets/commen/text_button.dart';
import '../../widgets/commen/text_field.dart';
import '../../widgets/commen/title_text.dart';

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
  bool _isGoogleButtonHovered = false;

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.login(_identifierController.text.trim(), _passwordController.text.trim());
  }

  Future<void> _loginWithKeycloak() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    await authProvider.loginWithKeycloak();
  }

  String? _validateIdentifier(String? value) {
    if (value?.isEmpty ?? true) return 'Please enter your email or phone';
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$|^(\+\d{11}|\d{8})$').hasMatch(value!)) {
      return 'Invalid email or phone format';
    }
    return null;
  }

  String? _validatePassword(String? value) {
    if (value?.isEmpty ?? true) return 'Please enter a password';
    if (value!.length < 8) return 'Password must be at least 8 characters';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (authProvider.errorMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          CustomSnackBar(
            message: authProvider.errorMessage!,
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
        authProvider.clearError();
      } else if (authProvider.requires2FA) {
        Navigator.pushNamed(context, '/verify-2fa');
      } else if (authProvider.isAuthenticated && authProvider.permissionsLoaded) {
        Navigator.pushReplacementNamed(context, '/timesheet-details');
      }
    });

    return Scaffold(
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
                    'Supervisor Login',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey),
                  ),
                  const CustomSpacer(height: 48),
                  CustomTextField(
                    controller: _identifierController,
                    label: 'Email or Phone',
                    prefixIcon: Icons.person,
                    validator: _validateIdentifier,
                    enabled: !authProvider.isLoading,
                  ),
                  const CustomSpacer(height: 16),
                  CustomTextField(
                    controller: _passwordController,
                    label: 'Password',
                    prefixIcon: Icons.lock,
                    suffixIcon: _obscurePassword ? Icons.visibility_off : Icons.visibility,
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
                  MouseRegion(
                    onEnter: (_) => setState(() => _isGoogleButtonHovered = true),
                    onExit: (_) => setState(() => _isGoogleButtonHovered = false),
                    child: GestureDetector(
                      onTapDown: (_) => setState(() => _isGoogleButtonHovered = false),
                      onTapUp: (_) => setState(() => _isGoogleButtonHovered = true),
                      onTapCancel: () => setState(() => _isGoogleButtonHovered = false),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        transform: Matrix4.identity()
                          ..scale(_isGoogleButtonHovered ? 1.05 : 1.0),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.1),
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            ),
                          ],
                          border: Border.all(color: Colors.grey.shade300),
                        ),
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: authProvider.isLoading ? null : _loginWithKeycloak,
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(4),
                                    decoration: const BoxDecoration(
                                      color: Colors.white,
                                      shape: BoxShape.circle,
                                    ),
                                    child: Image.network(
                                      'https://www.google.com/favicon.ico',
                                      width: 20,
                                      height: 20,
                                      errorBuilder: (_, __, ___) => const Icon(Icons.error, size: 20),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  authProvider.isLoading
                                      ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                      : Text(
                                    'Sign in with Google',
                                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const CustomSpacer(height: 16),
                  CustomTextButton(
                    label: 'Forgot Password?',
                    onPressed: () => Navigator.pushNamed(context, '/forgot-password'),
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