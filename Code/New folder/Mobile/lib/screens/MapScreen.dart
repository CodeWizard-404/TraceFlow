import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class MapScreen extends StatefulWidget {
  static const routeName = '/map';
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(NavigationDelegate(
        onPageStarted: (url) {
          print('WebView loading: $url');
          setState(() {
            _isLoading = true;
            _errorMessage = null;
          });
        },
        onPageFinished: (url) {
          print('WebView loaded: $url');
          setState(() {
            _isLoading = false;
          });
        },
        onWebResourceError: (error) {
          print('WebView error: ${error.description}');
          setState(() {
            _isLoading = false;
            _errorMessage = 'Failed to load map: ${error.description}';
          });
        },
      ))
      ..loadHtmlString('''
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              #map { height: 100%; width: 100%; }
              html, body { height: 100%; margin: 0; padding: 0; }
            </style>
            <script>
              let map;
              function initMap() {
                map = new google.maps.Map(document.getElementById("map"), {
                  center: { lat: 36.8065, lng: 10.1815 },
                  zoom: 12,
                  mapTypeId: 'roadmap'
                });
                // Add markers for agents
                new google.maps.Marker({
                  position: { lat: 36.8065, lng: 10.1815 },
                  map: map,
                  title: 'Hassan'
                });
                new google.maps.Marker({
                  position: { lat: 36.8100, lng: 10.1850 },
                  map: map,
                  title: 'Fares'
                });
                new google.maps.Marker({
                  position: { lat: 36.8030, lng: 10.1780 },
                  map: map,
                  title: 'Sami'
                });
                console.log('Map initialized with markers');
              }
            </script>
            <script async src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDkbpHSSJc-fsV5fcwYkSxk0Mq0RNCAb7g&callback=initMap"></script>
          </head>
          <body>
            <div id="map"></div>
          </body>
        </html>
      ''');
    print('WebView initialized');
  }

  void _retry() {
    print('Retry triggered');
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    _controller.reload();
  }

  @override
  Widget build(BuildContext context) {
    print('Building WebView MapScreen');
    return Scaffold(
      appBar: AppBar(
        title: const Text('Map'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _retry,
            tooltip: 'Retry Map',
          ),
        ],
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_isLoading)
            const Center(child: CircularProgressIndicator()),
          if (_errorMessage != null)
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    _errorMessage!,
                    style: const TextStyle(color: Colors.red, fontSize: 16),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: _retry,
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}