import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

class CustomCameraPreview extends StatefulWidget {
  final CameraController controller;
  final Widget? overlay;

  const CustomCameraPreview({
    required this.controller,
    this.overlay,
    super.key,
  });

  @override
  CustomCameraPreviewState createState() => CustomCameraPreviewState();
}

class CustomCameraPreviewState extends State<CustomCameraPreview> {
  @override
  Widget build(BuildContext context) {
    if (!widget.controller.value.isInitialized) {
      return const Center(child: CircularProgressIndicator());
    }
    return Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: AspectRatio(
            aspectRatio: widget.controller.value.aspectRatio,
            child: CameraPreview(widget.controller),
          ),
        ),
        if (widget.overlay != null) widget.overlay!,
        Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: Theme.of(context).colorScheme.primary.withOpacity(0.5),
              width: 2,
            ),
          ),
        ),
      ],
    );
  }

  @override
  void dispose() {
    widget.controller.dispose();
    super.dispose();
  }
}