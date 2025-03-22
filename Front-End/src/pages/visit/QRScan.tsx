// src/pages/visit/QRScan.tsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import Visit from "../../models/Visit";
import "./QRScan.css";
import { verifyQrCode } from "../../apis/visitAPI";
import { useAuth } from "../../context/AuthContext";

const QRScan: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { token, effectivePermissions, permissionsLoaded } = useAuth();
    const [backendError, setBackendError] = useState<string | null>(null);
    const [status, setStatus] = useState<string>("Scanning...");
    const [loading, setLoading] = useState<boolean>(true);
    const [isMounted, setIsMounted] = useState<boolean>(false);
    const [isShaking, setIsShaking] = useState<boolean>(false);
    const [isSuccess, setIsSuccess] = useState<boolean>(false);
    const qrRef = useRef<HTMLDivElement>(null);
    const qrCode = useRef<Html5Qrcode | null>(null);
    const visit = (location.state as { visit?: Visit })?.visit;

    // Permission Check
    const canScanVisits = useMemo(
        () => effectivePermissions?.some((p) => p.name === "scan_visits"),
        [effectivePermissions]
    );

    useEffect(() => {
        setIsMounted(true);

        if (!visit || !visit.visitID) {
            console.error("No visit data provided. Please go back and select a visit.");
            setLoading(false);
            setStatus("");
            return;
        }

        if (!token) {
            console.error("No authentication token provided.");
            setBackendError("Authentication required.");
            setLoading(false);
            setStatus("");
            return;
        }

        if (!permissionsLoaded) {
            console.log("Permissions not yet loaded, waiting...");
            return;
        }

        if (!canScanVisits) {
            console.error("User lacks 'scan_visits' permission.");
            setBackendError("Access Denied: You lack permission to scan visits.");
            setLoading(false);
            setStatus("");
            return;
        }

        if (!isMounted || !qrRef.current) {
            console.error("Failed to initialize QR scanner. Element not found.");
            setLoading(false);
            setStatus("");
            return;
        }

        const html5QrCode = new Html5Qrcode("qr-reader");
        qrCode.current = html5QrCode;

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        const qrCodeSuccessCallback = async (decodedText: string) => {
            setStatus("QR Code Detected");
            await new Promise((resolve) => setTimeout(resolve, 1500));
            setStatus("Checking...");
            await new Promise((resolve) => setTimeout(resolve, 1500));

            try {
                const response = await verifyQrCode(
                    { qrData: decodedText, visitId: visit.visitID },
                    token
                );
                if (response.valid) {
                    setStatus("Validating...");
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    setIsSuccess(true);
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    navigate(`/visit/${visit.visitID}/validate-checklist`);
                } else {
                    setBackendError("Mismatch error");
                    setIsShaking(true);
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    setIsShaking(false);
                    setStatus("Scanning...");
                }
            } catch (err) {
                setBackendError("Mismatch error");
                setIsShaking(true);
                await new Promise((resolve) => setTimeout(resolve, 100));
                setIsShaking(false);
                setStatus("Scanning...");
                console.error("QR verification error:", err);
            }
        };

        const qrCodeErrorCallback = (error: string) => {
            console.warn(`QR scan error: ${error}`);
            if (error.includes("NotAllowedError")) {
                console.error("Camera access denied. Please allow camera access and try again.");
            } else if (error.includes("NotFoundError")) {
                console.error("No camera found on this device.");
            }
        };

        html5QrCode
            .start({ facingMode: "environment" }, config, qrCodeSuccessCallback, qrCodeErrorCallback)
            .then(() => {
                setLoading(false);
            })
            .catch((err) => {
                console.error("Failed to start camera:", err.message);
                setLoading(false);
                setStatus("");
            });

        return () => {
            if (qrCode.current) {
                qrCode.current
                    .stop()
                    .then(() => qrCode.current?.clear())
                    .catch((err) => console.error("Cleanup error:", err));
            }
            setIsMounted(false);
        };
    }, [visit, navigate, token, permissionsLoaded, canScanVisits , isMounted]);

    const handleBack = () => {
        navigate(-1);
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

    if (!permissionsLoaded) {
        return <div className="qr-scan-container">Loading permissions...</div>;
    }

    if (!token || !canScanVisits) {
        return (
            <div className="qr-scan-container">
                <div className="qr-scan-error-card">
                    <h2>Oops!</h2>
                    <p>{!token ? "Authentication required." : "Access Denied: You lack permission to scan visits."}</p>
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