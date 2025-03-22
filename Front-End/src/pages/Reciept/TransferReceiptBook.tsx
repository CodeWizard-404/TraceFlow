import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaExchangeAlt, FaCheck, FaQrcode } from "react-icons/fa";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../../context/AuthContext";
import { getReceiptBookById, transfer, validateTransfer } from "../../apis/receiptBookAPI";
import { getAllUsers } from "../../apis/userAPI";
import ReceiptBook from "../../models/ReceiptBook";
import User from "../../models/User";
import "./TransferReceiptBook.css";

const TransferReceiptBook: React.FC = () => {
    const { bookID } = useParams<{ bookID: string }>();
    const { token, userRoles, effectivePermissions } = useAuth();
    const navigate = useNavigate();
    const [book, setBook] = useState<ReceiptBook | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [recipientType, setRecipientType] = useState<string>("");
    const [recipientID, setRecipientID] = useState<string>("");
    const [scannedQR, setScannedQR] = useState<string>("");
    const [otp, setOtp] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [transferInitiated, setTransferInitiated] = useState<boolean>(false);

    const userRole = userRoles?.[0]?.name || "";

    useEffect(() => {
        const fetchData = async () => {
            if (!bookID || !token || !effectivePermissions?.some((p) => p.name === "transfer_receipt_books")) {
                setError("Access Denied or Invalid Book ID");
                setLoading(false);
                return;
            }
            try {
                const [bookData, usersData] = await Promise.all([
                    getReceiptBookById(bookID, token),
                    getAllUsers(token),
                ]);
                setBook(bookData);
                setUsers(usersData);
            } catch (err) {
                setError("Failed to load data.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [bookID, token, effectivePermissions]);

    const getRecipientOptions = () => {
        if (!book) return [];
        switch (userRole) {
            case "Purchase Team":
                return book.status === "In Stock" ? ["Supplier", "Regional Manager"] : [];
            case "Regional Manager":
                return book.status === "With Regional Manager"
                    ? ["Regional Manager", "Supervisor"]
                    : book.status === "Stub Collected"
                        ? ["Regional Manager", "Stock Manager"]
                        : [];
            case "Supervisor":
                return book.status === "With Supervisor"
                    ? ["Supervisor", "Regional Manager", "Agent"]
                    : book.status === "Stub Collected"
                        ? ["Supervisor", "Regional Manager", "Stock Manager"]
                        : [];
            default:
                return [];
        }
    };

    const filteredUsers = users.filter((user) =>
        user.roles?.some((role) => recipientType === role.name)
    );

    const handleScan = (e: React.ChangeEvent<HTMLInputElement>) => {
        const qrValue = e.target.value;
        setScannedQR(qrValue);
        if (qrValue === book?.qrCode) {
            setError(null);
        } else {
            setError("Scanned QR code does not match this receipt book.");
        }
    };

    const handleInitiateTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bookID || !recipientType || !recipientID || !token || scannedQR !== book?.qrCode) {
            setError("Please scan the correct QR code and select a recipient.");
            return;
        }
        try {
            const recipientTypeForAPI = recipientType === "Agent" ? "agent" : "user";
            await transfer([bookID], recipientID, recipientTypeForAPI, token);
            setTransferInitiated(true);
            setError(null);
        } catch (err) {
            setError("Failed to initiate transfer.");
            console.error(err);
        }
    };

    const handleValidateTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bookID || !otp || !recipientID || !token) {
            setError("Please enter the OTP.");
            return;
        }
        try {
            const recipientTypeForAPI = recipientType === "Agent" ? "agent" : "user";
            await validateTransfer([bookID], recipientID, otp, recipientTypeForAPI, token);
            navigate(`/receipt-book/${bookID}`);
        } catch (err) {
            setError("Invalid OTP or transfer validation failed.");
            console.error(err);
        }
    };

    if (loading) return <div className="loading">Loading...</div>;
    if (error || !book) return <div className="error">{error || "Receipt book not found."}</div>;

    return (
        <div className="transfer-receipt-book-container">
            <header className="transfer-header">
                <h1>Transfer Receipt Book: {book.number}</h1>
            </header>
            <div className="transfer-card">
                {!transferInitiated ? (
                    <form onSubmit={handleInitiateTransfer}>
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
                        <div className="form-group">
                            <label htmlFor="recipientType">Recipient Type</label>
                            <select
                                id="recipientType"
                                value={recipientType}
                                onChange={(e) => {
                                    setRecipientType(e.target.value);
                                    setRecipientID("");
                                }}
                                required
                            >
                                <option value="">Select Recipient Type</option>
                                {getRecipientOptions().map((type) => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                        {recipientType && (
                            <div className="form-group">
                                <label htmlFor="recipientID">Recipient</label>
                                <select
                                    id="recipientID"
                                    value={recipientID}
                                    onChange={(e) => setRecipientID(e.target.value)}
                                    required
                                >
                                    <option value="">Select Recipient</option>
                                    {filteredUsers.map((user) => (
                                        <option key={user.userID} value={user.userID}>
                                            {user.firstname} {user.lastname} ({user.email})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {error && <div className="error">{error}</div>}
                        <div className="form-actions">
                            <button type="button" className="back-btn" onClick={() => navigate(`/receipt-book/${bookID}`)}>
                                <FaArrowLeft /> Back
                            </button>
                            <button type="submit" className="transfer-btn">
                                <FaExchangeAlt /> Initiate Transfer
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleValidateTransfer}>
                        <div className="form-group">
                            <label htmlFor="otp">Enter OTP</label>
                            <input
                                id="otp"
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="Enter OTP sent to recipient"
                                required
                            />
                        </div>
                        {error && <div className="error">{error}</div>}
                        <div className="form-actions">
                            <button type="button" className="back-btn" onClick={() => setTransferInitiated(false)}>
                                <FaArrowLeft /> Back
                            </button>
                            <button type="submit" className="validate-btn">
                                <FaCheck /> Validate Transfer
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default TransferReceiptBook;