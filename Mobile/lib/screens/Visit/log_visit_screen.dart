import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:provider/provider.dart';
import '../../models/checklist.dart';
import '../../models/visit.dart';
import '../../models/visit_checklist.dart';
import '../../providers/auth_provider.dart';
import '../../providers/visit_provider.dart';
import '../../providers/checklist_provider.dart';
import '../../providers/agent_provider.dart';
import '../../widgets/commen/snack_bar.dar.dart';
import '../Error.dart';
import '../../widgets/appbar/app_bar.dart';
import '../../widgets/commen/button.dart';
import '../../widgets/commen/progress_indicator.dart';
import '../../widgets/commen/spacer.dart';

class LogVisitScreen extends StatefulWidget {
  final String visitID;
  final int weekNumber;
  final int year;

  const LogVisitScreen({
    super.key,
    required this.visitID,
    required this.weekNumber,
    required this.year,
  });

  @override
  _LogVisitScreenState createState() => _LogVisitScreenState();
}

class _LogVisitScreenState extends State<LogVisitScreen> with WidgetsBindingObserver {
  late CameraController _cameraController;
  late List<CameraDescription> _cameras;
  bool _isCameraInitialized = false;
  bool _isCameraActive = false;
  bool _isFlashOn = false;
  List<Checklist> _checklists = [];
  List<XFile> _photos = [];
  String _comment = '';
  DateTime? _entryTime;
  Visit? _visit;
  bool _isTakingPicture = false;
  int _currentCameraIndex = 0;
  double _zoomLevel = 1.0;
  double _minZoom = 1.0;
  double _maxZoom = 1.0;
  XFile? _lastCapturedPhoto;
  double? _nativeAspectRatio;
  bool _isMinimalView = false;
  bool _isFlippingCamera = false;

  @override
  void initState() {
    super.initState();
    if (kDebugMode) print('LogVisitScreen initState for visitID: ${widget.visitID}');
    WidgetsBinding.instance.addObserver(this);
    _initializeCamera();
    _fetchVisitData();
    _entryTime = DateTime.now();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (kDebugMode) print('AppLifecycleState changed to: $state');
    if (state == AppLifecycleState.resumed && _isCameraInitialized && _isCameraActive) {
      _cameraController.initialize().then((_) {
        if (mounted) setState(() {});
        if (kDebugMode) print('Camera resumed');
      }).catchError((e) {
        if (kDebugMode) print('Camera resume failed: $e');
        _showSnackBar('Camera resume failed: $e');
      });
    }
  }

  Future<void> _initializeCamera() async {
    if (kDebugMode) print('Initializing camera');
    try {
      _cameras = await availableCameras();
      if (_cameras.isEmpty) {
        if (kDebugMode) print('No cameras available');
        _showError('No cameras available');
        return;
      }
      _currentCameraIndex = 0;
      _cameraController = CameraController(
        _cameras[_currentCameraIndex],
        ResolutionPreset.max,
        enableAudio: false,
      );
      await _cameraController.initialize();
      _minZoom = await _cameraController.getMinZoomLevel();
      _maxZoom = await _cameraController.getMaxZoomLevel();
      await _cameraController.setZoomLevel(_zoomLevel);
      _nativeAspectRatio = 9 / 12;
      setState(() {
        _isCameraInitialized = true;
        if (kDebugMode) print('Camera initialized');
      });
    } catch (e) {
      if (kDebugMode) print('Camera initialization failed: $e');
      _showError('Camera initialization failed: $e');
    }
  }

  Future<void> _fetchVisitData() async {
    if (kDebugMode) print('Fetching visit data for visitID: ${widget.visitID}');
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final visitProvider = Provider.of<VisitProvider>(context, listen: false);
    final checklistProvider = Provider.of<ChecklistProvider>(context, listen: false);
    final agentProvider = Provider.of<AgentProvider>(context, listen: false);

    try {
      await Future.wait([
        visitProvider.fetchVisitById(widget.visitID),
        checklistProvider.getChecklistsByVisitId(widget.visitID),
      ]);
      _visit = visitProvider.currentVisit;
      if (_visit?.agentID != null) {
        await agentProvider.fetchAgentById(_visit!.agentID);
      }
      setState(() {
        _checklists = checklistProvider.checklists;
        if (kDebugMode) print('Fetched ${_checklists.length} checklists');
      });
    } catch (error) {
      if (kDebugMode) print('Error fetching visit data: $error');
      _showError('Failed to load visit data: $error');
      if (error.toString().contains('401')) {
        await authProvider.logout();
        Navigator.pushReplacementNamed(context, '/login');
      }
    }
  }

  @override
  void dispose() {
    if (kDebugMode) print('Disposing LogVisitScreen');
    WidgetsBinding.instance.removeObserver(this);
    _cameraController.dispose();
    super.dispose();
  }

  void _showError(String message) {
    if (kDebugMode) print('Showing error: $message');
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ErrorPage(
          errorMessage: message,
          onRetry: () {
            Navigator.pop(context);
            _fetchVisitData();
          },
        ),
      ),
    );
  }

  Future<void> _startCamera() async {
    if (kDebugMode) print('Starting camera');
    if (!_isCameraInitialized) return;
    await _cameraController.setFlashMode(FlashMode.off);
    setState(() {
      _isCameraActive = true;
    });
  }

  void _stopCamera() {
    if (kDebugMode) print('Stopping camera');
    setState(() {
      _isCameraActive = false;
      _lastCapturedPhoto = null;
      _isMinimalView = false;
      _isFlippingCamera = false;
    });
    _showPhotoPreview();
  }

  Future<void> _capturePhoto() async {
    if (!_isCameraInitialized || !_isCameraActive || _isTakingPicture) return;
    if (kDebugMode) print('Capturing photo');
    setState(() => _isTakingPicture = true);

    try {
      await _cameraController.setFlashMode(_isFlashOn ? FlashMode.torch : FlashMode.off);
      final photo = await _cameraController.takePicture();
      setState(() {
        _photos.insert(0, photo);
        _lastCapturedPhoto = photo;
        if (kDebugMode) print('Photo captured, total photos: ${_photos.length}');
      });
      await Future.delayed(const Duration(milliseconds: 500));
      setState(() => _isTakingPicture = false);
      if (!_isFlashOn) await _cameraController.setFlashMode(FlashMode.off);
    } catch (e) {
      if (kDebugMode) print('Error capturing photo: $e');
      _showSnackBar('Error capturing photo: $e');
      setState(() => _isTakingPicture = false);
    }
  }

  void _toggleFlash() {
    if (kDebugMode) print('Toggling flash: ${_isFlashOn ? 'off' : 'on'}');
    setState(() {
      _isFlashOn = !_isFlashOn;
    });
    _cameraController.setFlashMode(_isFlashOn ? FlashMode.torch : FlashMode.off);
  }

  Future<void> _switchCamera() async {
    if (!_isCameraInitialized || !_isCameraActive || _isFlippingCamera) return;
    if (kDebugMode) print('Switching camera');
    setState(() => _isFlippingCamera = true);

    try {
      await _cameraController.setFlashMode(FlashMode.off);
      await _cameraController.dispose();

      _currentCameraIndex = (_currentCameraIndex + 1) % _cameras.length;
      _cameraController = CameraController(
        _cameras[_currentCameraIndex],
        ResolutionPreset.max,
        enableAudio: false,
      );

      await _cameraController.initialize();
      await _cameraController.setZoomLevel(_zoomLevel);

      setState(() {
        _nativeAspectRatio = 9 / 12;
        _isFlippingCamera = false;
        if (kDebugMode) print('Camera switched to index: $_currentCameraIndex');
      });
    } catch (e) {
      if (kDebugMode) print('Camera switch failed: $e');
      _showSnackBar('Camera switch failed: $e');
      _cameraController = CameraController(
        _cameras[_currentCameraIndex],
        ResolutionPreset.max,
        enableAudio: false,
      );
      await _cameraController.initialize();
      setState(() => _isFlippingCamera = false);
    }
  }

  void _onScaleUpdate(ScaleUpdateDetails details) {
    setState(() {
      _zoomLevel = (_zoomLevel + (details.scale - 1) * 0.5).clamp(_minZoom, _maxZoom);
      if (kDebugMode) print('Zoom level updated: $_zoomLevel');
    });
    _cameraController.setZoomLevel(_zoomLevel);
  }

  Future<void> _onTapFocus(TapDownDetails details) async {
    if (!_isCameraInitialized || !_isCameraActive) return;
    if (kDebugMode) print('Setting focus point');
    final offset = Offset(
      details.localPosition.dx / MediaQuery.of(context).size.width,
      details.localPosition.dy / MediaQuery.of(context).size.height,
    );
    await _cameraController.setFocusPoint(offset);
    await _cameraController.setExposurePoint(offset);
  }

  void _onZoomChanged(double value) {
    setState(() {
      _zoomLevel = value;
      if (kDebugMode) print('Zoom changed to: $_zoomLevel');
    });
    _cameraController.setZoomLevel(_zoomLevel);
  }

  void _removePhoto(int index) {
    setState(() {
      _photos.removeAt(index);
      if (kDebugMode) print('Removed photo at index $index, total photos: ${_photos.length}');
    });
  }

  void _viewPhotoFullScreen(int initialIndex) {
    if (kDebugMode) print('Viewing photo gallery at index: $initialIndex');
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => PhotoGalleryScreen(
          photos: _photos,
          initialIndex: initialIndex,
          onRemove: _removePhoto,
        ),
      ),
    );
  }

  void _showPhotoPreview() {
    if (_photos.isEmpty) {
      if (kDebugMode) print('No photos to preview');
      return;
    }
    if (kDebugMode) print('Showing photo preview with ${_photos.length} photos');
    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: Theme.of(context).cardTheme.color,
          title: Text(
            'Captured Photos (${_photos.length})',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          content: SizedBox(
            width: double.maxFinite,
            height: 400,
            child: GridView.builder(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
                childAspectRatio: 1,
              ),
              itemCount: _photos.length,
              itemBuilder: (context, index) {
                return GestureDetector(
                  onTap: () => _viewPhotoFullScreen(index),
                  child: Stack(
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: Theme.of(context).dividerColor, width: 1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.file(
                            File(_photos[index].path),
                            width: 150,
                            height: 150,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                      Positioned(
                        top: 4,
                        right: 4,
                        child: GestureDetector(
                          onTap: () {
                            setDialogState(() => _removePhoto(index));
                            setState(() {});
                            if (kDebugMode) print('Removed photo from preview at index: $index');
                          },
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.background.withOpacity(0.7),
                              shape: BoxShape.circle,
                              border: Border.all(color: Theme.of(context).colorScheme.error, width: 1),
                            ),
                            child: Icon(Icons.close, color: Theme.of(context).colorScheme.error, size: 18),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
          actions: [
            CustomButton(
              label: 'Close',
              onPressed: () {
                if (kDebugMode) print('Closing photo preview');
                Navigator.pop(context);
              },
            ),
          ],
        ),
      ),
    );
  }

  void _toggleChecklist(String checklistId, bool checked) {
    if (kDebugMode) print('Toggling checklist $checklistId to $checked');
    setState(() {
      final index = _checklists.indexWhere((c) => c.checklistID == checklistId);
      if (index != -1) {
        _checklists[index] = Checklist(
          checklistID: checklistId,
          item: _checklists[index].item,
          visitChecklist: VisitChecklist(
            checked: checked,
            visitID: widget.visitID,
            checklistID: checklistId,
          ),
        );
      }
    });
  }

  Future<void> _validateVisit() async {
    if (kDebugMode) print('Validating visit: ${widget.visitID}');
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final visitProvider = Provider.of<VisitProvider>(context, listen: false);

    if (_photos.isEmpty) {
      if (kDebugMode) print('Validation failed: no photos');
      _showSnackBar('At least one photo is required');
      return;
    }

    try {
      final duration = _entryTime != null ? DateTime.now().difference(_entryTime!).inMinutes : 0;
      final checklistUpdates = _checklists
          .map((c) => {
        'checklistID': c.checklistID,
        'checked': c.visitChecklist?.checked ?? false,
      })
          .toList();

      await visitProvider.logVisit(
        visitId: widget.visitID,
        duration: duration,
        checklistUpdates: checklistUpdates,
        photoPaths: _photos.map((p) => p.path).toList(),
        comment: _comment,
      );
      if (kDebugMode) print('Visit validated successfully');
      Navigator.pop(context);
      CustomSnackBar.show(
        context: context,
        message: 'Visit validated successfully',
        backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.9),
      );
    } catch (error) {
      if (kDebugMode) print('Error validating visit: $error');
      _showError('Failed to validate visit: $error');
      if (error.toString().contains('401')) {
        await authProvider.logout();
        Navigator.pushReplacementNamed(context, '/login');
      }
    }
  }

  void _showSnackBar(String message) {
    if (kDebugMode) print('Showing snackbar: $message');
    CustomSnackBar.show(
      context: context,
      message: message,
      backgroundColor: Theme.of(context).colorScheme.error.withOpacity(0.9),
    );
  }

  double _getAspectRatio(BuildContext context) {
    final orientation = MediaQuery.of(context).orientation;
    final ratio = orientation == Orientation.portrait ? 9 / 12 : 12 / 9;
    if (kDebugMode) print('Camera aspect ratio: $ratio');
    return ratio;
  }

  bool _isFrontCamera() {
    final isFront = _cameras[_currentCameraIndex].lensDirection == CameraLensDirection.front;
    if (kDebugMode) print('Using ${isFront ? 'front' : 'back'} camera');
    return isFront;
  }

  void _toggleMinimalView() {
    setState(() {
      _isMinimalView = !_isMinimalView;
      if (kDebugMode) print('Toggled minimal view: $_isMinimalView');
    });
  }

  Widget _buildSectionHeader(BuildContext context, String title, IconData icon) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Icon(icon, color: theme.colorScheme.primary),
        const CustomSpacer(width: 12),
        Text(title, style: theme.textTheme.headlineSmall),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final visitProvider = Provider.of<VisitProvider>(context);
    final checklistProvider = Provider.of<ChecklistProvider>(context);
    final agentProvider = Provider.of<AgentProvider>(context);

    return Scaffold(
      appBar: _isCameraActive
          ? null
          : CustomAppBar(
        title: 'Log Visit',
        showBackButton: true,
        onJumpToNow: null,
      ),
      body: (!_isCameraInitialized && _isCameraActive)
          ? Container(color: Colors.black)
          : visitProvider.isLoading || checklistProvider.isLoading || agentProvider.isLoading || !_isCameraInitialized
          ? Center(child: CustomProgressIndicator(color: theme.colorScheme.primary))
          : _isCameraActive
          ? GestureDetector(
        onTapDown: _onTapFocus,
        onScaleUpdate: _onScaleUpdate,
        child: Stack(
          children: [
            Center(
              child: AspectRatio(
                aspectRatio: _getAspectRatio(context),
                child: _isFlippingCamera
                    ? Container(
                  color: Colors.black,
                  child: Center(
                    child: CustomProgressIndicator(color: theme.colorScheme.primary),
                  ),
                )
                    : _isFrontCamera()
                    ? Transform(
                  alignment: Alignment.center,
                  transform: Matrix4.identity()..scale(-1.0, 1.0),
                  child: CameraPreview(_cameraController),
                )
                    : CameraPreview(_cameraController),
              ),
            ),
            Positioned(
              top: 40,
              left: 20,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: theme.colorScheme.background.withOpacity(0.9),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${_photos.length} Photos',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onBackground,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            Positioned(
              top: 40,
              right: 80,
              child: FloatingActionButton(
                heroTag: 'toggle_view',
                backgroundColor: theme.colorScheme.background.withOpacity(0.9),
                elevation: 0,
                onPressed: _toggleMinimalView,
                child: Icon(
                  _isMinimalView ? Icons.visibility : Icons.visibility_off,
                  color: theme.colorScheme.onBackground,
                ),
              ),
            ),
            Positioned(
              top: 40,
              right: 20,
              child: FloatingActionButton(
                heroTag: 'close',
                backgroundColor: theme.colorScheme.background.withOpacity(0.9),
                elevation: 0,
                onPressed: _stopCamera,
                child: Icon(Icons.close, color: theme.colorScheme.onBackground),
              ),
            ),
            if (!_isMinimalView)
              Positioned(
                right: 20,
                top: MediaQuery.of(context).size.height / 2 - 150,
                height: 300,
                child: RotatedBox(
                  quarterTurns: 3,
                  child: Slider(
                    value: _zoomLevel,
                    min: _minZoom,
                    max: _maxZoom,
                    onChanged: _onZoomChanged,
                    activeColor: theme.colorScheme.primary,
                    inactiveColor: theme.colorScheme.secondary.withOpacity(0.3),
                    thumbColor: theme.colorScheme.onPrimary,
                    divisions: 100,
                    label: _zoomLevel.toStringAsFixed(1),
                  ),
                ),
              ),
            if (_lastCapturedPhoto != null)
              AnimatedPositioned(
                duration: const Duration(milliseconds: 400),
                curve: Curves.easeInOut,
                top: _isTakingPicture ? MediaQuery.of(context).size.height / 2 - 150 : null,
                bottom: _isTakingPicture ? null : 150,
                left: _isTakingPicture ? MediaQuery.of(context).size.width / 2 - 100 : 20,
                width: _isTakingPicture ? 200 : 80,
                height: _isTakingPicture ? 300 : 80,
                child: AnimatedOpacity(
                  opacity: _isTakingPicture ? 1.0 : 0.7,
                  duration: const Duration(milliseconds: 400),
                  child: Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: theme.dividerColor, width: 2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.file(
                        File(_lastCapturedPhoto!.path),
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                  onEnd: () => setState(() => _lastCapturedPhoto = null),
                ),
              ),
            if (_photos.isNotEmpty && !_isMinimalView)
              MediaQuery.of(context).orientation == Orientation.portrait
                  ? Positioned(
                bottom: 100,
                left: 0,
                right: 0,
                height: 100,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: _photos.length,
                  itemBuilder: (context, index) => Padding(
                    padding: const EdgeInsets.all(4),
                    child: GestureDetector(
                      onTap: () => _viewPhotoFullScreen(index),
                      child: Stack(
                        children: [
                          Container(
                            decoration: BoxDecoration(
                              border: Border.all(color: theme.dividerColor, width: 1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.file(
                                File(_photos[index].path),
                                width: 80,
                                height: 80,
                                fit: BoxFit.cover,
                              ),
                            ),
                          ),
                          Positioned(
                            top: 4,
                            right: 4,
                            child: GestureDetector(
                              onTap: () => _removePhoto(index),
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: BoxDecoration(
                                  color: theme.colorScheme.background.withOpacity(0.7),
                                  shape: BoxShape.circle,
                                  border: Border.all(color: theme.colorScheme.error, width: 1),
                                ),
                                child: Icon(Icons.close, color: theme.colorScheme.error, size: 18),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              )
                  : Positioned(
                left: 0,
                top: 100,
                bottom: 100,
                width: 100,
                child: ListView.builder(
                  scrollDirection: Axis.vertical,
                  itemCount: _photos.length,
                  itemBuilder: (context, index) => Padding(
                    padding: const EdgeInsets.all(4),
                    child: GestureDetector(
                      onTap: () => _viewPhotoFullScreen(index),
                      child: Stack(
                        children: [
                          Container(
                            decoration: BoxDecoration(
                              border: Border.all(color: theme.dividerColor, width: 1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.file(
                                File(_photos[index].path),
                                width: 80,
                                height: 80,
                                fit: BoxFit.cover,
                              ),
                            ),
                          ),
                          Positioned(
                            top: 4,
                            right: 4,
                            child: GestureDetector(
                              onTap: () => _removePhoto(index),
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: BoxDecoration(
                                  color: theme.colorScheme.background.withOpacity(0.7),
                                  shape: BoxShape.circle,
                                  border: Border.all(color: theme.colorScheme.error, width: 1),
                                ),
                                child: Icon(Icons.close, color: theme.colorScheme.error, size: 18),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            Positioned(
              bottom: 20,
              left: 0,
              right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  if (!_isMinimalView)
                    FloatingActionButton(
                      heroTag: 'flash',
                      backgroundColor: theme.colorScheme.background.withOpacity(0.9),
                      elevation: 0,
                      onPressed: _toggleFlash,
                      child: Icon(
                        _isFlashOn ? Icons.flash_on : Icons.flash_off,
                        color: theme.colorScheme.onBackground,
                      ),
                    ),
                  FloatingActionButton(
                    heroTag: 'capture',
                    backgroundColor: theme.colorScheme.onPrimary,
                    elevation: 0,
                    onPressed: _capturePhoto,
                    child: Icon(Icons.photo_camera, color: theme.colorScheme.primary, size: 36),
                  ),
                  if (!_isMinimalView)
                    FloatingActionButton(
                      heroTag: 'switch',
                      backgroundColor: theme.colorScheme.background.withOpacity(0.9),
                      elevation: 0,
                      onPressed: _switchCamera,
                      child: Icon(Icons.flip_camera_android, color: theme.colorScheme.onBackground),
                    ),
                ],
              ),
            ),
          ],
        ),
      )
          : RefreshIndicator(
        onRefresh: _fetchVisitData,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Card(
                color: theme.cardTheme.color,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildSectionHeader(context, 'Visit Details', Icons.person),
                      const CustomSpacer(height: 16),
                      Text(
                        'Agent: ${agentProvider.currentAgent != null ? '${agentProvider.currentAgent!.name} ${agentProvider.currentAgent!.lastname}' : 'Loading...'}',
                        style: theme.textTheme.bodyMedium,
                      ),
                      const CustomSpacer(height: 8),
                      Text(
                        'Location: ${_visit?.location ?? 'N/A'}',
                        style: theme.textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ),
              const CustomSpacer(height: 16),
              Card(
                color: theme.cardTheme.color,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildSectionHeader(context, 'Reasons', Icons.question_answer),
                      const CustomSpacer(height: 16),
                      if (_visit?.reasons?.isEmpty ?? true)
                        Text('No reasons specified', style: theme.textTheme.bodyMedium)
                      else
                        ..._visit!.reasons!
                            .map((r) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text(r.item ?? 'N/A', style: theme.textTheme.bodyMedium),
                        ))
                            .toList(),
                    ],
                  ),
                ),
              ),
              const CustomSpacer(height: 16),
              Card(
                color: theme.cardTheme.color,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildSectionHeader(context, 'Camera & Photos', Icons.camera_alt),
                      const CustomSpacer(height: 16),
                      CustomButton(
                        label: 'Start Camera',
                        onPressed: _startCamera,
                      ),
                      if (_photos.isNotEmpty) ...[
                        const CustomSpacer(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: _photos.asMap().entries.map((entry) {
                            final index = entry.key;
                            final photo = entry.value;
                            return GestureDetector(
                              onTap: () => _viewPhotoFullScreen(index),
                              child: Stack(
                                children: [
                                  Container(
                                    decoration: BoxDecoration(
                                      border: Border.all(color: theme.dividerColor, width: 1),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(8),
                                      child: Image.file(
                                        File(photo.path),
                                        width: 100,
                                        height: 100,
                                        fit: BoxFit.cover,
                                      ),
                                    ),
                                  ),
                                  Positioned(
                                    top: 4,
                                    right: 4,
                                    child: GestureDetector(
                                      onTap: () => _removePhoto(index),
                                      child: Container(
                                        padding: const EdgeInsets.all(4),
                                        decoration: BoxDecoration(
                                          color: theme.colorScheme.background.withOpacity(0.7),
                                          shape: BoxShape.circle,
                                          border: Border.all(color: theme.colorScheme.error, width: 1),
                                        ),
                                        child: Icon(Icons.close, color: theme.colorScheme.error, size: 18),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const CustomSpacer(height: 16),
              Card(
                color: theme.cardTheme.color,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildSectionHeader(
                        context,
                        'Checklist (${_checklists.where((c) => c.visitChecklist?.checked ?? false).length}/${_checklists.length})',
                        Icons.checklist,
                      ),
                      const CustomSpacer(height: 16),
                      if (_checklists.isEmpty)
                        Text('No checklist items available', style: theme.textTheme.bodyMedium)
                      else
                        ..._checklists
                            .map(
                              (c) => CheckboxListTile(
                            title: Text(c.item ?? 'N/A', style: theme.textTheme.bodyMedium),
                            value: c.visitChecklist?.checked ?? false,
                            onChanged: (value) => _toggleChecklist(c.checklistID!, value ?? false),
                            activeColor: theme.colorScheme.primary,
                            controlAffinity: ListTileControlAffinity.leading,
                            dense: true,
                          ),
                        )
                            .toList(),
                    ],
                  ),
                ),
              ),
              const CustomSpacer(height: 16),
              Card(
                color: theme.cardTheme.color,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildSectionHeader(context, 'Comment', Icons.comment),
                      const CustomSpacer(height: 16),
                      TextField(
                        onChanged: (value) {
                          _comment = value;
                          if (kDebugMode) print('Comment updated: $value');
                        },
                        decoration: InputDecoration(
                          labelText: 'Add a comment (optional)',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          labelStyle: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.colorScheme.onSurface.withOpacity(0.7)),
                        ),
                        maxLines: 3,
                      ),
                    ],
                  ),
                ),
              ),
              const CustomSpacer(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  CustomButton(
                    label: 'Validate Visit',
                    onPressed: _validateVisit,
                  ),
                  CustomButton(
                    label: 'Back',
                    onPressed: () {
                      if (kDebugMode) print('Navigating back');
                      Navigator.pop(context);
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class PhotoGalleryScreen extends StatefulWidget {
  final List<XFile> photos;
  final int initialIndex;
  final Function(int) onRemove;

  const PhotoGalleryScreen({
    super.key,
    required this.photos,
    required this.initialIndex,
    required this.onRemove,
  });

  @override
  _PhotoGalleryScreenState createState() => _PhotoGalleryScreenState();
}

class _PhotoGalleryScreenState extends State<PhotoGalleryScreen> {
  late PageController _pageController;
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    if (kDebugMode) print('PhotoGalleryScreen initState, initialIndex: ${widget.initialIndex}');
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: _currentIndex);
  }

  @override
  void dispose() {
    if (kDebugMode) print('Disposing PhotoGalleryScreen');
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        backgroundColor: theme.colorScheme.background,
        leading: IconButton(
          icon: Icon(Icons.close, color: theme.colorScheme.onBackground),
          onPressed: () {
            if (kDebugMode) print('Closing PhotoGalleryScreen');
            Navigator.pop(context);
          },
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.delete, color: theme.colorScheme.error),
            onPressed: () {
              if (kDebugMode) print('Deleting photo at index: $_currentIndex');
              widget.onRemove(_currentIndex);
              if (widget.photos.isEmpty) {
                if (kDebugMode) print('No photos left, closing gallery');
                Navigator.pop(context);
              } else {
                setState(() {
                  if (_currentIndex >= widget.photos.length) {
                    _currentIndex = widget.photos.length - 1;
                  }
                  _pageController.jumpToPage(_currentIndex);
                  if (kDebugMode) print('Updated currentIndex to: $_currentIndex');
                });
              }
            },
          ),
        ],
      ),
      body: PageView.builder(
        controller: _pageController,
        itemCount: widget.photos.length,
        onPageChanged: (index) {
          setState(() {
            _currentIndex = index;
            if (kDebugMode) print('Page changed to index: $index');
          });
        },
        itemBuilder: (context, index) {
          return Center(
            child: Image.file(
              File(widget.photos[index].path),
              fit: BoxFit.contain,
              frameBuilder: (context, child, frame, wasSynchronouslyLoaded) {
                if (frame != null) {
                  return child;
                }
                return Stack(
                  alignment: Alignment.center,
                  children: [
                    Image.file(
                      File(widget.photos[index].path),
                      fit: BoxFit.contain,
                      filterQuality: FilterQuality.low,
                      color: theme.colorScheme.secondary.withOpacity(0.5),
                      colorBlendMode: BlendMode.modulate,
                    ),
                    SizedBox(
                      width: 20,
                      height: 20,
                      child: CustomProgressIndicator(color: theme.colorScheme.primary),
                    ),
                  ],
                );
              },
            ),
          );
        },
      ),
      backgroundColor: theme.colorScheme.background,
    );
  }
}