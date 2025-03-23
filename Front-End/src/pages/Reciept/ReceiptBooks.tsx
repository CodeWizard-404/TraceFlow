import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch, FaSort, FaPlus, FaEdit, FaTrash, FaHistory, FaExchangeAlt } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { getAllReceiptBooks, createReceiptBook, updateReceiptBook, deleteReceiptBook } from "../../apis/receiptBookAPI";
import "./ReceiptBooks.css";
import ReceiptBook from "../../models/ReceiptBook";
import { getUserById } from "../../apis/userAPI";
import { getAgentById } from "../../apis/agentAPI";

const ITEMS_PER_PAGE = 10;

const ReceiptBooks: React.FC = () => {
    const { token, effectivePermissions, userRoles } = useAuth();
    const navigate = useNavigate();
    const [receiptBooks, setReceiptBooks] = useState<ReceiptBook[]>([]);
    const [view, setView] = useState<"list" | "create" | "edit">("list");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortField, setSortField] = useState<"number" | "type" | "status">("number");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [filterType, setFilterType] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [newReceiptBook, setNewReceiptBook] = useState<Partial<ReceiptBook>>({});
    const [editReceiptBook, setEditReceiptBook] = useState<ReceiptBook | null>(null);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [holdersMap, setHoldersMap] = useState<Map<string, string>>(new Map());

    const currentUserID = token ? JSON.parse(atob(token.split('.')[1])).sub : "";
    const userRole = userRoles?.[0]?.name || "";

    // Permissions object based on effectivePermissions
    const permissions = {
        canView: effectivePermissions?.some(p => p.name === "access_receipt_books"),
        canViewDetails: effectivePermissions?.some(p => p.name === "access_receipt_book_details"),
        canViewHistory: effectivePermissions?.some(p => p.name === "access_receipt_book_history"),
        canCreate: effectivePermissions?.some(p => p.name === "create_receipt_books"),
        canUpdate: effectivePermissions?.some(p => p.name === "update_receipt_books"),
        canDelete: effectivePermissions?.some(p => p.name === "delete_receipt_books"),
        canTransfer: effectivePermissions?.some(p => p.name === "transfer_receipt_books"),
    };

    // Fetch receipt books with role-based filtering
    useEffect(() => {
        const fetchData = async () => {
            if (!token || !permissions.canView) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const receiptsData = await getAllReceiptBooks(token);
                let filteredBooks = receiptsData;

                // Apply role-specific filters based on permissions and role context
                if (userRole === "Supervisor") {
                    filteredBooks = receiptsData.filter(r => r.currentHolderID === currentUserID);
                } else if (userRole === "Stock Manager") {
                    filteredBooks = receiptsData.filter(r => 
                        !["In Stock", "With Stock Manager", "Archived"].includes(r.status)
                    );
                }

                setReceiptBooks(filteredBooks);
            } catch (error) {
                console.error("Failed to fetch receipt books:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [token, permissions.canView, userRole, currentUserID]);

    // Fetch holder names (users and agents)
    useEffect(() => {
        const fetchHolders = async () => {
            const uniqueUserIDs = Array.from(new Set(receiptBooks.map(r => r.currentHolderID).filter(id => id)));
            const uniqueAgentIDs = Array.from(new Set(receiptBooks.map(r => r.agentID).filter(id => id)));
            let hasChanges = false;
            const newHoldersMap = new Map<string, string>(holdersMap);

            for (const userID of uniqueUserIDs) {
                if (userID && !newHoldersMap.has(userID)) {
                    try {
                        const userData = await getUserById(userID, token!);
                        newHoldersMap.set(userID, `${userData.firstname} ${userData.lastname}`);
                        hasChanges = true;
                    } catch (error) {
                        console.error(`Failed to fetch user ${userID}:`, error);
                        newHoldersMap.set(userID, "Unknown User");
                        hasChanges = true;
                    }
                }
            }

            for (const agentID of uniqueAgentIDs) {
                if (agentID && !newHoldersMap.has(agentID)) {
                    try {
                        const agentData = await getAgentById(agentID, token!);
                        newHoldersMap.set(agentID, `${agentData.name} ${agentData.lastname}`);
                        hasChanges = true;
                    } catch (error) {
                        console.error(`Failed to fetch agent ${agentID}:`, error);
                        newHoldersMap.set(agentID, "Unknown Agent");
                        hasChanges = true;
                    }
                }
            }

            if (hasChanges) setHoldersMap(newHoldersMap);
        };

        if (token && receiptBooks.length > 0) fetchHolders();
    }, [token, receiptBooks, holdersMap]);

    const uniqueTypes = useMemo(() => Array.from(new Set(receiptBooks.map(r => r.type))), [receiptBooks]);
    const uniqueStatuses = useMemo(() => Array.from(new Set(receiptBooks.map(r => r.status))), [receiptBooks]);

    const filteredReceiptBooks = useMemo(() => {
        let result = receiptBooks.filter(r =>
            r.number.toString().includes(searchQuery) ||
            r.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.status.toLowerCase().includes(searchQuery.toLowerCase())
        );
        if (filterType !== "all") result = result.filter(r => r.type === filterType);
        if (filterStatus !== "all") result = result.filter(r => r.status === filterStatus);
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
            alert(`Failed to create receipt book: ${error}`);
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
            alert(`Failed to update receipt book: ${error}`);
        }
    };

    const handleDelete = async (bookID: string) => {
        if (!permissions.canDelete || !window.confirm("Are you sure?")) return;
        try {
            await deleteReceiptBook(bookID, token!);
            setReceiptBooks(receiptBooks.filter(r => r.bookID !== bookID));
        } catch (error) {
            alert(`Failed to delete receipt book: ${error}`);
        }
    };

    const handleTransfer = () => {
        if (permissions.canTransfer) {
            navigate("/transfer-receipt-books");
        }
    };

    if (loading) return <div className="loading-text">Loading...</div>;
    if (!permissions.canView) return <div className="error-text">Access Denied: You lack permission to view receipt books.</div>;

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
                                {uniqueTypes.map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Status</label>
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                                <option value="all">All Statuses</option>
                                {uniqueStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                            </select>
                        </div>
                    </div>
                    {permissions.canCreate && (
                        <button className="action-button" onClick={() => setView("create")}>
                            <FaPlus /> New Receipt
                        </button>
                    )}
                    {permissions.canTransfer && (
                        <button className="action-button" onClick={handleTransfer}>
                            <FaExchangeAlt /> Transfer Books
                        </button>
                    )}
                </aside>

                <main className="main-content">
                    {view === "list" && (
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
                                            <div className="table-cell">
                                                {receipt.agentID
                                                    ? holdersMap.get(receipt.agentID) || "Loading..."
                                                    : receipt.currentHolderID
                                                    ? holdersMap.get(receipt.currentHolderID) || "Loading..."
                                                    : "N/A"}
                                            </div>
                                            <div className="table-cell">
                                                <img src={receipt.qrCode} alt="QR Code" style={{ width: "50px" }} />
                                            </div>
                                            <div className="table-cell actions">
                                                {permissions.canUpdate && (
                                                    <button onClick={() => { setEditReceiptBook(receipt); setView("edit"); }}>
                                                        <FaEdit />
                                                    </button>
                                                )}
                                                {permissions.canDelete && (
                                                    <button onClick={() => handleDelete(receipt.bookID)}>
                                                        <FaTrash />
                                                    </button>
                                                )}
                                                {permissions.canViewHistory && (
                                                    <button onClick={() => navigate(`/receipt-book/${receipt.bookID}/history`)}>
                                                        <FaHistory />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="pagination">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    Previous
                                </button>
                                <span>Page {currentPage} of {Math.ceil(filteredReceiptBooks.length / ITEMS_PER_PAGE)}</span>
                                <button
                                    onClick={() => setCurrentPage(p => p + 1)}
                                    disabled={currentPage >= Math.ceil(filteredReceiptBooks.length / ITEMS_PER_PAGE)}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}

                    {view === "create" && permissions.canCreate && (
                        <div className="form-card">
                            <h3>New Receipt</h3>
                            <div className="form-group">
                                <label>Number</label>
                                <input
                                    value={newReceiptBook.number || ""}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewReceiptBook({ ...newReceiptBook, number: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Type</label>
                                <input
                                    value={newReceiptBook.type || ""}
                                    onChange={(e) => setNewReceiptBook({ ...newReceiptBook, type: e.target.value })}
                                />
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
                                <input
                                    value={editReceiptBook.number}
                                    onChange={(e) => setEditReceiptBook({ ...editReceiptBook, number: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Type</label>
                                <input
                                    value={editReceiptBook.type}
                                    onChange={(e) => setEditReceiptBook({ ...editReceiptBook, type: e.target.value })}
                                />
                            </div>
                            <button className="action-button" onClick={handleUpdate}>Save</button>
                            <button className="back-button" onClick={() => setView("list")}>Cancel</button>
                        </div>
                    )}
                </main>
            </section>
        </div>
    );
};

export default ReceiptBooks;