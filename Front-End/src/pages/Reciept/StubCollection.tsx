import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaTruck, FaCheck, FaQrcode } from "react-icons/fa";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../../context/AuthContext";
import { getReceiptBookById } from "../../apis/receiptBookAPI";
import { collectStub, validateStubCollection } from "../../apis/receiptStubAPI";
import ReceiptBook from "../../models/ReceiptBook";
import "./StubCollection.css";

const StubCollection: React.FC = () => {
    const { bookID } = useParams<{ bookID: string }>();
    const { token, userRoles, effectivePermissions } = useAuth();
    const navigate = useNavigate();
    const [book, setBook] = useState<ReceiptBook | null>(null);
    const [scannedQR, setScannedQR] = useState<string>("");
    const [otp, setOtp] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [stubInitiated, setStubInitiated] = useState<boolean>(false);

    const isSupervisor = userRoles?.some((role) => role.name === "Supervisor");

    useEffect(() => {
        const fetchBook = async () => {
            if (!bookID || !token || !isSupervisor || !effectivePermissions?.some((p) => p.name === "collect_receipt_stubs")) {
                setError("Access Denied or Invalid Book ID");
                setLoading(false);
                return;
            }
            try {
                const bookData = await getReceiptBookById(bookID, token);
                if (bookData.status !== "Assigned to Agent") {
                    setError("Stub collection is only available for books assigned to an agent.");
                }
                setBook(bookData);
            } catch (err) {
                setError("Failed to load receipt book.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchBook();
    }, [bookID, token, isSupervisor, effectivePermissions]);

    const handleScan = (e: React.ChangeEvent<HTMLInputElement>) => {
        const qrValue = e.target.value;
        setScannedQR(qrValue);
        if (qrValue === book?.qrCode) {
            setError(null);
        } else {
            setError("Scanned QR code does not match this receipt book.");
        }
    };

    const handleInitiateStubCollection = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bookID || !token || scannedQR !== book?.qrCode) {
            setError("Please scan the correct QR code.");
            return;
        }
        try {
            await collectStub(bookID, token);
            setStubInitiated(true);
            setError(null);
        } catch (err) {
            setError("Failed to initiate stub collection.");
            console.error(err);
        }
    };

    const handleValidateStubCollection = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bookID || !otp || !token) {
            setError("Please enter the OTP.");
            return;
        }
        try {
            await validateStubCollection(bookID, otp, token);
            navigate(`/receipt-book/${bookID}`);
        } catch (err) {
            setError("Invalid OTP or stub collection validation failed.");
            console.error(err);
        }
    };

    if (loading) return <div className="loading">Loading...</div>;
    if (error || !book) return <div className="error">{error || "Receipt book not found."}</div>;

    return (
        <div className="stub-collection-container">
            <header className="stub-header">
                <h1>Collect Stub for Receipt Book: {book.number}</h1>
            </header>
            <div className="stub-card">
                {!stubInitiated ? (
                    <form onSubmit={handleInitiateStubCollection}>
                        <div className="form-group">
                            <label htmlFor="qrScan">Scan QR Code</label>
                            <div className="qr-scan">
                                <FaQrcode />
                                <input
                                    id="qrScan"
                                    type="text"
                                    value={scannedQR}
                                    onChange={handleScan}
                                    placeholder="Enter QR code value"
                                    required
                                />
                            </div>
                            <div className="qr-preview">
                                <QRCodeSVG value={book.qrCode} size={100} />
                            </div>
                        </div>
                        <p>Current Status: {book.status}</p>
                        <p>Agent ID: {book.agentID || "N/A"}</p>
                        {error && <div className="error">{error}</div>}
                        <div className="form-actions">
                            <button type="button" className="back-btn" onClick={() => navigate(`/receipt-book/${bookID}`)}>
                                <FaArrowLeft /> Back
                            </button>
                            <button type="submit" className="collect-btn">
                                <FaTruck /> Initiate Stub Collection
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleValidateStubCollection}>
                        <div className="form-group">
                            <label htmlFor="otp">Enter OTP</label>
                            <input
                                id="otp"
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="Enter OTP sent to agent"
                                required
                            />
                        </div>
                        {error && <div className="error">{error}</div>}
                        <div className="form-actions">
                            <button type="button" className="back-btn" onClick={() => setStubInitiated(false)}>
                                <FaArrowLeft /> Back
                            </button>
                            <button type="submit" className="validate-btn">
                                <FaCheck /> Validate Collection
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default StubCollection;