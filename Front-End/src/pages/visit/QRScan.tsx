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
    const [visit, setVisit] = useState<Visit | null>(null);
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        const state = location.state as { visit: Visit } | undefined;
        if (state?.visit) {
            setVisit(state.visit);
        } else {
            setError("No visit selected. Please select a visit from the timesheet.");
        }
    }, [location.state]);

    useEffect(() => {
        const codeReader = new BrowserQRCodeReader();
        if (videoRef.current && !scanResult && !loading) {
            codeReader
                .decodeFromVideoDevice(null, videoRef.current, (result, err) => {
                    if (result) {
                        handleScan(result.getText());
                    }
                    if (err) {
                        setError("Error scanning QR code. Please try again.");
                        console.error(err);
                    }
                })
                .catch((err) => {
                    setError("Camera access denied. Please grant permissions.");
                    console.error(err);
                });

            return () => {
                codeReader.reset();
            };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visit, scanResult, loading]);

    const handleScan = async (data: string) => {
        if (data && visit && !scanResult) {
            setScanResult(data);
            setLoading(true);
            setError(null);

            try {
                const response = await verifyQrCode({
                    qrData: data,
                    visitId: visit.visitID,
                });

                if (response.valid) {
                    navigate(`/timesheets`, { state: { visit } });
                } else {
                    setError("Invalid QR code. Phone number mismatch.");
                    setScanResult(null);
                }
            } catch (err) {
                setError("QR verification failed. Please try again.");
                setScanResult(null);
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
    };

    const resetScan = () => {
        setScanResult(null);
        setError(null);
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
                    {!scanResult && !loading ? (
                        <div className="video-wrapper">
                            <video ref={videoRef} className="qr-video" />
                            <div className="scan-overlay"></div>
                        </div>
                    ) : (
                        <div className="scan-result">
                            {loading ? (
                                <div className="loading">
                                    <div className="spinner"></div>
                                    Validating...
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