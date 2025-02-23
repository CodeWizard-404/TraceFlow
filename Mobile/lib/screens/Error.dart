import 'package:flutter/material.dart';

class ErrorPage extends StatelessWidget {
  final String errorMessage;
  final VoidCallback? onRetry;

  const ErrorPage({
    required this.errorMessage,
    this.onRetry,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Oops! Something Went Wrong'),
        backgroundColor: Colors.red,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.error_outline,
                size: 80,
                color: Colors.red,
              ),
              SizedBox(height: 20),
              Text(
                errorMessage,
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              SizedBox(height: 20),
              if (onRetry != null)
                ElevatedButton(
                  onPressed: onRetry,
                  child: Text('Retry'),
                ),
              SizedBox(height: 10),
              ElevatedButton(
                onPressed: () {
                  // Navigate back to a safe screen (e.g., HomeScreen)
                  Navigator.of(context).popUntil((route) => route.isFirst);
                },
                child: Text('Go Back'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}