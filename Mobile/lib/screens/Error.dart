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
      appBar: PreferredSize(
        preferredSize: Size.fromHeight(80),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFFE81F76), Color(0xFFE81F76)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
          ),
          child: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            title: Text(
              'Oops! Something Went Wrong',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            centerTitle: true,
          ),
        ),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.error_outline,
                size: 100,
                color: Color(0xFFE81F76),
              ),
              SizedBox(height: 20),
              Text(
                errorMessage,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Colors.grey[800]),
              ),
              SizedBox(height: 20),
              if (onRetry != null)
                ElevatedButton.icon(
                  onPressed: onRetry,
                  icon: Icon(Icons.refresh, color: Colors.white),
                  label: Text('Retry', style: TextStyle(color: Colors.white)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Color(0xFF4CB1C7),
                    padding: EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: () {
                  Navigator.of(context).popUntil((route) => route.isFirst);
                },
                icon: Icon(Icons.arrow_back, color: Color(0xFF4CB1C7)),
                label: Text('Go Back', style: TextStyle(color: Color(0xFF4CB1C7))),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: Color(0xFF4CB1C7), width: 2),
                  padding: EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}