import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaHistory } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { getReceiptBookById, getTransferHistory } from "../../apis/receiptBookAPI";
import { getUserById } from "../../apis/userAPI";
import { getAgentById } from "../../apis/agentAPI";
import ReceiptBook from "../../models/ReceiptBook";
import ReceiptBookTransfer from "../../models/ReceiptBookTransfer";
import "./ReceiptBookHistory.css";

const PERMISSIONS = {
    ACCESS_RECEIPT_BOOK_HISTORY: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOK_HISTORY,
};

// Role-based status colors for visualization
const STATUS_COLORS = {
    "In Stock": "#4CAF50",
    "Sent to Supplier": "#2196F3",
    "Collect from Supplier": "#CBDA35",
    "With Regional Manager": "#FF9800",
    "With Supervisor": "#9C27B0",
    "Assigned to Agent": "#F44336",
    "Stub Collected": "#795548",
    "With Stock Manager": "#607D8B",
    "Archived": "#000000",
    "ToSupplier": "#2196F3",
    "ToRegionalManager": "#FF9800",
    "ToSupervisor": "#9C27B0",
    "ToAgent": "#F44336",
    "StubToSupervisor": "#795548",
    "ToStockManager": "#607D8B",
    "ToRegionalManagerFromSupervisor": "#FF9800",
} as const;

// Main Component
const ReceiptBookHistory: React.FC = () => {
    // Hooks
    const { bookID } = useParams<{ bookID: string }>(); // Receipt book ID from URL params
    const navigate = useNavigate();
    const { token, effectivePermissions } = useAuth();

    // State
    const [book, setBook] = useState<ReceiptBook | null>(null); // Current receipt book details
    const [history, setHistory] = useState<ReceiptBookTransfer[]>([]); // Transfer history of the receipt book
    const [usersMap, setUsersMap] = useState<Map<string, string>>(new Map()); // Map of user IDs to full names
    const [agentsMap, setAgentsMap] = useState<Map<string, string>>(new Map()); // Map of agent IDs to full names
    const [loading, setLoading] = useState<boolean>(true); // Loading state for data fetch
    const [error, setError] = useState<string | null>(null); // Error message

    // Permission Checks 
    const userPermissions = React.useMemo(() => ({
        canViewHistory: effectivePermissions?.some(p => p.name === PERMISSIONS.ACCESS_RECEIPT_BOOK_HISTORY),
    }), [effectivePermissions]);

    // Fetch receipt book details and transfer history
    useEffect(() => {
        const fetchData = async () => {
            if (!bookID || !token || !userPermissions.canViewHistory) {
                setError("Access Denied or Invalid Book ID");
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const [bookData, historyData] = await Promise.all([
                    getReceiptBookById(bookID, token),
                    getTransferHistory(bookID, token),
                ]);
                setBook(bookData);
                setHistory(historyData);

                // Collect unique user and agent IDs from history
                const userIDs = new Set<string>();
                const agentIDs = new Set<string>();
                historyData.forEach(entry => {
                    if (entry.fromUserID) userIDs.add(entry.fromUserID);
                    if (entry.toUserID) userIDs.add(entry.toUserID);
                    if (entry.toAgentID) agentIDs.add(entry.toAgentID);
                });

                // Fetch user names
                const userPromises = Array.from(userIDs).map(id => getUserById(id, token));
                const userResults = await Promise.all(userPromises);
                const newUsersMap = new Map<string, string>(
                    userResults.map(user => [user.userID, `${user.firstname} ${user.lastname}`])
                );
                setUsersMap(newUsersMap);

                // Fetch agent names if applicable
                if (agentIDs.size > 0) {
                    const agentPromises = Array.from(agentIDs).map(id => getAgentById(id, token));
                    const agentResults = await Promise.all(agentPromises);
                    const newAgentsMap = new Map<string, string>(
                        agentResults.map(agent => [agent.agentID, `${agent.name} ${agent.lastname}`])
                    );
                    setAgentsMap(newAgentsMap);
                }
            } catch (err) {
                setError("Failed to fetch history or details.");
                console.error("Fetch Error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [bookID, token, userPermissions.canViewHistory]);

    // Determine the role involved in a transfer
    const getRoleFromTransfer = (entry: ReceiptBookTransfer): string => {
        if (entry.toAgentID) return "Agent";
        if (entry.transferType.includes("Supplier")) return "Supplier";
        if (entry.transferType.includes("RegionalManager")) return "Regional Manager";
        if (entry.transferType.includes("Supervisor")) return "Supervisor";
        if (entry.transferType.includes("StockManager")) return "Stock Manager";
        if (entry.transferType.includes("Archive")) return "Archive";
        return "Unknown";
    };

    // Assign CSS classes to timeline nodes based on transfer context
    const getNodeClass = (entry: ReceiptBookTransfer, prevEntry?: ReceiptBookTransfer, index?: number): string => {
        const currentRole = getRoleFromTransfer(entry);
        const prevRole = prevEntry ? getRoleFromTransfer(prevEntry) : null;

        const isSameRole = prevRole && currentRole === prevRole && currentRole !== "Agent" && currentRole !== "Supplier";
        const isReturn = prevRole === "Supervisor" && currentRole === "Regional Manager";
        const hasStub = history.some((e, i) => i < (index || 0) && e.transferType === "StubToSupervisor");
        const isDirect = prevRole === "Supervisor" && currentRole === "Stock Manager" && hasStub;

        return `${isSameRole ? "same-role" : ""} ${isReturn ? "return" : ""} ${isDirect ? "direct" : ""}`.trim();
    };

    // Get color for a given status or transfer type
    const getStatusColor = (status: string): string => {
        return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || "#757575"; // Default gray for unknown status
    };

    // Early Returns for Loading and Error States
    if (loading) return <div className="loading">Tracking History...</div>;
    if (error || !book) return <div className="error">{error || "Receipt book not found."}</div>;

    // Render
    return (
        <div className="history-container">
            {/* Header Section */}
            <header className="history-header">
                <h1>Receipt Book #{book.number} History</h1>
                <button className="back-btn" onClick={() => navigate("/receipt-books")}>
                    <FaArrowLeft /> Back to Receipts
                </button>
            </header>

            {/* Footer Section with Current Status */}
            <div className="history-footer">
                <p>Current Status: <span style={{ color: getStatusColor(book.status) }}>{book.status}</span></p>
                <p>Current Holder: {book.currentHolderID ? usersMap.get(book.currentHolderID) : book.agentID ? agentsMap.get(book.agentID) : "N/A"}</p>
            </div>

            {/* Timeline Section */}
            <div className="timeline">
                <div className="timeline-path">
                    {history.map((entry, index) => (
                        <div key={entry.transferID} className={`timeline-node ${getNodeClass(entry, history[index - 1], index)}`}>
                            <div className="node-marker" style={{ backgroundColor: getStatusColor(entry.transferType) }}>
                                <FaHistory />
                            </div>
                            <div className={`node-details ${getNodeClass(entry, history[index - 1], index)}`}>
                                <h3>{entry.transferType.replace(/([A-Z])/g, " $1").trim()}</h3>
                                <p><strong>From:</strong> {entry.fromUserID ? usersMap.get(entry.fromUserID) : "Initial Stock"}</p>
                                <p><strong>To:</strong> {entry.toUserID ? usersMap.get(entry.toUserID) : entry.toAgentID ? agentsMap.get(entry.toAgentID) : "Supplier"}</p>
                                <p><strong>Date:</strong> {new Date(entry.transferDate).toLocaleString()}</p>
                                <p><strong>Status:</strong> {entry.status}</p>
                            </div>
                            {index < history.length - 1 && <div className="timeline-connector"></div>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ReceiptBookHistory;