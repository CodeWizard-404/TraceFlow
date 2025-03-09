// src/pages/visit/QRScan.tsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaQrcode, FaArrowLeft } from "react-icons/fa";
import jsQR from "jsqr";
import Visit from "../../models/Visit";
import "./QRScan.css";
import { verifyQrCode } from "../../apis/visitAPI";

const QRScan: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [manualQrData, setManualQrData] = useState<string>(""); // Fallback input

  useEffect(() => {
    const visitFromState = (location.state as { visit?: Visit })?.visit;
    if (visitFromState) {
      setVisit(visitFromState);
      startCamera();
    } else {
      setError("No visit data provided.");
    }

    return () => stopCamera();
  }, [location.state]);

  const startCamera = async () => {
    try {
      console.log("Starting camera...");
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 640, height: 480 },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          console.log("Video metadata loaded, playing...");
          videoRef.current!.play().catch((err) => console.error("Play error:", err));
          startScanning();
        };
      }
    } catch (err) {
      setError("Failed to access camera. Please grant permission and try again.");
      console.error("Camera setup error:", err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      console.log("Stopping camera...");
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const startScanning = () => {
    if (!videoRef.current || !canvasRef.current) {
      console.error("Video or canvas ref not ready");
      return;
    }

    const scanInterval = setInterval(() => {
      if (loading) return; // Skip if verifying

      const video = videoRef.current!;
      const canvas = canvasRef.current!;
      const context = canvas.getContext("2d");

      if (!context) {
        console.error("Canvas context not available");
        clearInterval(scanInterval);
        return;
      }

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.log("Video dimensions not ready yet");
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

      if (qrCode && qrCode.data) {
        console.log("QR Code Detected:", qrCode.data);
        clearInterval(scanInterval); // Stop scanning
        verifyQR(qrCode.data, visit!.visitID);
      } else {
        console.log("Scanning... No QR code detected yet");
      }
    }, 500); // Scan every 500ms

    // Cleanup interval on unmount or stop
    return () => clearInterval(scanInterval);
  };

  const verifyQR = async (qrData: string, visitId: string) => {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      console.log("Verifying QR:", { qrData, visitId });
      const response = await verifyQrCode({ qrData, visitId });
      console.log("API Response:", response);
      if (response.valid) {
        stopCamera();
        navigate("/timesheet");
      } else {
        setMessage(response.message || "QR code verification failed.");
        setLoading(false);
        startScanning(); // Resume scanning
      }
    } catch (err) {
      setError("Failed to verify QR code.");
      console.error("Verification error:", err);
      setLoading(false);
      startScanning(); // Resume scanning
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualQrData && visit) {
      verifyQR(manualQrData, visit.visitID);
    }
  };

  const handleBack = () => {
    stopCamera();
    navigate("/timesheet");
  };

  if (!visit && !error) return <div className="loading">Loading visit data...</div>;
  if (error) return (
    <div className="qr-scan-container">
      <div className="error-card">
        <h2>Oops!</h2>
        <p>{error}</p>
        <button className="back-btn" onClick={handleBack}>
          <FaArrowLeft /> Back
        </button>
      </div>
    </div>
  );

  return (
    <div className="qr-scan-container">
      <header className="qr-header">
        <h1>
          <FaQrcode /> Scan QR Code
        </h1>
      </header>
      <section className="qr-card">
        <div className="qr-scanner">
          <video ref={videoRef} className="qr-video" muted playsInline />
          <canvas ref={canvasRef} className="qr-canvas" />
          <div className="qr-overlay">
            <div className="qr-frame"></div>
          </div>
          {!loading && <div className="scanning-indicator">Scanning...</div>}
        </div>
        {message && (
          <div className="message">
            <p>{message}</p>
          </div>
        )}
        {loading && (
          <div className="loading-overlay">
            <span>Verifying...</span>
          </div>
        )}
        {/* Fallback manual input */}
        <form onSubmit={handleManualSubmit} className="manual-input">
          <input
            type="text"
            value={manualQrData}
            onChange={(e) => setManualQrData(e.target.value)}
            placeholder="Enter QR data manually (for testing)"
            className="qr-input"
            disabled={loading}
          />
          <button type="submit" className="scan-btn" disabled={loading}>
            Verify Manually
          </button>
        </form>
        <div className="qr-actions">
          <button className="back-btn" onClick={handleBack} disabled={loading}>
            <FaArrowLeft /> Back
          </button>
        </div>
      </section>
    </div>
  );
};

export default QRScan;