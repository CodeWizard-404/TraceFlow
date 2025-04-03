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
import '../Error.dart';

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
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (_formKey.currentState!.validate()) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      try {
        await authProvider.login(
          _identifierController.text.trim(),
          _passwordController.text.trim(),
        );
        if (authProvider.token != null) {
          if (authProvider.isSupervisor) {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (_) => const TimesheetDetailsScreen()),
            );
          } else {
            _showErrorSnackBar('Access denied: Only Supervisors can log in.');
            authProvider.logout(); // Remove await since logout() is not async
          }
        } else {
          _showErrorSnackBar('Login failed: No token received');
        }
      } catch (e) {
        String errorMessage;
        if (e.toString().contains('Invalid credentials')) {
          errorMessage = 'Invalid email or password';
          _passwordController.clear();
        } else {
          errorMessage = 'An error occurred. Please try again.';
        }
        _showErrorSnackBar(errorMessage);
      }
    }
  }

  void _showErrorSnackBar(String message) {
    CustomSnackBar.show(
      context: context,
      message: message,
      backgroundColor: Theme.of(context).colorScheme.error.withOpacity(0.9),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
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
                  CustomTitleText(text: 'TraceFlow'),
                  const CustomSpacer(height: 48),
                  CustomTextField(
                    controller: _identifierController,
                    label: 'Email or Phone',
                    prefixIcon: Icons.person,
                    keyboardType: TextInputType.emailAddress,
                    validator:
                        (value) =>
                            value?.trim().isEmpty ?? true
                                ? 'Please enter your email or phone'
                                : null,
                  ),
                  const CustomSpacer(height: 16),
                  CustomTextField(
                    controller: _passwordController,
                    label: 'Password',
                    prefixIcon: Icons.lock,
                    suffixIcon:
                        _obscurePassword
                            ? Icons.visibility
                            : Icons.visibility_off,
                    obscureText: _obscurePassword,
                    onSuffixPressed:
                        () => setState(
                          () => _obscurePassword = !_obscurePassword,
                        ),
                    validator:
                        (value) =>
                            value?.trim().isEmpty ?? true
                                ? 'Please enter your password'
                                : null,
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
                    onPressed:
                        () => _showErrorSnackBar(
                          'Forgot password not implemented yet',
                        ),
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
