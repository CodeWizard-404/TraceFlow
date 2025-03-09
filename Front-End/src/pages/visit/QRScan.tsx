// src/pages/visit/QRScan.tsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { BrowserQRCodeReader } from "@zxing/library";

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
                    setError("Error accessing camera. Please ensure permissions are granted.");
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
                    navigate(`/visit/${visit.visitID}/checklist`, { state: { visit } });
                } else {
                    setError("QR code validation failed. Phone number does not match.");
                    setScanResult(null);
                }
            } catch (err) {
                setError("Failed to verify QR code. Please try again.");
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
                <header className="qr-header">
                    <h1>Scan QR Code</h1>
                </header>
                <section className="qr-card">
                    <div className="error">{error}</div>
                    <button className="back-btn" onClick={() => navigate("/timesheet")}>
                        Back to Timesheets
                    </button>
                </section>
            </div>
        );
    }

    return (
        <div className="qr-scan-container">
            <header className="qr-header">
                <h1>Scan QR Code for Visit</h1>
            </header>
            <section className="qr-card">
                <div className="visit-info">
                    <p>
                        <strong>Agent:</strong> {visit.agentID}
                    </p>
                    <p>
                        <strong>Date:</strong>{" "}
                        {new Date(visit.date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "2-digit",
                        })}
                    </p>
                    <p>
                        <strong>Time:</strong> {visit.time.split(":").slice(0, 2).join(":")}
                    </p>
                </div>
                {!scanResult && !loading ? (
                    <video ref={videoRef} style={{ width: "100%", maxWidth: "400px" }} />
                ) : (
                    <div className="scan-result">
                        {loading ? (
                            <p className="loading">Validating QR code...</p>
                        ) : (
                            <>
                                <p>
                                    <strong>Scanned Data:</strong> {scanResult}
                                </p>
                                {error && <p className="error">{error}</p>}
                                <button className="retry-btn" onClick={resetScan}>
                                    Retry Scan
                                </button>
                            </>
                        )}
                    </div>
                )}
                <button className="back-btn" onClick={() => navigate("/timesheet")}>
                    Back to Timesheets
                </button>
            </section>
        </div>
    );
};

export default QRScan;