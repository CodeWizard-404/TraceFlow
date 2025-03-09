// src/pages/visit/QRScan.tsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { BrowserQRCodeReader } from "@zxing/library";
import { FaArrowLeft, FaQrcode, FaSync } from "react-icons/fa";

import "./QRScan.css";
import { verifyQrCode } from "../../apis/visitAPI";
import Visit from "../../models/Visit";

const QRScan: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const videoRef = useRef<HTMLVideoElement>(null);
    const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);
    const [visit, setVisit] = useState<Visit | null>(null);
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    // Load visit from location state
    useEffect(() => {
        const state = location.state as { visit: Visit } | undefined;
        if (state?.visit) {
            setVisit(state.visit);
        } else {
            setError("No visit selected. Please select a visit from the timesheet.");
        }
    }, [location.state]);

    // Setup QR scanner
    useEffect(() => {
        codeReaderRef.current = new BrowserQRCodeReader();
        let isMounted = true;

        const startScanning = async () => {
            if (videoRef.current && !scanResult && !loading && isMounted) {
                try {
                    await codeReaderRef.current!.decodeFromVideoDevice(
                        null,
                        videoRef.current,
                        async (result, err) => {
                            if (result && isMounted && !scanResult && !loading) {
                                await handleScan(result.getText());
                            }
                            if (err && !err.name.includes('NotFoundException')) {
                                setError("Error scanning QR code. Please try again.");
                                console.error(err);
                            }
                        }
                    );
                } catch (err) {
                    setError("Camera access denied. Please grant permissions.");
                    console.error(err);
                }
            }
        };

        startScanning();

        return () => {
            isMounted = false;
            if (codeReaderRef.current) {
                codeReaderRef.current.reset();
                codeReaderRef.current = null;
            }
        };
    }, [visit]); // Only re-run if visit changes

    const handleScan = async (data: string) => {
        if (!data || !visit || scanResult || loading) return; // Prevent re-entry

        console.log("Scan initiated:", data);
        setScanResult(data);
        setLoading(true);
        setError(null);

        try {
            console.log("Calling verifyQrCode with:", { qrData: data, visitId: visit.visitID });
            const response = await verifyQrCode({
                qrData: data,
                visitId: visit.visitID,
            });
            console.log("API Response:", response);

            if (response.valid) {
                console.log("QR valid, navigating...");
                navigate(`/timesheets`, { state: { visit } });
            } else {
                console.log("QR invalid");
                setError("Invalid QR code. Phone number mismatch.");
                setScanResult(null);
            }
        } catch (err) {
            console.error("Verification error:", err);
            setError("QR verification failed. Please try again.");
            setScanResult(null);
        } finally {
            console.log("Scan complete");
            setLoading(false);
        }
    };

    const resetScan = () => {
        setScanResult(null);
        setError(null);
        setLoading(false);
    };

    if (!visit) {
        return (
            <div className="qr-scan-container">
                <div className="qr-scan-error-card">
                    <h2>Oops!</h2>
                    <p>{error}</p>
                    <button className="qr-scan-back-btn" onClick={() => navigate("/timesheet")}>
                        <FaArrowLeft /> Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="qr-scan-container">
            <div className="qr-scan-hero">
                <h1>
                    <FaQrcode /> Scan QR
                </h1>
            </div>

            <div className="qr-scan-card qr-scanner">
                <div className="card-content">
                    {!loading && !scanResult ? (
                        <div className="video-wrapper">
                            <video ref={videoRef} className="qr-video" />
                            <div className="scan-overlay"></div>
                        </div>
                    ) : (
                        <div className="scan-result">
                            {loading ? (
                                <div className="loading">
                                    <div className="spinner"></div>
                                    <p>Validating...</p>
                                </div>
                            ) : (
                                <>
                                    <p><strong>Result:</strong> {scanResult}</p>
                                    {error && <p className="error">{error}</p>}
                                    <button className="qr-scan-retry-btn" onClick={resetScan}>
                                        <FaSync /> Retry
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="qr-scan-actions">
                <button
                    className="qr-scan-back-btn"
                    onClick={() => navigate(`/visit/${visit.visitID}`)}
                >
                    <FaArrowLeft /> Back
                </button>
            </div>
        </div>
    );
};

export default QRScan;