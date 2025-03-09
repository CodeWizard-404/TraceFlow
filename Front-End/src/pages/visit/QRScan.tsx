// src/pages/visit/QRScan.tsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Html5QrcodeScanner } from "html5-qrcode";
import Visit from "../../models/Visit";
import "./QRScan.css";
import { verifyQrCode } from "../../apis/visitAPI";

const QRScan: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [scanner, setScanner] = useState<Html5QrcodeScanner | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState<boolean>(false);

    // Get visit from location state
    const visit = (location.state as { visit?: Visit })?.visit;

    useEffect(() => {
        if (!visit || !visit.visitID) {
            setError("No visit data provided. Please go back and select a visit.");
            return;
        }

        // Initialize QR scanner
        const qrScanner = new Html5QrcodeScanner(
            "qr-reader",
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false // verbose
        );

        const onScanSuccess = async (decodedText: string) => {
            setIsScanning(false);
            qrScanner.clear(); // Stop scanning

            try {
                const response = await verifyQrCode({
                    qrData: decodedText,
                    visitId: visit.visitID,
                });

                if (response.valid) {
                    navigate("/timesheet"); // Redirect on success
                } else {
                    setError(response.message || "QR code validation failed.");
                }
            } catch (err) {
                setError("Failed to verify QR code. Please try again.");
                console.error(err);
            }
        };

        const onScanFailure = (error: string) => {
            // Ignore continuous scan failures, only handle success
            console.warn(`QR scan error: ${error}`);
        };

        qrScanner.render(onScanSuccess, onScanFailure);
        setScanner(qrScanner);
        setIsScanning(true);

        // Cleanup on unmount
        return () => {
            qrScanner.clear().catch((err) => console.error("Failed to clear scanner", err));
        };
    }, [visit, navigate]);

    const handleBack = () => {
        navigate(-1); // Go back to previous page (VisitDetails)
    };

    if (!visit || !visit.visitID) {
        return (
            <div className="qr-scan-container">
                <div className="qr-scan-error-card">
                    <h2>Oops!</h2>
                    <p>{error || "No visit selected."}</p>
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
            <section className="qr-scan-card">
                <div id="qr-reader" className="qr-reader"></div>
                {isScanning && <p className="qr-status">Scanning...</p>}
                {error && (
                    <div className="qr-error">
                        <p>{error}</p>
                        <button className="qr-retry-btn" onClick={() => window.location.reload()}>
                            Retry
                        </button>
                    </div>
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