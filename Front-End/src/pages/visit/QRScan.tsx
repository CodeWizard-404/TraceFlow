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

    // Extract visit from location state and start camera
    useEffect(() => {
        const visitFromState = (location.state as { visit?: Visit })?.visit;
        if (visitFromState) {
            setVisit(visitFromState);
            startCamera();
        } else {
            setError("No visit data provided.");
        }

        // Cleanup on unmount
        return () => stopCamera();
    }, [location.state]);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" }, // Prefer rear camera
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                videoRef.current.play();
                requestAnimationFrame(scanQRCode);
            }
        } catch (err) {
            setError("Failed to access camera. Please ensure camera permission is granted.");
            console.error(err);
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
        }
    };

    const scanQRCode = () => {
        if (!videoRef.current || !canvasRef.current || loading) {
            requestAnimationFrame(scanQRCode);
            return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        if (!context) return;

        // Set canvas size to video size
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame on canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

        // Scan for QR code
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

        if (qrCode && qrCode.data && visit) {
            verifyQR(qrCode.data, visit.visitID);
        } else {
            requestAnimationFrame(scanQRCode); // Continue scanning
        }
    };

    const verifyQR = async (qrData: string, visitId: string) => {
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const response = await verifyQrCode({ qrData, visitId });
            if (response.valid) {
                stopCamera();
                navigate("/timesheet");
            } else {
                setMessage(response.message || "QR code verification failed.");
                setLoading(false);
                requestAnimationFrame(scanQRCode); // Resume scanning
            }
        } catch (err) {
            setError("Failed to verify QR code.");
            console.error(err);
            setLoading(false);
            requestAnimationFrame(scanQRCode); // Resume scanning
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
                    <canvas ref={canvasRef} className="qr-canvas" style={{ display: "none" }} />
                    <div className="qr-overlay">
                        <div className="qr-frame"></div>
                    </div>
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