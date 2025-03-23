import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaExchangeAlt, FaCheck } from "react-icons/fa";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "../../context/AuthContext";
import {
    getAllReceiptBooks,
    transfer,
    validateTransfer,
    sendToSupplier,
} from "../../apis/receiptBookAPI";
import { collectStub, validateStubCollection, archiveStub } from "../../apis/receiptStubAPI";
import { getAllUsers, getUserByPhone } from "../../apis/userAPI";
import { getAgentsByLocation, getAgentLocations, getAgentByPhone, getAgentById } from "../../apis/agentAPI";
import "./TransferReceiptBook.css";
import ReceiptBook from "../../models/ReceiptBook";
import User from "../../models/User";
import Agent from "../../models/Agent";

const TransferReceiptBook: React.FC = () => {
    const { token, userRoles, effectivePermissions } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { agentID: preSelectedAgentID, forceAgent, transferType } = (location.state as { agentID?: string; forceAgent?: boolean; transferType?: string }) || {};

    const [receiptBooks, setReceiptBooks] = useState<ReceiptBook[]>([]);
    const [selectedBookIDs, setSelectedBookIDs] = useState<string[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [locations, setLocations] = useState<string[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [recipientType, setRecipientType] = useState<string>("");
    const [recipientID, setRecipientID] = useState<string>("");
    const [supplierEmail, setSupplierEmail] = useState<string>("");
    const [agentPhone, setAgentPhone] = useState<string>("");
    const [selectedLocation, setSelectedLocation] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [scannedQR, setScannedQR] = useState<string[]>([]);
    const [otp, setOtp] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [transferInitiated, setTransferInitiated] = useState<boolean>(false);
    const [isScannerRunning, setIsScannerRunning] = useState<boolean>(false);
    const [isScannerStarting, setIsScannerStarting] = useState<boolean>(false);
    const qrScannerRef = useRef<Html5Qrcode | null>(null);
    const qrReaderRef = useRef<HTMLDivElement>(null);
    const scannedQRRef = useRef<Set<string>>(new Set());
    const stopLockRef = useRef<boolean>(false);
    const userRole = userRoles?.[0]?.name || "";
    const currentUserID = token ? JSON.parse(atob(token.split('.')[1])).sub : "";

    const isTransferable = useCallback((book: ReceiptBook) => {
        switch (userRole) {
            case "Purchase Team":
                return book.status === "In Stock" && book.currentHolderID === currentUserID;
            case "Regional Manager":
                return ["With Regional Manager", "Stub Collected"].includes(book.status) && book.currentHolderID === currentUserID;
            case "Supervisor":
                return ["With Supervisor", "Stub Collected", "Assigned to Agent"].includes(book.status) && (book.currentHolderID === currentUserID || book.agentID);
            case "Stock Manager":
                return book.status === "With Stock Manager" && book.currentHolderID === currentUserID;
            case "Super Admin":
                return true;
            default:
                return false;
        }
    }, [userRole, currentUserID]);

    const handleScanSuccess = useCallback(async (decodedText: string) => {
        console.log("Scan detected:", decodedText, { isScannerRunning, selectedBookIDs, scannedQR });

        try {
            const parseTLV = (text: string) => {
                const numberLength = parseInt(text.slice(2, 4), 10);
                const number = text.slice(4, 4 + numberLength);
                const typeStart = 4 + numberLength + 2;
                const typeLength = parseInt(text.slice(typeStart, typeStart + 2), 10);
                const type = text.slice(typeStart + 2, typeStart + 2 + typeLength);
                return { number, type };
            };

            const { number, type } = parseTLV(decodedText);
            console.log("Parsed QR:", { number, type });

            const matchingBook = receiptBooks.find(
                (r) => r.number === number && r.type === type
            );
            if (!matchingBook) {
                setError(`QR code "${number}" not found in receipt books.`);
                console.log("No matching book found.");
                return;
            }

            if (scannedQRRef.current.has(decodedText)) {
                setError(`QR code "${number}" has already been scanned.`);
                console.log("QR already scanned.");
                return;
            }

            if (!isTransferable(matchingBook)) {
                setError(`Book "${number}" (status: ${matchingBook.status}) cannot be transferred by ${userRole}.`);
                console.log("Book not transferable.");
                return;
            }

            if (recipientType === "Stub Collection" && matchingBook.status !== "Assigned to Agent") {
                setError(`Book "${number}" must be "Assigned to Agent" for stub collection.`);
                console.log("Invalid status for stub collection.");
                return;
            }

            if (recipientType === "Agent" && selectedBookIDs.length >= 1) {
                setError("Supervisors can only assign one receipt book to an Agent.");
                console.log("Agent limit reached.");
                return;
            }

            console.log("Adding QR:", decodedText, "BookID:", matchingBook.bookID);
            setScannedQR((prev) => {
                const newScanned = [...prev, decodedText];
                console.log("Updated scannedQR:", newScanned);
                return newScanned;
            });
            setSelectedBookIDs((prev) => {
                const newSelected = [...prev, matchingBook.bookID];
                console.log("Updated selectedBookIDs:", newSelected);
                return newSelected;
            });
            scannedQRRef.current.add(decodedText);
            setError(null);
        } catch (err) {
            setError("Invalid QR code format. Please try again.");
            console.error("QR Parse Error:", err);
        }
    }, [isScannerRunning, selectedBookIDs, scannedQR, receiptBooks, isTransferable, recipientType, userRole]);

    // Pre-select agent and force recipient type
    useEffect(() => {
        if (preSelectedAgentID && forceAgent && !recipientType) {
            const initialRecipientType = transferType || "Agent";
            setRecipientType(initialRecipientType);
            setRecipientID(preSelectedAgentID);
            setAgentPhone("");
            const fetchAgent = async () => {
                try {
                    const agent = await getAgentById(preSelectedAgentID, token!);
                    setAgents([agent]);
                } catch (err) {
                    setError("Failed to fetch agent details.");
                    console.error(err);
                }
            };
            fetchAgent();
        }
    }, [preSelectedAgentID, forceAgent, token, recipientType, transferType]);

    // Stop scanner function
    const stopScanner = useCallback(async () => {
        if (stopLockRef.current || !qrScannerRef.current || !isScannerRunning) return;
        stopLockRef.current = true;
        console.log("Stopping QR scanner...");
        try {
            await qrScannerRef.current.stop();
            qrScannerRef.current.clear();
            qrScannerRef.current = null;
            setIsScannerRunning(false);
            scannedQRRef.current.clear();
            console.log("Scanner stopped successfully.");
        } catch (err) {
            console.error("Stop Scanner Error:", err);
        } finally {
            stopLockRef.current = false;
        }
    }, [isScannerRunning]);

    // Start scanner function
    const startScanner = useCallback(async () => {
        if (stopLockRef.current || !qrReaderRef.current || isScannerRunning || isScannerStarting) return;
        setIsScannerStarting(true);
        const html5QrCode = qrScannerRef.current || new Html5Qrcode("qr-reader");
        qrScannerRef.current = html5QrCode;
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        console.log("Starting scanner...");
        try {
            await html5QrCode.start(
                { facingMode: "environment" },
                config,
                handleScanSuccess,
                (err) => console.warn("Scan error:", err)
            );
            console.log("QR scanner started successfully.", { auto: !!preSelectedAgentID });
            setIsScannerRunning(true);
            setError(null);
        } catch (err) {
            setError("Camera access denied or unavailable.");
            console.error("Scanner Start Error:", err);
        } finally {
            setIsScannerStarting(false);
        }
    }, [handleScanSuccess, isScannerRunning, isScannerStarting, preSelectedAgentID]);

    // Unified scanner control
    useEffect(() => {
        if (
            !qrReaderRef.current ||
            !recipientType ||
            !(recipientID || recipientType === "Supplier" || recipientType === "Archive" || recipientType === "Stub Collection") ||
            transferInitiated
        ) {
            return;
        }

        startScanner();

        return () => {
            stopScanner();
        };
    }, [recipientType, recipientID, transferInitiated, startScanner, stopScanner]);

    // Handle page visibility changes
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopScanner();
            } else if (
                recipientType &&
                (recipientID || recipientType === "Supplier" || recipientType === "Archive" || recipientType === "Stub Collection") &&
                !transferInitiated
            ) {
                startScanner();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            stopScanner(); // Ensure scanner stops on unmount
        };
    }, [recipientType, recipientID, transferInitiated, startScanner, stopScanner]);

    // Stop scanner for OTP phase
    useEffect(() => {
        if (transferInitiated && isScannerRunning) {
            stopScanner();
        }
    }, [transferInitiated, isScannerRunning, stopScanner]);

    // Fetch initial data
    useEffect(() => {
        const fetchData = async () => {
            if (!token || !effectivePermissions?.some((p) => p.name === "transfer_receipt_books")) {
                setError("Access Denied - Missing transfer_receipt_books permission");
                setLoading(false);
                return;
            }
            try {
                const [booksData, usersData, locationsData] = await Promise.all([
                    getAllReceiptBooks(token),
                    getAllUsers(token),
                    getAgentLocations(token),
                ]);
                setReceiptBooks(booksData);
                setUsers(usersData);
                setLocations(locationsData);
            } catch (err) {
                setError("Failed to load data. Check console for details.");
                console.error("Fetch Data Error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [token, effectivePermissions]);

    const getRecipientOptions = () => {
        switch (userRole) {
            case "Purchase Team":
                return ["Supplier", "Regional Manager"];
            case "Regional Manager":
                return ["Regional Manager", "Supervisor", "Stock Manager"];
            case "Supervisor":
                return ["Supervisor", "Regional Manager", "Agent", "Stock Manager", "Stub Collection"];
            case "Stock Manager":
                return ["Stock Manager", "Archive"];
            case "Super Admin":
                return ["Supplier", "Regional Manager", "Supervisor", "Agent", "Stock Manager", "Stub Collection", "Archive"];
            default:
                return [];
        }
    };

    const fetchAgentsByLocation = useCallback(async (location: string) => {
        try {
            const agentsData = await getAgentsByLocation(location, token!);
            setAgents(agentsData);
        } catch (err) {
            setError("Failed to fetch agents by location.");
            console.error(err);
        }
    }, [token]);

    useEffect(() => {
        if (!agentPhone || recipientType !== "Agent") return;
        const timeout = setTimeout(async () => {
            try {
                const agent = await getAgentByPhone(agentPhone, token!);
                setRecipientID(agent.agentID);
                setAgents([agent]);
                setSelectedLocation("");
                setError(null);
            } catch (err) {
                setRecipientID("");
                setError(`No agent found with phone ${agentPhone}.`);
                console.error(err);
            }
        }, 500);
        return () => clearTimeout(timeout);
    }, [agentPhone, recipientType, token]);

    useEffect(() => {
        if (!searchQuery || recipientType === "Agent" || recipientType === "Supplier" || recipientType === "Archive" || recipientType === "Stub Collection") return;
        const timeout = setTimeout(async () => {
            try {
                const user = await getUserByPhone(searchQuery, token!);
                if (user.Roles?.some(r => r.name.toLowerCase() === recipientType.toLowerCase())) {
                    setRecipientID(user.userID);
                    setError(null);
                } else {
                    setRecipientID("");
                    setError(`User with phone ${searchQuery} does not have role ${recipientType}.`);
                }
            } catch (err) {
                setRecipientID("");
                setError(`No user found with phone ${searchQuery}.`);
                console.error(err);
            }
        }, 500);
        return () => clearTimeout(timeout);
    }, [searchQuery, recipientType, token]);

    const filteredAgents = () => {
        if (!selectedLocation) return [];
        return agents.filter(a =>
            (a.name!.toLowerCase().includes(searchQuery.toLowerCase()) ||
                a.phone!.includes(searchQuery))
        );
    };

    const filteredUsers = () => {
        return users.filter(u =>
            u.Roles?.some(r => r.name.toLowerCase() === recipientType.toLowerCase()) &&
            (u.firstname.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.lastname.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.phone.includes(searchQuery))
        );
    };

    useEffect(() => {
        if (recipientType === "Agent" && selectedLocation) {
            fetchAgentsByLocation(selectedLocation);
        }
    }, [recipientType, selectedLocation, fetchAgentsByLocation]);

    const handleInitiateTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedBookIDs.length === 0) {
            setError("Please scan at least one QR code.");
            return;
        }
        if (recipientType === "Agent" && selectedBookIDs.length > 1) {
            setError("Supervisors can only assign one receipt book to an Agent.");
            return;
        }
        if (!recipientType) {
            setError("Please select a recipient type.");
            return;
        }
        if (recipientType === "Supplier" && !supplierEmail) {
            setError("Please enter a supplier email.");
            return;
        }
        if (recipientType === "Agent" && !recipientID) {
            setError("Please enter an agent phone number or select an agent.");
            return;
        }
        if (recipientType !== "Supplier" && recipientType !== "Archive" && recipientType !== "Stub Collection" && !recipientID) {
            setError("Please select a recipient or enter a phone number.");
            return;
        }

        try {
            if (recipientType === "Supplier") {
                await sendToSupplier(selectedBookIDs, supplierEmail, token!);
                navigate(-1);
            } else if (recipientType === "Stub Collection") {
                if (selectedBookIDs.length > 1) {
                    setError("Stub collection can only process one book at a time.");
                    return;
                }
                await collectStub(selectedBookIDs[0], token!);
                setTransferInitiated(true);
                setError(null);
            } else if (recipientType === "Archive") {
                await Promise.all(selectedBookIDs.map(bookID => archiveStub(bookID, token!)));
                navigate(-1);
            } else {
                const recipientTypeForAPI = recipientType === "Agent" ? "agent" : "user";
                await transfer(selectedBookIDs, recipientID, recipientTypeForAPI, token!);
                setTransferInitiated(true);
                setError(null);
            }
        } catch (err) {
            setError("Failed to initiate transfer: " + (err instanceof Error ? err.message : "Unknown error"));
            console.error(err);
        }
    };

    const handleValidateTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (recipientType === "Archive") {
            navigate(-1);
            return;
        }
        if (!otp) {
            setError("Please enter the OTP.");
            return;
        }
        try {
            if (recipientType === "Stub Collection") {
                if (selectedBookIDs.length !== 1) {
                    setError("Stub collection requires exactly one book.");
                    return;
                }
                await validateStubCollection(selectedBookIDs[0], otp, token!);
                navigate(-1);
            } else {
                const recipientTypeForAPI = recipientType === "Agent" ? "agent" : "user";
                await validateTransfer(selectedBookIDs, recipientID, otp, recipientTypeForAPI, token!);
                navigate(-1);
            }
        } catch (err) {
            setError("Invalid OTP or transfer validation failed: " + (err instanceof Error ? err.message : "Unknown error"));
            console.error(err);
        }
    };

    if (loading) return <div className="loading">Loading...</div>;
    if (error && !recipientType) return <div className="error">{error}</div>;

    return (
        <div className="transfer-receipt-book-container">
            <header className="transfer-header">
                <h1>Transfer Receipt Books ({userRole})</h1>
            </header>
            <div className="transfer-card">
                {!transferInitiated ? (
                    <form onSubmit={handleInitiateTransfer}>
                        {!forceAgent && (
                            <div className="form-group">
                                <label>Recipient Type</label>
                                <select
                                    value={recipientType}
                                    onChange={(e) => {
                                        setRecipientType(e.target.value);
                                        setRecipientID("");
                                        setSupplierEmail("");
                                        setAgentPhone("");
                                        setSelectedLocation("");
                                        setSearchQuery("");
                                        setSelectedBookIDs([]);
                                        setScannedQR([]);
                                        scannedQRRef.current.clear();
                                        setAgents([]);
                                        setIsScannerRunning(false);
                                    }}
                                    required
                                >
                                    <option value="">Select Recipient Type</option>
                                    {getRecipientOptions().map((type) => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {recipientType && (
                            <>
                                {recipientType === "Agent" && !forceAgent && (
                                    <div className="form-group">
                                        <label>Agent Selection</label>
                                        <input
                                            type="text"
                                            value={agentPhone}
                                            onChange={(e) => setAgentPhone(e.target.value)}
                                            placeholder="Enter agent phone number"
                                        />
                                        {!recipientID && (
                                            <>
                                                <p>OR</p>
                                                <select
                                                    value={selectedLocation}
                                                    onChange={(e) => setSelectedLocation(e.target.value)}
                                                >
                                                    <option value="">Select Location</option>
                                                    {locations.map((loc) => (
                                                        <option key={loc} value={loc}>{loc}</option>
                                                    ))}
                                                </select>
                                                {selectedLocation && (
                                                    <>
                                                        <input
                                                            type="text"
                                                            value={searchQuery}
                                                            onChange={(e) => setSearchQuery(e.target.value)}
                                                            placeholder="Search agents by name or phone"
                                                        />
                                                        <select
                                                            value={recipientID}
                                                            onChange={(e) => setRecipientID(e.target.value)}
                                                        >
                                                            <option value="">Select Agent</option>
                                                            {filteredAgents().map((a) => (
                                                                <option key={a.agentID} value={a.agentID}>
                                                                    {a.name} ({a.phone})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </>
                                                )}
                                            </>
                                        )}
                                        {recipientID && (
                                            <p>Selected Agent: {agents.find(a => a.agentID === recipientID)?.name + " " + agents.find(a => a.agentID === recipientID)?.lastname || "Loading..."}</p>
                                        )}
                                    </div>
                                )}
                                {recipientType === "Supplier" && (
                                    <div className="form-group">
                                        <label>Supplier Email</label>
                                        <input
                                            type="email"
                                            value={supplierEmail}
                                            onChange={(e) => setSupplierEmail(e.target.value)}
                                            placeholder="Enter supplier email"
                                            required
                                        />
                                    </div>
                                )}
                                {recipientType !== "Agent" && recipientType !== "Supplier" && recipientType !== "Archive" && recipientType !== "Stub Collection" && (
                                    <div className="form-group">
                                        <label>Recipient Selection ({recipientType})</label>
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Enter phone number or search by name"
                                        />
                                        <select
                                            value={recipientID}
                                            onChange={(e) => setRecipientID(e.target.value)}
                                        >
                                            <option value="">Select {recipientType}</option>
                                            {filteredUsers().map((u) => (
                                                <option key={u.userID} value={u.userID}>
                                                    {u.firstname} {u.lastname} ({u.phone})
                                                </option>
                                            ))}
                                        </select>
                                        {recipientID && (
                                            <p>Selected User: {users.find(u => u.userID === recipientID)?.firstname} {users.find(u => u.userID === recipientID)?.lastname}</p>
                                        )}
                                    </div>
                                )}
                                {(recipientType === "Agent" || recipientType === "Stub Collection") && forceAgent && (
                                    <div className="form-group">
                                        <label>Selected Agent</label>
                                        <p>{agents.find(a => a.agentID === recipientID)?.name + " " + agents.find(a => a.agentID === recipientID)?.lastname || "Loading..."}</p>
                                    </div>
                                )}
                            </>
                        )}

                        {recipientType && (recipientID || recipientType === "Supplier" || recipientType === "Archive" || recipientType === "Stub Collection") && (
                            <div className="form-group">
                                <label>Scan QR Codes</label>
                                {error && <div className="error-above-camera">{error}</div>}
                                <div id="qr-reader" ref={qrReaderRef} className="qr-reader" style={{ width: "100%", height: "300px" }} />
                                <div className="scanned-list">
                                    <h4>Selected Books ({selectedBookIDs.length})</h4>
                                    <ul>
                                        {selectedBookIDs.map((bookID) => {
                                            const book = receiptBooks.find(r => r.bookID === bookID);
                                            return (
                                                <li key={bookID}>
                                                    {book?.number} ({book?.status})
                                                    <button
                                                        onClick={() => {
                                                            setSelectedBookIDs(prev => prev.filter(id => id !== bookID));
                                                            setScannedQR(prev => prev.filter(qr => qr !== book?.qrCode));
                                                            scannedQRRef.current.delete(book?.qrCode || "");
                                                        }}
                                                    >
                                                        Remove
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    {scannedQR.length > 0 && <p>{scannedQR.length} QR codes scanned.</p>}
                                </div>
                            </div>
                        )}

                        <div className="form-actions">
                            <button type="button" className="back-btn" onClick={() => navigate(-1)}>
                                <FaArrowLeft /> Back
                            </button>
                            {recipientType && (recipientID || recipientType === "Supplier" || recipientType === "Archive" || recipientType === "Stub Collection") && (
                                <button type="submit" className="transfer-btn">
                                    <FaExchangeAlt /> {recipientType === "Stub Collection" ? "Initiate Stub Collection" : "Initiate Transfer"}
                                </button>
                            )}
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleValidateTransfer}>
                        {recipientType !== "Archive" && (
                            <div className="form-group">
                                <label>Enter OTP {recipientType === "Stub Collection" ? "(Sent to Agent)" : `(Sent to ${recipientType} ${recipientID})`}</label>
                                <input
                                    type="text"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    placeholder="Enter OTP"
                                    required
                                />
                            </div>
                        )}
                        {error && <div className="error">{error}</div>}
                        <div className="form-actions">
                            <button type="button" className="back-btn" onClick={() => setTransferInitiated(false)}>
                                <FaArrowLeft /> Back
                            </button>
                            <button type="submit" className="validate-btn">
                                <FaCheck /> {recipientType === "Stub Collection" ? "Validate Stub Collection" : "Validate Transfer"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default TransferReceiptBook;