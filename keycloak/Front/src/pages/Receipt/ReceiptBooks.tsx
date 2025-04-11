import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch, FaSort, FaPlus, FaEdit, FaTrash, FaHistory, FaExchangeAlt } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { getAllReceiptBooks, createReceiptBook, updateReceiptBook, deleteReceiptBook } from "../../apis/receiptBookAPI";
import "./ReceiptBooks.css";
import ReceiptBook from "../../models/ReceiptBook";
import { getUserById } from "../../apis/userAPI";
import { getAgentById } from "../../apis/agentAPI";

const PERMISSIONS = {
    ACCESS_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOKS,
    ACCESS_RECEIPT_BOOK_DETAILS: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOK_DETAILS,
    ACCESS_RECEIPT_BOOK_HISTORY: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOK_HISTORY,
    CREATE_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_CREATE_RECEIPT_BOOKS,
    UPDATE_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_UPDATE_RECEIPT_BOOKS,
    DELETE_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_DELETE_RECEIPT_BOOKS,
    TRANSFER_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_TRANSFER_RECEIPT_BOOKS,
};

const ROLES = {
    SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
    STOCK_MANAGER: import.meta.env.VITE_ROLES_STOCK_MANAGER,
    REGIONAL_MANGER: import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
    PURSHASE_TEAM: import.meta.env.VITE_ROLES_PURCHASE_TEAM,
    SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
};


const ITEMS_PER_PAGE = 10;

const padNumber = (value: string): string => {
    const numericValue = value.replace(/\D/g, ""); // Remove non-digits
    if (numericValue.length > 6) return numericValue.slice(0, 6); // Limit to 6 digits
    return numericValue.padStart(6, "0"); // Pad with zeros to 6 digits
};

// Main Component
const ReceiptBooks: React.FC = () => {
    // Hooks
    const navigate = useNavigate();
    const { token, effectivePermissions, userRoles, permissionsLoaded, user } = useAuth();
    const currentUserID = user!.userID;

    // State
    const [receiptBooks, setReceiptBooks] = useState<ReceiptBook[]>([]); // List of all receipt books
    const [view, setView] = useState<"list" | "create" | "edit">("list"); // Current view mode
    const [searchQuery, setSearchQuery] = useState(""); // Search query for filtering receipt books
    const [sortField, setSortField] = useState<"number" | "type" | "status">("number"); // Field to sort by
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc"); // Sort order
    const [filterType, setFilterType] = useState<string>("all"); // Filter by receipt book type
    const [filterStatus, setFilterStatus] = useState<string>("all"); // Filter by receipt book status
    const [newReceiptBook, setNewReceiptBook] = useState<Partial<ReceiptBook>>({}); // Data for creating a new receipt book
    const [editReceiptBook, setEditReceiptBook] = useState<ReceiptBook | null>(null); // Receipt book being edited
    const [loading, setLoading] = useState(false); // Loading state for async operations
    const [currentPage, setCurrentPage] = useState(1); // Current page for pagination
    const [holdersMap, setHoldersMap] = useState<Map<string, string>>(new Map()); // Map of holder IDs to names
    const [formError, setFormError] = useState<string | null>(null); // Error message for form validation

    // Permission Checks 
    const userPermissions = useMemo(() => ({
        canView: effectivePermissions?.some(p => p.name === PERMISSIONS.ACCESS_RECEIPT_BOOKS),
        canViewDetails: effectivePermissions?.some(p => p.name === PERMISSIONS.ACCESS_RECEIPT_BOOK_DETAILS),
        canViewHistory: effectivePermissions?.some(p => p.name === PERMISSIONS.ACCESS_RECEIPT_BOOK_HISTORY),
        canCreate: effectivePermissions?.some(p => p.name === PERMISSIONS.CREATE_RECEIPT_BOOKS),
        canUpdate: effectivePermissions?.some(p => p.name === PERMISSIONS.UPDATE_RECEIPT_BOOKS),
        canDelete: effectivePermissions?.some(p => p.name === PERMISSIONS.DELETE_RECEIPT_BOOKS),
        canTransfer: effectivePermissions?.some(p => p.name === PERMISSIONS.TRANSFER_RECEIPT_BOOKS),
    }), [effectivePermissions]);

    // Role-Based Capabilities 
    const userCapabilities = useMemo(() => ({
        isSupervisorLike: userRoles?.some(role =>
            role.name === ROLES.SUPERVISOR
        ) || false,
        isStockManagerLike: userRoles?.some(role =>
            role.name === ROLES.STOCK_MANAGER
        ) || false,
        isRegionalManagerLike: userRoles?.some(role =>
            role.name === ROLES.REGIONAL_MANGER
        ) || false,
        isPurchaseTeamLike: userRoles?.some(role =>
            role.name === ROLES.PURSHASE_TEAM
        ) || false
    }), [userRoles]);

    // Fetch Receipt Books with Role-Based Filtering
    useEffect(() => {
        const fetchData = async () => {
            if (!token || !userPermissions.canView || !permissionsLoaded) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const receiptsData = await getAllReceiptBooks(token);
                let filteredBooks = receiptsData.map(receipt => ({
                    ...receipt,
                    qrCode: `data:image/png;base64,${receipt.qrCode}`,
                }));

                // Apply dynamic role-based filtering
                if (userCapabilities.isSupervisorLike) {
                    // Supervisors see books they currently hold
                    filteredBooks = filteredBooks.filter(r => r.currentHolderID === currentUserID);
                }

                if (userCapabilities.isRegionalManagerLike) {
                    // Regional Managers only see books they hold
                    filteredBooks = filteredBooks.filter(r => r.currentHolderID === currentUserID);
                }

                if (userCapabilities.isStockManagerLike) {
                    // Stock Managers exclude books in stock, with themselves, or archived
                    filteredBooks = filteredBooks.filter(r =>
                        ["In Stock", "With Stock Manager", "Archived"].includes(r.status)
                    );
                }

                if (userCapabilities.isPurchaseTeamLike) {
                    // Purchase Team doesn’t see archived books
                    filteredBooks = filteredBooks.filter(r => r.status !== "Archived");
                }

                setReceiptBooks(filteredBooks);
            } catch (error) {
                console.error("Failed to fetch receipt books:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [token, userPermissions.canView, userCapabilities.isSupervisorLike, userCapabilities.isStockManagerLike, currentUserID, permissionsLoaded, userCapabilities.isRegionalManagerLike, userCapabilities.isPurchaseTeamLike]);

    // Fetch Holder Names (Users and Agents)
    useEffect(() => {
        const fetchHolders = async () => {
            const uniqueUserIDs = Array.from(new Set(receiptBooks.map(r => r.currentHolderID).filter(id => id)));
            const uniqueAgentIDs = Array.from(new Set(receiptBooks.map(r => r.agentID).filter(id => id)));
            let hasChanges = false;
            const newHoldersMap = new Map<string, string>(holdersMap);

            // Fetch user names
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

            // Fetch agent names
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

    // Memoized Data Calculations
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

    // Handlers



    // Handler to filter non-numeric input during typing
    const handleNumberChange = (value: string, isEdit: boolean) => {
        const numericValue = value.replace(/\D/g, "").slice(0, 6); // Keep only digits, max 6
        if (isEdit && editReceiptBook) {
            setEditReceiptBook({ ...editReceiptBook, number: numericValue });
        } else {
            setNewReceiptBook({ ...newReceiptBook, number: numericValue });
        }
    };

    // Handler to pad number on blur
    const handleNumberBlur = (value: string, isEdit: boolean) => {
        const paddedValue = padNumber(value);
        if (isEdit && editReceiptBook) {
            setEditReceiptBook({ ...editReceiptBook, number: paddedValue });
        } else {
            setNewReceiptBook({ ...newReceiptBook, number: paddedValue });
        }
    };
    const handleCreate = async () => {
        if (!userPermissions.canCreate) return;
        setFormError(null);
        const paddedNumber = padNumber(newReceiptBook.number || "");
        try {
            if (!paddedNumber || !newReceiptBook.type) {
                setFormError("Please fill in all required fields.");
                return;
            }
            if (paddedNumber.length !== 6) {
                setFormError("Number must be exactly 6 digits.");
                return;
            }
            const createdReceipt = await createReceiptBook(
                { number: paddedNumber, type: newReceiptBook.type },
                token!
            );
            // Transform qrCode to data URL before adding to state
            const transformedReceipt = {
                ...createdReceipt,
                qrCode: `data:image/png;base64,${createdReceipt.qrCode}`,
            };
            setReceiptBooks([...receiptBooks, transformedReceipt]);
            setNewReceiptBook({});
            setView("list");
        } catch (error) {
            setFormError(`Failed to create receipt book: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    };

    const handleUpdate = async () => {
        if (!userPermissions.canUpdate || !editReceiptBook) return;
        setFormError(null);
        const paddedNumber = padNumber(editReceiptBook.number);
        try {
            if (!paddedNumber || !editReceiptBook.type) {
                setFormError("Please fill in all required fields.");
                return;
            }
            if (paddedNumber.length !== 6) {
                setFormError("Number must be exactly 6 digits.");
                return;
            }
            const updatedReceipt = await updateReceiptBook(
                editReceiptBook.bookID,
                { ...editReceiptBook, number: paddedNumber },
                token!
            );
            // Transform qrCode to data URL before updating state
            const transformedReceipt = {
                ...updatedReceipt,
                qrCode: `data:image/png;base64,${updatedReceipt.qrCode}`,
            };
            setReceiptBooks(receiptBooks.map(r => r.bookID === updatedReceipt.bookID ? transformedReceipt : r));
            setEditReceiptBook(null);
            setView("list");
        } catch (error) {
            setFormError(`Failed to update receipt book: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    };

    const handleDelete = async (bookID: string) => {
        // Delete a receipt book with confirmation
        if (!userPermissions.canDelete || !window.confirm("Are you sure?")) return;
        try {
            await deleteReceiptBook(bookID, token!);
            setReceiptBooks(receiptBooks.filter(r => r.bookID !== bookID));
        } catch (error) {
            alert(`Failed to delete receipt book: ${error}`);
        }
    };

    const handleTransfer = () => {
        // Navigate to transfer receipt books page if permitted
        if (userPermissions.canTransfer) {
            navigate("/transfer-receipt-books");
        }
    };




    // Early Returns for Loading and Access Denied
    if (!permissionsLoaded || loading)
        return (
            <div className="page-loading">
                <div className="spinner"></div>
                <p>Loading...</p>
            </div>
        );

    if (!userPermissions.canView) {
        navigate("/access-denied");
        return null;
    }

    // Render
    return (
        <div className="receipt-books">
            {/* Header Section */}
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
                {/* Sidebar Section */}
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
                    {userPermissions.canCreate && (
                        <button className="action-button-0" onClick={() => setView("create")}>
                            <FaPlus /> New Receipt
                        </button>
                    )}
                    {userPermissions.canTransfer && (
                        <button className="action-button-0" onClick={handleTransfer}>
                            <FaExchangeAlt /> Transfer Books
                        </button>
                    )}
                </aside>

                {/* Main Content Section */}
                <main className="main-content">
                    {view === "list" && (
                        <div className="table-card">
                            <h2>Receipts</h2>
                            <div className="table-container">
                                <div className="table-head">
                                    <div className="table-row table-row-1">
                                        <div className="table-cell">Number</div>
                                        <div className="table-cell">Type</div>
                                        <div className="table-cell">Book Status</div>
                                        <div className="table-cell">Stub Status</div>
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
                                            <div className="table-cell">{receipt.ReceiptStub?.status || "N/A"}</div>
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
                                                {userPermissions.canUpdate && (
                                                    <button onClick={() => { setEditReceiptBook(receipt); setView("edit"); }}>
                                                        <FaEdit />
                                                    </button>
                                                )}
                                                {userPermissions.canDelete && (
                                                    <button onClick={() => handleDelete(receipt.bookID)}>
                                                        <FaTrash />
                                                    </button>
                                                )}
                                                {userPermissions.canViewHistory && (
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
                                <span>
                                    Page {currentPage} of {Math.max(1, Math.ceil(filteredReceiptBooks.length / ITEMS_PER_PAGE))}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => p + 1)}
                                    disabled={currentPage >= Math.ceil(filteredReceiptBooks.length / ITEMS_PER_PAGE)}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}

                    {view === "create" && userPermissions.canCreate && (
                        <div className="form-card form-card-0">
                            <h3>New Receipt</h3>
                            {formError && <div className="error-message">{formError}</div>}
                            <div className="form-group">
                                <label>Number</label>
                                <input
                                    type="text"
                                    value={newReceiptBook.number || ""}
                                    onChange={(e) => handleNumberChange(e.target.value, false)}
                                    onBlur={(e) => handleNumberBlur(e.target.value, false)}
                                    maxLength={6}
                                    pattern="[0-9]*"
                                    inputMode="numeric"
                                    placeholder="000001"
                                />
                            </div>
                            <div className="form-group">
                                <label>Type</label>
                                <select
                                    value={newReceiptBook.type || ""}
                                    onChange={(e) => setNewReceiptBook({ ...newReceiptBook, type: e.target.value })}
                                >
                                    <option value="" disabled>Select Type</option>
                                    <option value="Refund">Refund</option>
                                    <option value="Transfer">Transfer</option>
                                </select>
                            </div>
                            <div className="">
                                <button className="action-button-0" onClick={handleCreate}>Create</button>
                                <button className="back-button" onClick={() => setView("list")}>Cancel</button>
                            </div>
                        </div>
                    )}

                    {view === "edit" && editReceiptBook && userPermissions.canUpdate && (
                        <div className="form-card form-card-0">
                            <h3>Edit Receipt #{editReceiptBook.number}</h3>
                            {formError && <div className="error-message">{formError}</div>}
                            <div className="form-group">
                                <label>Number</label>
                                <input
                                    type="text"
                                    value={editReceiptBook.number}
                                    onChange={(e) => handleNumberChange(e.target.value, true)}
                                    onBlur={(e) => handleNumberBlur(e.target.value, true)}
                                    maxLength={6}
                                    pattern="[0-9]*"
                                    inputMode="numeric"
                                    placeholder="000001"
                                />
                            </div>
                            <div className="form-group">
                                <label>Type</label>
                                <select
                                    value={editReceiptBook.type}
                                    onChange={(e) => setEditReceiptBook({ ...editReceiptBook, type: e.target.value })}
                                >
                                    <option value="Refund">Refund</option>
                                    <option value="Transfer">Transfer</option>
                                </select>
                            </div>
                            <div className="">
                                <button className="action-button-0" onClick={handleUpdate}>Save</button>
                                <button className="back-button" onClick={() => setView("list")}>Cancel</button>
                            </div>
                        </div>
                    )}
                </main>
            </section>
        </div>
    );
};

export default ReceiptBooks;