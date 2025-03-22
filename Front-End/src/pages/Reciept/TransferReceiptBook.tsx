import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaExchangeAlt, FaCheck } from "react-icons/fa";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "../../context/AuthContext";
import {
    getAllReceiptBooks,
    transfer,
    validateTransfer,
} from "../../apis/receiptBookAPI";
import { getAllUsers } from "../../apis/userAPI";
import { getAgentById } from "../../apis/agentAPI";
import "./TransferReceiptBook.css";
import ReceiptBook from "../../models/ReceiptBook";
import User from "../../models/User";
import Agent from "../../models/Agent";

const TransferReceiptBook: React.FC = () => {
    const { token, userRoles, effectivePermissions } = useAuth();
    const navigate = useNavigate();
    const [receiptBooks, setReceiptBooks] = useState<ReceiptBook[]>([]);
    const [selectedBookIDs, setSelectedBookIDs] = useState<string[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [recipientType, setRecipientType] = useState<User | Agent>();
    const [recipientID, setRecipientID] = useState<string>("");
    const [scannedQR, setScannedQR] = useState<string[]>([]);
    const [otp, setOtp] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [transferInitiated, setTransferInitiated] = useState<boolean>(false);
    const qrScannerRef = useRef<Html5Qrcode | null>(null);
    const qrReaderRef = useRef<HTMLDivElement>(null);
    const [isScannerInitialized, setIsScannerInitialized] = useState<boolean>(false);
    const scannedQRRef = useRef<Set<string>>(new Set()); 
    const userRole = userRoles?.[0]?.name || "";

    useEffect(() => {
        const fetchData = async () => {
            if (
                !token ||
                !effectivePermissions?.some((p) => p.name === "transfer_receipt_books")
            ) {
                setError("Access Denied");
                setLoading(false);
                return;
            }
            try {
                const [booksData, usersData] = await Promise.all([
                    getAllReceiptBooks(token),
                    getAllUsers(token),
                ]);
                setReceiptBooks(booksData);
                setUsers(usersData);
                // Fetch agents if Supervisor role
                if (userRole === "Supervisor") {
                    const agentPromises = booksData
                        .filter((b) => b.agentID)
                        .map((b) => getAgentById(b.agentID!, token));
                    const agentsData = await Promise.all(agentPromises);
                    setAgents(agentsData);
                }
            } catch (err) {
                setError("Failed to load data.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [token, effectivePermissions, userRole]);

    // Updated scanning logic with qrCodeErrorCallback
    useEffect(() => {
        if (!qrReaderRef.current || qrScannerRef.current || isScannerInitialized) return;

        const html5QrCode = new Html5Qrcode("qr-reader");
        qrScannerRef.current = html5QrCode;

        let isProcessing = false; // Simple flag to prevent overlapping scans
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        const handleScanSuccess = async (decodedText: string) => {
            if (isProcessing) return; // Prevent concurrent processing
            isProcessing = true;

            try {
                // Parse TLV data: 01<length><number>02<length><type>
                const parseTLV = (text: string) => {
                    const numberLength = parseInt(text.slice(2, 4), 10);
                    const number = text.slice(4, 4 + numberLength);
                    const typeStart = 4 + numberLength + 2; // Skip '02' and length
                    const typeLength = parseInt(text.slice(typeStart, typeStart + 2), 10);
                    const type = text.slice(typeStart + 2, typeStart + 2 + typeLength);
                    return { number, type };
                };

                const { number, type } = parseTLV(decodedText);
                const matchingBook = receiptBooks.find(
                    (r) => r.number === number && r.type === type
                );

                if (!matchingBook) {
                    setError(`QR code "${number}" not found in receipt books.`);
                    return;
                }

                if (scannedQRRef.current.has(decodedText)) {
                    setError(`QR code "${number}" has already been scanned.`);
                    return;
                }

                // Update state atomically
                setScannedQR((prev) => {
                    const newScanned = [...prev, decodedText];
                    scannedQRRef.current.add(decodedText); // Sync ref
                    return newScanned;
                });
                setSelectedBookIDs((prev) => [...prev, matchingBook.bookID]);
                setError(null); // Clear error on success
            } catch (err) {
                setError("Invalid QR code format. Please try again.");
                console.error("QR Parse Error:", err);
            } finally {
                // Debounce reset
                setTimeout(() => {
                    isProcessing = false;
                }, 1000); // 1-second debounce
            }
        };

        const handleScanError = (errorMessage: string) => {
            console.warn("QR Scan Error:", errorMessage);
        };

        html5QrCode
            .start(
                { facingMode: "environment" },
                config,
                handleScanSuccess,
                handleScanError // Added the missing qrCodeErrorCallback
            )
            .then(() => {
                setIsScannerInitialized(true);
            })
            .catch((err) => {
                setError("Camera access denied or unavailable. Please check permissions.");
                console.error("Scanner Start Error:", err);
            });

        // Cleanup
        return () => {
            if (qrScannerRef.current && isScannerInitialized) {
                qrScannerRef.current
                    .stop()
                    .then(() => {
                        qrScannerRef.current!.clear();
                        qrScannerRef.current = null;
                        setIsScannerInitialized(false);
                    })
                    .catch((err) => console.error("Scanner Stop Error:", err));
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
            scannedQRRef.current.clear();
        };
    }, [receiptBooks, isScannerInitialized]);

    const getRecipientOptions = () => {
        console.log("User Role:", userRole);
        switch (userRole) {
            case "Purchase Team":
                return ["Supplier", "Regional Manager"];
            case "Regional Manager":
                return ["Regional Manager", "Supervisor", "Stock Manager"];
            case "Supervisor":
                return ["Supervisor", "Regional Manager", "Agent", "Stock Manager"];
            case "Stock Manager":
                return ["Stock Manager", "Archive"];
            case "Super Admin":
                return ["Supplier", "Regional Manager", "Supervisor", "Agent", "Stock Manager"];
            default:
                return [];
        }
    };

    const filteredRecipients =
        recipientType && (recipientType as Agent).name === "Agent"
            ? agents
            : recipientType &&
                ((recipientType as User).roles?.[0]?.name === "Supplier" ||
                    (recipientType as User).roles?.[0]?.name === "Archive")
                ? []
                : users.filter((u) =>
                    u.roles?.some((r) => r.name === (recipientType as User).firstname)
                );

    const handleInitiateTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (
            selectedBookIDs.length === 0 ||
            !recipientType ||
            ((recipientType as User).roles?.[0]?.name !== "Supplier" &&
                (recipientType as User).roles?.[0]?.name !== "Archive" &&
                !recipientID)
        ) {
            setError("Please scan at least one QR code and select a recipient.");
            return;
        }
        if (!scannedQR.every((qr) => receiptBooks.some((r) => r.qrCode === qr))) {
            setError("One or more scanned QR codes do not match any receipt book.");
            return;
        }
        try {
            const recipientTypeForAPI =
                (recipientType as Agent)?.name === "Agent" ? "agent" : "user";
            const result = await transfer(
                selectedBookIDs,
                recipientID ||
                (recipientType as User)?.userID ||
                (recipientType as Agent)?.agentID,
                recipientTypeForAPI,
                token!
            );
            setTransferInitiated(true);
            setOtp(result.message ? "" : result.message); // If no OTP (e.g., Supplier), use message
            setError(null);
        } catch (err) {
            setError("Failed to initiate transfer.");
            console.error(err);
        }
    };

    const handleValidateTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (
            !otp ||
            selectedBookIDs.length === 0 ||
            ((recipientType as User)?.roles?.[0]?.name !== "Supplier" &&
                (recipientType as User)?.roles?.[0]?.name !== "Archive" &&
                !recipientID)
        ) {
            setError("Please enter the OTP.");
            return;
        }
        try {
            const recipientTypeForAPI =
                (recipientType as Agent)?.name === "Agent" ? "agent" : "user";
            const recipientIDForAPI =
                recipientID ||
                (recipientType as User)?.userID ||
                (recipientType as Agent)?.agentID;
            await validateTransfer(
                selectedBookIDs,
                recipientIDForAPI!,
                otp,
                recipientTypeForAPI,
                token!
            );
            navigate("/receipt-books");
        } catch (err) {
            setError("Invalid OTP or transfer validation failed.");
            console.error(err);
        }
    };

    if (loading) return <div className="loading">Loading...</div>;
    if (error && !isScannerInitialized) return <div className="error">{error}</div>;

    return (
        <div className="transfer-receipt-book-container">
            <header className="transfer-header">
                <h1>Transfer Receipt Books</h1>
            </header>
            <div className="transfer-card">
                {!transferInitiated ? (
                    <form onSubmit={handleInitiateTransfer}>
                        <div className="form-group">
                            <label>Scan QR Codes</label>
                            {error && <div className="error-above-camera">{error}</div>}
                            <div id="qr-reader" ref={qrReaderRef} className="qr-reader"></div>
                            <div className="scanned-list">
                                <h4>Scanned Books ({selectedBookIDs.length})</h4>
                                <ul>
                                    {selectedBookIDs.map((bookID) => (
                                        <li key={bookID}>
                                            {receiptBooks.find((r) => r.bookID === bookID)?.number}
                                            <button
                                                onClick={() => {
                                                    setSelectedBookIDs((prev) =>
                                                        prev.filter((id) => id !== bookID)
                                                    );
                                                    setScannedQR((prev) => {
                                                        const qrToRemove = receiptBooks.find(
                                                            (r) => r.bookID === bookID
                                                        )?.qrCode;
                                                        scannedQRRef.current.delete(qrToRemove || "");
                                                        return prev.filter((qr) => qr !== qrToRemove);
                                                    });
                                                }}
                                            >
                                                Remove
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Recipient Type</label>
                            <select
                                value={
                                    recipientType
                                        ? (recipientType as User).firstname ||
                                        (recipientType as Agent).name
                                        : ""
                                }
                                onChange={(e) => {
                                    const selectedType =
                                        users.find((user) => user.firstname === e.target.value) ||
                                        agents.find((agent) => agent.name === e.target.value);
                                    setRecipientType(selectedType);
                                    setRecipientID("");
                                }}
                                required
                            >
                                <option value="">Select Recipient Type</option>
                                {getRecipientOptions().map((type) => (
                                    <option key={type} value={type}>
                                        {type}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {recipientType &&
                            (recipientType as User).roles?.[0]?.name !== "Supplier" &&
                            (recipientType as User).roles?.[0]?.name !== "Archive" && (
                                <div className="form-group">
                                    <label>Recipient</label>
                                    <select
                                        value={recipientID}
                                        onChange={(e) => setRecipientID(e.target.value)}
                                        required
                                    >
                                        <option value="">Select Recipient</option>
                                        {filteredRecipients.map((r) => (
                                            <option
                                                key={"userID" in r ? r.userID : r.agentID}
                                                value={"userID" in r ? r.userID : r.agentID}
                                            >
                                                {"firstname" in r ? r.firstname : r.name}{" "}
                                                {"lastname" in r ? r.lastname : ""} (
                                                {"email" in r ? r.email : r.phone})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        <div className="form-actions">
                            <button
                                type="button"
                                className="back-btn"
                                onClick={() => navigate("/receipt-books")}
                            >
                                <FaArrowLeft /> Back
                            </button>
                            <button type="submit" className="transfer-btn">
                                <FaExchangeAlt /> Initiate Transfer
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleValidateTransfer}>
                        {(recipientType as User)?.roles?.[0]?.name !== "Supplier" &&
                            (recipientType as User)?.roles?.[0]?.name !== "Archive" && (
                                <div className="form-group">
                                    <label>Enter OTP</label>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        placeholder="Enter OTP sent to recipient"
                                        required
                                    />
                                </div>
                            )}
                        {error && <div className="error">{error}</div>}
                        <div className="form-actions">
                            <button
                                type="button"
                                className="back-btn"
                                onClick={() => setTransferInitiated(false)}
                            >
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