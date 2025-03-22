/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { FaSearch, FaSort, FaPlus, FaEdit, FaTrash, FaPaperPlane, FaHistory, FaQrcode } from "react-icons/fa";
import { Html5Qrcode } from "html5-qrcode"; // Add this line
import { useAuth } from "../../context/AuthContext";
import { getAllReceiptBooks, createReceiptBook, updateReceiptBook, deleteReceiptBook, sendToSupplier, transfer, validateTransfer, getTransferHistory } from "../../apis/receiptBookAPI";
import { getUserById } from "../../apis/userAPI";
import { getAgentById } from "../../apis/agentAPI";
import "./ReceiptBooks.css";
import ReceiptBook from "../../models/ReceiptBook";
import ReceiptBookTransfer from "../../models/ReceiptBookTransfer";

const ITEMS_PER_PAGE = 10;

const ReceiptBooks: React.FC = () => {
    const { token, effectivePermissions } = useAuth();
    const [receiptBooks, setReceiptBooks] = useState<ReceiptBook[]>([]);
    const [view, setView] = useState<"list" | "create" | "edit" | "history" | "send" | "scan" | "transfer" | "validate">("list");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortField, setSortField] = useState<"number" | "type" | "status">("number");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [filterType, setFilterType] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [newReceiptBook, setNewReceiptBook] = useState<Partial<ReceiptBook>>({});
    const [editReceiptBook, setEditReceiptBook] = useState<ReceiptBook | null>(null);
    const [history, setHistory] = useState<ReceiptBookTransfer[]>([]);
    const [usersMap, setUsersMap] = useState<Map<string, string>>(new Map());
    const [agentsMap, setAgentsMap] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [supplierEmail, setSupplierEmail] = useState("");
    const [transferData, setTransferData] = useState<{ recipientID: string; recipientType: "user" | "agent"; otpID?: string } | null>(null);
    const [otpCode, setOtpCode] = useState("");
    const [scannedBookIDs, setScannedBookIDs] = useState<string[]>([]);
    const qrCode = useRef<Html5Qrcode | null>(null);

    const permissions = {
        canView: effectivePermissions?.some(p => p.name === "access_receipt_books"),
        canCreate: effectivePermissions?.some(p => p.name === "create_receipt_books"),
        canUpdate: effectivePermissions?.some(p => p.name === "update_receipt_books"),
        canDelete: effectivePermissions?.some(p => p.name === "delete_receipt_books"),
        canSend: effectivePermissions?.some(p => p.name === "send_receipt_books"),
        canTransfer: effectivePermissions?.some(p => p.name === "transfer_receipt_books"),
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const receiptsData = await getAllReceiptBooks(token!);
                setReceiptBooks(receiptsData);
            } catch (error) {
                console.error("Failed to fetch receipt books:", error);
            } finally {
                setLoading(false);
            }
        };
        if (token && permissions.canView) fetchData();
    }, [token, permissions.canView]);

    // Get unique types and statuses for filter options
    const uniqueTypes = useMemo(() => Array.from(new Set(receiptBooks.map(r => r.type))), [receiptBooks]);
    const uniqueStatuses = useMemo(() => Array.from(new Set(receiptBooks.map(r => r.status))), [receiptBooks]);

    const filteredReceiptBooks = useMemo(() => {
        let result = receiptBooks.filter(r =>
            r.number.toString().includes(searchQuery) ||
            r.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.status.toLowerCase().includes(searchQuery.toLowerCase())
        );

        // Apply type filter
        if (filterType !== "all") {
            result = result.filter(r => r.type === filterType);
        }

        // Apply status filter
        if (filterStatus !== "all") {
            result = result.filter(r => r.status === filterStatus);
        }

        result.sort((a, b) => {
            const fieldA = sortField === "number" ? a.number : sortField === "type" ? a.type : a.status;
            const fieldB = sortField === "number" ? b.number : sortField === "type" ? b.type : b.status;
            return sortOrder === "asc" ? (fieldA > fieldB ? 1 : -1) : (fieldA < fieldB ? 1 : -1);
        });
        return result;
    }, [receiptBooks, searchQuery, sortField, sortOrder, filterType, filterStatus]);

    const paginatedReceiptBooks = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        return filteredReceiptBooks.slice(start, end);
    }, [filteredReceiptBooks, currentPage]);

    const handleCreate = async () => {
        if (!permissions.canCreate) return;
        try {
            if (newReceiptBook.number && newReceiptBook.type) {
                const createdReceipt = await createReceiptBook({ number: newReceiptBook.number, type: newReceiptBook.type }, token!);
                setReceiptBooks([...receiptBooks, createdReceipt]);
                setNewReceiptBook({});
                setView("list");
            } else {
                alert("Please fill in all required fields.");
            }
        } catch (error) {
            alert("Failed to create receipt book");
        }
    };

    const handleUpdate = async () => {
        if (!permissions.canUpdate || !editReceiptBook) return;
        try {
            const updatedReceipt = await updateReceiptBook(editReceiptBook.bookID, editReceiptBook, token!);
            setReceiptBooks(receiptBooks.map(r => r.bookID === updatedReceipt.bookID ? updatedReceipt : r));
            setEditReceiptBook(null);
            setView("list");
        } catch (error) {
            alert("Failed to update receipt book");
        }
    };

    const handleDelete = async (bookID: string) => {
        if (!permissions.canDelete || !window.confirm("Are you sure?")) return;
        try {
            await deleteReceiptBook(bookID, token!);
            setReceiptBooks(receiptBooks.filter(r => r.bookID !== bookID));
        } catch (error) {
            alert("Failed to delete receipt book");
        }
    };

    const handleSendToSupplier = async () => {
        if (!permissions.canSend || !supplierEmail) return;
        try {
            await sendToSupplier([/* Still needs bookIDs, maybe from another source */], supplierEmail, token!);
            // Update logic if send-to-supplier also uses scanning later
            setSupplierEmail("");
            setView("list");
        } catch (error) {
            alert("Failed to send to supplier");
        }
    };

    const handleScanStart = () => {
        if (!qrCode.current && permissions.canTransfer) {
            const html5QrCode = new Html5Qrcode("qr-reader");
            qrCode.current = html5QrCode;

            const config = { fps: 10, qrbox: { width: 250, height: 250 } };
            const qrCodeSuccessCallback = (decodedText: string) => {
                const bookID = decodedText; // Assuming QR code contains bookID
                if (receiptBooks.some(r => r.bookID === bookID) && !scannedBookIDs.includes(bookID)) {
                    setScannedBookIDs(prev => [...prev, bookID]);
                }
            };

            const qrCodeErrorCallback = (error: string) => {
                console.warn(`QR scan error: ${error}`);
                if (error.includes("NotAllowedError")) {
                    alert("Camera access denied. Please allow camera access and try again.");
                } else if (error.includes("NotFoundError")) {
                    alert("No camera found on this device.");
                }
            };

            html5QrCode
                .start({ facingMode: "environment" }, config, qrCodeSuccessCallback, qrCodeErrorCallback)
                .catch((err) => {
                    console.error("Failed to start camera:", err);
                    alert("Failed to start QR scanner.");
                });
        }
    };

    const handleScanStop = () => {
        if (qrCode.current) {
            qrCode.current
                .stop()
                .then(() => qrCode.current?.clear())
                .catch((err) => console.error("Cleanup error:", err));
            qrCode.current = null;
        }
        setScannedBookIDs([]);
        setView("list");
    };

    const handleScanError = (err: Error) => {
        console.error("QR Scan Error:", err);
        alert("Failed to scan QR code. Please try again.");
    };

    const proceedToTransfer = () => {
        if (scannedBookIDs.length > 0) {
            handleScanStop(); // Stop scanning before proceeding
            setView("transfer");
        } else {
            alert("Please scan at least one receipt book QR code.");
        }
    };

    const handleTransfer = async () => {
        if (!permissions.canTransfer || !transferData || scannedBookIDs.length === 0) return;
        try {
            const result = await transfer(scannedBookIDs, transferData.recipientID, transferData.recipientType, token!);
            setTransferData({ ...transferData, otpID: result.message });
            setView("validate");
        } catch (error) {
            alert("Failed to initiate transfer");
        }
    };

    const handleValidateTransfer = async () => {
        if (!transferData?.otpID || !otpCode) return;
        try {
            await validateTransfer(scannedBookIDs, transferData.recipientID, otpCode, transferData.recipientType, token!);
            const updatedBooks = await getAllReceiptBooks(token!);
            setReceiptBooks(updatedBooks);
            setScannedBookIDs([]);
            setTransferData(null);
            setOtpCode("");
            setView("list");
        } catch (error) {
            alert("Failed to validate transfer");
        }
    };

    const handleViewHistory = async (bookID: string) => {
        try {
            const historyData = await getTransferHistory(bookID, token!);
            setHistory(historyData);

            const userIDs = new Set<string>();
            const agentIDs = new Set<string>();
            historyData.forEach(entry => {
                if (entry.fromUserID) userIDs.add(entry.fromUserID);
                if (entry.toUserID) userIDs.add(entry.toUserID);
                if (entry.toAgentID) agentIDs.add(entry.toAgentID);
            });

            const userPromises = Array.from(userIDs).map(id => getUserById(id, token!));
            const userResults = await Promise.all(userPromises);
            const newUsersMap = new Map<string, string>();
            userResults.forEach(user => newUsersMap.set(user.userID, `${user.firstname} ${user.lastname}`));
            setUsersMap(newUsersMap);

            if (agentIDs.size > 0) {
                const agentPromises = Array.from(agentIDs).map(id => getAgentById(id, token!));
                const agentResults = await Promise.all(agentPromises);
                const newAgentsMap = new Map<string, string>();
                agentResults.forEach(agent => newAgentsMap.set(agent.agentID, agent.name + ' ' + agent.lastname));
                setAgentsMap(newAgentsMap);
            }

            setView("history");
        } catch (error) {
            alert("Failed to fetch history or user/agent details");
        }
    };

    if (loading) return <div className="loading-text">Loading...</div>;

    return (
        <div className="receipt-books">
            <header className="dashboard-header">
                <h1>{view === "list" ? "Receipt Books" : view.charAt(0).toUpperCase() + view.slice(1)}</h1>
                {view === "list" && (
                    <div className="search-container">
                        <FaSearch className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search receipts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                    </div>
                )}
            </header>

            <section className="dashboard-content">
            <aside className="sidebar">
            <div className="sort-card">
                <h3>Sort By</h3>
                <select value={sortField} onChange={(e) => setSortField(e.target.value as "number" | "type" | "status")}>
                    <option value="number">Number</option>
                    <option value="type">Type</option>
                    <option value="status">Status</option>
                </select>
                <button onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}>
                    <FaSort /> {sortOrder === "asc" ? "Asc" : "Desc"}
                </button>
            </div>

            <div className="filter-card">
                <h3>Filters</h3>
                <div className="form-group">
                    <label>Type</label>
                    <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                        <option value="all">All Types</option>
                        {uniqueTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label>Status</label>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                        <option value="all">All Statuses</option>
                        {uniqueStatuses.map(status => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                </div>
            </div>

            {permissions.canCreate && (
                <button className="action-button" onClick={() => setView("create")}>
                    <FaPlus /> New Receipt
                </button>
            )}
            {permissions.canSend && (
                <button className="action-button" onClick={() => setView("send")}>
                    <FaPaperPlane /> Send to Supplier
                </button>
            )}
            {permissions.canTransfer && (
                <button className="action-button" onClick={() => setView("scan")}>
                    <FaQrcode /> Scan & Transfer
                </button>
            )}
        </aside>

                <main className="main-content">
                    {view === "list" && permissions.canView && (
                        <div className="table-card">
                            <h2>Receipts</h2>
                            <div className="table-container">
                                <div className="table-head">
                                    <div className="table-row table-row-1">
                                        <div className="table-cell">Number</div>
                                        <div className="table-cell">Type</div>
                                        <div className="table-cell">Status</div>
                                        <div className="table-cell">Holder</div>
                                        <div className="table-cell">QR Code</div>
                                        <div className="table-cell">Actions</div>
                                    </div>
                                </div>
                                <div className="table-body">
                                    {paginatedReceiptBooks.map((receipt) => (
                                        <div key={receipt.bookID} className="table-row table-row-1">
                                            <div className="table-cell">{receipt.number}</div>
                                            <div className="table-cell">{receipt.type}</div>
                                            <div className="table-cell">{receipt.status}</div>
                                            <div className="table-cell">{receipt.currentHolderID ? usersMap.get(receipt.currentHolderID) || "N/A" : "N/A"}</div>
                                            <div className="table-cell">
                                                <img src={receipt.qrCode} alt="QR Code" style={{ width: "50px" }} />
                                            </div>
                                            <div className="table-cell actions">
                                                {permissions.canUpdate && <button onClick={() => { setEditReceiptBook(receipt); setView("edit"); }}><FaEdit /></button>}
                                                {permissions.canDelete && <button onClick={() => handleDelete(receipt.bookID)}><FaTrash /></button>}
                                                <button onClick={() => handleViewHistory(receipt.bookID)}><FaHistory /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="pagination">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</button>
                                <span>Page {currentPage} of {Math.ceil(filteredReceiptBooks.length / ITEMS_PER_PAGE)}</span>
                                <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= Math.ceil(filteredReceiptBooks.length / ITEMS_PER_PAGE)}>Next</button>
                            </div>
                        </div>
                    )}

                    {view === "create" && permissions.canCreate && (
                        <div className="form-card">
                            <h3>New Receipt</h3>
                            <div className="form-group">
                                <label>Number</label>
                                <input value={newReceiptBook.number || ""} onChange={(e) => setNewReceiptBook({ ...newReceiptBook, number: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Type</label>
                                <input value={newReceiptBook.type || ""} onChange={(e) => setNewReceiptBook({ ...newReceiptBook, type: e.target.value })} />
                            </div>
                            <button className="action-button" onClick={handleCreate}>Create</button>
                            <button className="back-button" onClick={() => setView("list")}>Cancel</button>
                        </div>
                    )}

                    {view === "edit" && editReceiptBook && permissions.canUpdate && (
                        <div className="form-card">
                            <h3>Edit Receipt #{editReceiptBook.number}</h3>
                            <div className="form-group">
                                <label>Number</label>
                                <input value={editReceiptBook.number} onChange={(e) => setEditReceiptBook({ ...editReceiptBook, number: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Type</label>
                                <input value={editReceiptBook.type} onChange={(e) => setEditReceiptBook({ ...editReceiptBook, type: e.target.value })} />
                            </div>
                            <button className="action-button" onClick={handleUpdate}>Save</button>
                            <button className="back-button" onClick={() => setView("list")}>Cancel</button>
                        </div>
                    )}

                    {view === "send" && permissions.canSend && (
                        <div className="form-card">
                            <h3>Send Receipts to Supplier</h3>
                            <div className="form-group">
                                <label>Supplier Email</label>
                                <input value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)} placeholder="Enter supplier email" />
                            </div>
                            <button className="action-button" onClick={handleSendToSupplier}>Send</button>
                            <button className="back-button" onClick={() => setView("list")}>Cancel</button>
                        </div>
                    )}

                    {view === "scan" && permissions.canTransfer && (
                        <div className="scan-card">
                            <h3>Scan Receipt Book QR Codes</h3>
                            <div id="qr-reader" className="qr-reader" onMouseEnter={handleScanStart}></div>
                            <div className="scanned-list">
                                <h4>Scanned Receipts ({scannedBookIDs.length})</h4>
                                <ul>
                                    {scannedBookIDs.map((bookID) => (
                                        <li key={bookID}>
                                            {receiptBooks.find(r => r.bookID === bookID)?.number || bookID}
                                            <button onClick={() => setScannedBookIDs(prev => prev.filter(id => id !== bookID))}>Remove</button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <button className="action-button" onClick={proceedToTransfer}>Proceed to Transfer</button>
                            <button className="back-button" onClick={handleScanStop}>Cancel</button>
                        </div>
                    )}

                    {view === "transfer" && permissions.canTransfer && (
                        <div className="form-card">
                            <h3>Transfer {scannedBookIDs.length} Receipts</h3>
                            <div className="form-group">
                                <label>Recipient ID</label>
                                <input value={transferData?.recipientID || ""} onChange={(e) => setTransferData({ ...transferData!, recipientID: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Recipient Type</label>
                                <select value={transferData?.recipientType || "user"} onChange={(e) => setTransferData({ ...transferData!, recipientType: e.target.value as "user" | "agent" })}>
                                    <option value="user">User</option>
                                    <option value="agent">Agent</option>
                                </select>
                            </div>
                            <button className="action-button" onClick={handleTransfer}>Initiate Transfer</button>
                            <button className="back-button" onClick={() => { setScannedBookIDs([]); setView("list"); }}>Cancel</button>
                        </div>
                    )}

                    {view === "validate" && transferData && (
                        <div className="form-card">
                            <h3>Validate Transfer</h3>
                            <div className="form-group">
                                <label>OTP Code</label>
                                <input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="Enter OTP" />
                            </div>
                            <button className="action-button" onClick={handleValidateTransfer}>Validate</button>
                            <button className="back-button" onClick={() => { setScannedBookIDs([]); setView("list"); }}>Cancel</button>
                        </div>
                    )}

                    {view === "history" && (
                        <div className="history-card">
                            <h3>Transfer History</h3>
                            <div className="table-container">
                                <div className="table-head">
                                    <div className="table-row table-row-2">
                                        <div className="table-cell">Action</div>
                                        <div className="table-cell">Date</div>
                                        <div className="table-cell">From</div>
                                        <div className="table-cell">To</div>
                                    </div>
                                </div>
                                <div className="table-body">
                                    {history.map((entry, index) => (
                                        <div key={index} className="table-row table-row-2">
                                            <div className="table-cell">{entry.transferType}</div>
                                            <div className="table-cell">{new Date(entry.transferDate).toLocaleString()}</div>
                                            <div className="table-cell">{entry.fromUserID ? usersMap.get(entry.fromUserID) || "N/A" : "N/A"}</div>
                                            <div className="table-cell">{entry.toUserID ? usersMap.get(entry.toUserID) || "N/A" : entry.toAgentID ? agentsMap.get(entry.toAgentID) || "N/A" : "N/A"}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <button className="back-button" onClick={() => setView("list")}>Back</button>
                        </div>
                    )}
                </main>
            </section>
        </div>
    );
};

export default ReceiptBooks;