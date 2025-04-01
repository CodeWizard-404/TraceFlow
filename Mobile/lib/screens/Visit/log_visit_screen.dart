import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../models/checklist.dart';
import '../../models/visit.dart';
import '../../models/visit_checklist.dart';
import '../../providers/auth_provider.dart';
import '../../providers/visit_provider.dart';
import '../../providers/checklist_provider.dart';
import '../../providers/agent_provider.dart';
import '../Error.dart';

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
    WidgetsBinding.instance.addObserver(this);
    _initializeCamera();
    _fetchVisitData();
    _entryTime = DateTime.now();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _isCameraInitialized && _isCameraActive) {
      _cameraController.initialize().then((_) {
        if (mounted) setState(() {});
      }).catchError((e) {
        _showSnackBar('Camera resume failed: $e');
      });
    }
  }

  Future<void> _initializeCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras.isEmpty) {
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
      });
    } catch (e) {
      _showError('Camera initialization failed: $e');
    }
  }

  Future<void> _fetchVisitData() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final visitProvider = Provider.of<VisitProvider>(context, listen: false);
    final checklistProvider = Provider.of<ChecklistProvider>(context, listen: false);
    final agentProvider = Provider.of<AgentProvider>(context, listen: false);

    if (authProvider.token == null) {
      _showError('No authentication token found');
      return;
    }

    try {
      await Future.wait([
        visitProvider.fetchVisitById(widget.visitID, authProvider.token!),
        checklistProvider.getChecklistsByVisitId(widget.visitID, authProvider.token!),
      ]);
      _visit = visitProvider.currentVisit;
      if (_visit?.agentID != null) {
        await agentProvider.fetchAgentById(_visit!.agentID, authProvider.token!);
      }
      setState(() {
        _checklists = checklistProvider.checklists;
      });
    } catch (error) {
      _showError('Failed to load visit data: $error');
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _cameraController.dispose();
    super.dispose();
  }

  void _showError(String message) {
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
    if (!_isCameraInitialized) return;
    await _cameraController.setFlashMode(FlashMode.off);
    setState(() {
      _isCameraActive = true;
    });
  }

  void _stopCamera() {
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
    setState(() => _isTakingPicture = true);

    try {
      await _cameraController.setFlashMode(_isFlashOn ? FlashMode.torch : FlashMode.off);
      final photo = await _cameraController.takePicture();
      setState(() {
        _photos.insert(0, photo);
        _lastCapturedPhoto = photo;
      });
      await Future.delayed(const Duration(milliseconds: 500));
      setState(() => _isTakingPicture = false);
      if (!_isFlashOn) await _cameraController.setFlashMode(FlashMode.off);
    } catch (e) {
      _showSnackBar('Error capturing photo: $e');
      setState(() => _isTakingPicture = false);
    }
  }

  void _toggleFlash() {
    setState(() {
      _isFlashOn = !_isFlashOn;
    });
    _cameraController.setFlashMode(_isFlashOn ? FlashMode.torch : FlashMode.off);
  }

  Future<void> _switchCamera() async {
    if (!_isCameraInitialized || !_isCameraActive || _isFlippingCamera) return;

    setState(() => _isFlippingCamera = true);

    try {
      // Step 1: Stop the current camera preview
      await _cameraController.setFlashMode(FlashMode.off); // Ensure flash is off
      await _cameraController.dispose();

      // Step 2: Switch to new camera
      _currentCameraIndex = (_currentCameraIndex + 1) % _cameras.length;
      _cameraController = CameraController(
        _cameras[_currentCameraIndex],
        ResolutionPreset.max,
        enableAudio: false,
      );

      // Step 3: Initialize new camera
      await _cameraController.initialize();
      await _cameraController.setZoomLevel(_zoomLevel);

      // Step 4: Update state
      setState(() {
        _nativeAspectRatio = 9 / 12;
        _isFlippingCamera = false;
      });
    } catch (e) {
      _showSnackBar('Camera switch failed: $e');
      // Reinitialize the original camera on failure
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
    });
    _cameraController.setZoomLevel(_zoomLevel);
  }

  Future<void> _onTapFocus(TapDownDetails details) async {
    if (!_isCameraInitialized || !_isCameraActive) return;
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
    });
    _cameraController.setZoomLevel(_zoomLevel);
  }

  void _removePhoto(int index) {
    setState(() {
      _photos.removeAt(index);
    });
  }

  void _viewPhotoFullScreen(int initialIndex) {
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
    if (_photos.isEmpty) return;
    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: Colors.grey[900],
          title: Text('Captured Photos (${_photos.length})', style: const TextStyle(color: Colors.white)),
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
                          border: Border.all(color: Colors.white24, width: 1),
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.2),
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            ),
                          ],
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
                          },
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: Colors.black54,
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.red, width: 1),
                            ),
                            child: const Icon(Icons.close, color: Colors.red, size: 18),
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
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Close', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  void _toggleChecklist(String checklistId, bool checked) {
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
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final visitProvider = Provider.of<VisitProvider>(context, listen: false);

    if (authProvider.token == null) {
      _showError('No authentication token found');
      return;
    }

    if (_photos.isEmpty) {
      _showSnackBar('At least one photo is required');
      return;
    }

    try {
      final duration = _entryTime != null ? DateTime.now().difference(_entryTime!).inMinutes : 0;
      final checklistUpdates = _checklists.map((c) => {
        'checklistID': c.checklistID,
        'checked': c.visitChecklist?.checked ?? false,
      }).toList();

      await visitProvider.logVisit(
        visitId: widget.visitID,
        token: authProvider.token!,
        duration: duration,
        checklistUpdates: checklistUpdates,
        photoPaths: _photos.map((p) => p.path).toList(),
        comment: _comment,
      );

      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Visit validated successfully')),
      );
    } catch (error) {
      _showError('Failed to validate visit: $error');
    }
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red.withOpacity(0.9),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  double _getAspectRatio(BuildContext context) {
    final orientation = MediaQuery.of(context).orientation;
    return orientation == Orientation.portrait ? 9 / 12 : 12 / 9;
  }

  bool _isFrontCamera() {
    return _cameras[_currentCameraIndex].lensDirection == CameraLensDirection.front;
  }

  void _toggleMinimalView() {
    setState(() {
      _isMinimalView = !_isMinimalView;
    });
  }

  @override
  Widget build(BuildContext context) {
    final visitProvider = Provider.of<VisitProvider>(context);
    final checklistProvider = Provider.of<ChecklistProvider>(context);
    final agentProvider = Provider.of<AgentProvider>(context);

    return Scaffold(
      appBar: _isCameraActive
          ? null
          : PreferredSize(
        preferredSize: const Size.fromHeight(80.0),
        child: AppBar(
          title: const Text('Log Visit', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          centerTitle: true,
          flexibleSpace: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Theme.of(context).colorScheme.primary,
                  Theme.of(context).colorScheme.secondary,
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
          ),
        ),
      ),
      body: (!_isCameraInitialized && _isCameraActive)
          ? Container(color: Colors.black)
          : visitProvider.isLoading || checklistProvider.isLoading || agentProvider.isLoading || !_isCameraInitialized
          ? const Center(child: CircularProgressIndicator())
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
                  child: const Center(
                    child: CircularProgressIndicator(color: Colors.white),
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
                  color: Colors.black87,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.3),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Text(
                  '${_photos.length} Photos',
                  style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                ),
              ),
            ),
            Positioned(
              top: 40,
              right: 80,
              child: FloatingActionButton(
                heroTag: 'toggle_view',
                backgroundColor: Colors.black87,
                elevation: 2,
                onPressed: _toggleMinimalView,
                child: Icon(_isMinimalView ? Icons.visibility : Icons.visibility_off, color: Colors.white),
              ),
            ),
            Positioned(
              top: 40,
              right: 20,
              child: FloatingActionButton(
                heroTag: 'close',
                backgroundColor: Colors.black87,
                elevation: 2,
                onPressed: _stopCamera,
                child: const Icon(Icons.close, color: Colors.white),
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
                    activeColor: Colors.white,
                    inactiveColor: Colors.white30,
                    thumbColor: Colors.white,
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
                      border: Border.all(color: Colors.white, width: 2),
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
                              border: Border.all(color: Colors.white24, width: 1),
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
                                  color: Colors.black54,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: Colors.red, width: 1),
                                ),
                                child: const Icon(Icons.close, color: Colors.red, size: 18),
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
                              border: Border.all(color: Colors.white24, width: 1),
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
                                  color: Colors.black54,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: Colors.red, width: 1),
                                ),
                                child: const Icon(Icons.close, color: Colors.red, size: 18),
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
                      backgroundColor: Colors.black87,
                      elevation: 2,
                      onPressed: _toggleFlash,
                      child: Icon(_isFlashOn ? Icons.flash_on : Icons.flash_off, color: Colors.white),
                    ),
                  FloatingActionButton(
                    heroTag: 'capture',
                    backgroundColor: Colors.white,
                    elevation: 4,
                    onPressed: _capturePhoto,
                    child: Icon(Icons.photo_camera, color: Theme.of(context).colorScheme.primary, size: 36),
                  ),
                  if (!_isMinimalView)
                    FloatingActionButton(
                      heroTag: 'switch',
                      backgroundColor: Colors.black87,
                      elevation: 2,
                      onPressed: _switchCamera,
                      child: const Icon(Icons.flip_camera_android, color: Colors.white),
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
              _buildGlassCard(
                context,
                title: 'Visit Details',
                icon: Icons.person,
                content: [
                  _buildDetailRow(
                    context,
                    'Agent:',
                    agentProvider.currentAgent != null
                        ? '${agentProvider.currentAgent!.name} ${agentProvider.currentAgent!.lastname}'
                        : 'Loading...',
                  ),
                  _buildDetailRow(context, 'Location:', _visit?.location ?? 'N/A'),
                ],
              ),
              const SizedBox(height: 16),
              _buildGlassCard(
                context,
                title: 'Reasons',
                icon: Icons.question_answer,
                content: _visit?.reasons?.isEmpty ?? true
                    ? [const Text('No reasons specified')]
                    : _visit!.reasons!.map((r) => Text(r.item ?? 'N/A')).toList(),
              ),
              const SizedBox(height: 16),
              _buildGlassCard(
                context,
                title: 'Camera & Photos',
                icon: Icons.camera_alt,
                content: [
                  ElevatedButton(
                    onPressed: _startCamera,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Theme.of(context).colorScheme.primary,
                      foregroundColor: Theme.of(context).colorScheme.onPrimary,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Start Camera'),
                  ),
                  if (_photos.isNotEmpty) ...[
                    const SizedBox(height: 12),
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
                                  border: Border.all(color: Colors.grey.shade300, width: 1),
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
                                      color: Colors.black54,
                                      shape: BoxShape.circle,
                                      border: Border.all(color: Colors.red, width: 1),
                                    ),
                                    child: const Icon(Icons.close, color: Colors.red, size: 18),
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
              const SizedBox(height: 16),
              _buildGlassCard(
                context,
                title:
                'Checklist (${_checklists.where((c) => c.visitChecklist?.checked ?? false).length}/${_checklists.length})',
                icon: Icons.checklist,
                content: _checklists.isEmpty
                    ? [const Text('No checklist items available')]
                    : _checklists.map((c) => CheckboxListTile(
                  title: Text(c.item ?? 'N/A'),
                  value: c.visitChecklist?.checked ?? false,
                  onChanged: (value) => _toggleChecklist(c.checklistID!, value ?? false),
                  activeColor: Theme.of(context).colorScheme.primary,
                  controlAffinity: ListTileControlAffinity.leading,
                  dense: true,
                )).toList(),
              ),
              const SizedBox(height: 16),
              _buildGlassCard(
                context,
                title: 'Comment',
                icon: Icons.comment,
                content: [
                  TextField(
                    onChanged: (value) => _comment = value,
                    decoration: InputDecoration(
                      labelText: 'Add a comment (optional)',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    maxLines: 3,
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildActionButton(
                    context,
                    icon: Icons.check,
                    label: 'Validate Visit',
                    onPressed: _validateVisit,
                  ),
                  _buildActionButton(
                    context,
                    icon: Icons.arrow_back,
                    label: 'Back',
                    onPressed: () => Navigator.pop(context),
                    gradientColors: [Colors.grey, Colors.grey.shade700],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildGlassCard(BuildContext context,
      {required String title, required IconData icon, required List<Widget> content}) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Theme.of(context).colorScheme.surface.withOpacity(0.9),
            Theme.of(context).colorScheme.surface.withOpacity(0.7),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.primary.withOpacity(0.1),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Theme.of(context).colorScheme.primary.withOpacity(0.1),
                  ),
                  child: Icon(icon, color: Theme.of(context).colorScheme.primary, size: 20),
                ),
                const SizedBox(width: 12),
                Text(title, style: Theme.of(context).textTheme.headlineSmall),
              ],
            ),
            const SizedBox(height: 16),
            ...content,
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7)),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(value, style: Theme.of(context).textTheme.bodyMedium)),
        ],
      ),
    );
  }

  Widget _buildActionButton(
      BuildContext context, {
        required IconData icon,
        required String label,
        required VoidCallback onPressed,
        List<Color> gradientColors = const [],
      }) {
    final colors = gradientColors.isNotEmpty
        ? gradientColors
        : [Theme.of(context).colorScheme.primary, Theme.of(context).colorScheme.secondary];
    return GestureDetector(
      onTap: onPressed,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: colors,
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(color: colors[0].withOpacity(0.4), blurRadius: 12, offset: const Offset(0, 4)),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.onPrimary, size: 20),
            const SizedBox(width: 8),
            Text(
              label,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: Theme.of(context).colorScheme.onPrimary, fontWeight: FontWeight.bold),
            ),
          ],
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
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: _currentIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.black,
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.delete, color: Colors.red),
            onPressed: () {
              widget.onRemove(_currentIndex);
              if (widget.photos.isEmpty) {
                Navigator.pop(context);
              } else {
                setState(() {
                  if (_currentIndex >= widget.photos.length) {
                    _currentIndex = widget.photos.length - 1;
                  }
                  _pageController.jumpToPage(_currentIndex);
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
                      color: Colors.grey.withOpacity(0.5),
                      colorBlendMode: BlendMode.modulate,
                    ),
                    const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    ),
                  ],
                );
              },
            ),
          );
        },
      ),
      backgroundColor: Colors.black,
    );
  }
}