// src/pages/visit/QRScan.tsx
import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import Visit from "../../models/Visit";
import "./QRScan.css";
import { verifyQrCode } from "../../apis/visitAPI";

const QRScan: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [backendError, setBackendError] = useState<string | null>(null); // For mismatch or validation errors
    const [status, setStatus] = useState<string>("Scanning..."); // Track scanning status
    const [loading, setLoading] = useState<boolean>(true);
    const [isMounted, setIsMounted] = useState<boolean>(false);
    const [isShaking, setIsShaking] = useState<boolean>(false); // For vibration animation
    const [isSuccess, setIsSuccess] = useState<boolean>(false); // For success animation
    const qrRef = useRef<HTMLDivElement>(null);
    const qrCode = useRef<Html5Qrcode | null>(null);

    // Get visit from location state
    const visit = (location.state as { visit?: Visit })?.visit;

    useEffect(() => {
        setIsMounted(true); // Set mounted state when component mounts

        if (!visit || !visit.visitID) {
            console.error("No visit data provided. Please go back and select a visit.");
            setLoading(false);
            setStatus("");
            return;
        }

        if (!isMounted || !qrRef.current) {
            console.log("Ref check:", qrRef.current); // Debug ref
            console.error("Failed to initialize QR scanner. Element not found.");
            setLoading(false);
            setStatus("");
            return;
        }

        // Initialize Html5Qrcode
        const html5QrCode = new Html5Qrcode("qr-reader");
        qrCode.current = html5QrCode;

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        const qrCodeSuccessCallback = async (decodedText: string, decodedResult: any) => {
            setStatus("QR Code Detected"); // Show detection
            await new Promise((resolve) => setTimeout(resolve, 1500)); // Delay for visibility
            setStatus("Checking..."); // Update status when checking
            await new Promise((resolve) => setTimeout(resolve, 1500)); // Delay for visibility

            try {
                const response = await verifyQrCode({
                    qrData: decodedText,
                    visitId: visit.visitID,
                });

                if (response.valid) {
                    setStatus("Validating..."); // Show validation status
                    await new Promise((resolve) => setTimeout(resolve, 1500)); // Delay for visibility
                    setIsSuccess(true); // Trigger success animation
                    await new Promise((resolve) => setTimeout(resolve, 1000)); // Allow animation to play
                    navigate(`/visit/${visit.visitID}/validate-checklist`);  // Redirect on success
                } else {
                    setBackendError("Mismatch error"); // Display mismatch error
                    setIsShaking(true); // Trigger vibration animation
                    await new Promise((resolve) => setTimeout(resolve, 1000)); // Vibration duration
                    setIsShaking(false); // Stop vibration
                    setStatus("Scanning..."); // Resume scanning without stopping camera
                }
            } catch (err) {
                setBackendError("Mismatch error"); // Assume mismatch if backend fails
                setIsShaking(true); // Trigger vibration animation
                await new Promise((resolve) => setTimeout(resolve, 1000)); // Vibration duration
                setIsShaking(false); // Stop vibration
                setStatus("Scanning..."); // Resume scanning without stopping camera
                console.error("QR verification error:", err);
            }
        };

        const qrCodeErrorCallback = (error: string) => {
            console.warn(`QR scan error: ${error}`);
            // Log errors but don't display them in the UI
            if (error.includes("NotAllowedError")) {
                console.error("Camera access denied. Please allow camera access and try again.");
            } else if (error.includes("NotFoundError")) {
                console.error("No camera found on this device.");
            }
        };

        // Start QR code scanning
        html5QrCode
            .start(
                { facingMode: "environment" }, // Prefer rear camera
                config,
                qrCodeSuccessCallback,
                qrCodeErrorCallback
            )
            .then(() => {
                setLoading(false);
                console.log("Camera started successfully");
            })
            .catch((err) => {
                console.error("Failed to start camera:", err.message);
                setLoading(false);
                setStatus("");
            });

        // Cleanup on unmount
        return () => {
            if (qrCode.current) {
                qrCode.current
                    .stop()
                    .then(() => qrCode.current?.clear())
                    .catch((err) => console.error("Cleanup error:", err));
            }
            setIsMounted(false);
        };
    }, [visit, navigate, isMounted]);

    const handleBack = () => {
        navigate(-1); // Go back to previous page (VisitDetails)
    };

    if (!visit || !visit.visitID) {
        return (
            <div className="qr-scan-container">
                <div className="qr-scan-error-card">
                    <h2>Oops!</h2>
                    <p>No visit selected.</p>
                    <button className="qr-back-btn" onClick={handleBack}>
                        Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="qr-scan-container">
            <header className="qr-header">
                <h1>Scan QR Code</h1>
                <p>Align the QR code within the frame to validate the visit.</p>
            </header>
            <section className={`qr-scan-card ${isShaking ? "shake" : ""} ${isSuccess ? "success" : ""}`}>
                {loading ? (
                    <div className="qr-loading">
                        <p>Starting camera...</p>
                    </div>
                ) : (
                    <>
                        <div id="qr-reader" className="qr-reader" ref={qrRef}></div>
                        <div className="qr-status">
                            <p>{status}</p>
                        </div>
                        {backendError && (
                            <div className="qr-error">
                                <p>{backendError}</p>
                            </div>
                        )}
                    </>
                )}
            </section>
            <div className="qr-actions">
                <button className="qr-back-btn" onClick={handleBack}>
                    Back
                </button>
            </div>
        </div>
    );
};

export default QRScan;