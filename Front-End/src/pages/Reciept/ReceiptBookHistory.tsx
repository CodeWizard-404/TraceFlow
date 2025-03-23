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

const ReceiptBookHistory: React.FC = () => {
    const { bookID } = useParams<{ bookID: string }>();
    const { token, effectivePermissions } = useAuth();
    const navigate = useNavigate();
    const [book, setBook] = useState<ReceiptBook | null>(null);
    const [history, setHistory] = useState<ReceiptBookTransfer[]>([]);
    const [usersMap, setUsersMap] = useState<Map<string, string>>(new Map());
    const [agentsMap, setAgentsMap] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!bookID || !token || !effectivePermissions?.some(p => p.name === "access_receipt_book_history")) {
                setError("Access Denied or Invalid Book ID");
                setLoading(false);
                return;
            }
            try {
                const [bookData, historyData] = await Promise.all([
                    getReceiptBookById(bookID, token),
                    getTransferHistory(bookID, token),
                ]);
                setBook(bookData);
                setHistory(historyData);

                const userIDs = new Set<string>();
                const agentIDs = new Set<string>();
                historyData.forEach(entry => {
                    if (entry.fromUserID) userIDs.add(entry.fromUserID);
                    if (entry.toUserID) userIDs.add(entry.toUserID);
                    if (entry.toAgentID) agentIDs.add(entry.toAgentID);
                });

                const userPromises = Array.from(userIDs).map(id => getUserById(id, token));
                const userResults = await Promise.all(userPromises);
                const newUsersMap = new Map<string, string>();
                userResults.forEach(user => newUsersMap.set(user.userID, `${user.firstname} ${user.lastname}`));
                setUsersMap(newUsersMap);

                if (agentIDs.size > 0) {
                    const agentPromises = Array.from(agentIDs).map(id => getAgentById(id, token));
                    const agentResults = await Promise.all(agentPromises);
                    const newAgentsMap = new Map<string, string>();
                    agentResults.forEach(agent => newAgentsMap.set(agent.agentID, `${agent.name} ${agent.lastname}`));
                    setAgentsMap(newAgentsMap);
                }
            } catch (err) {
                setError("Failed to fetch history or details.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [bookID, token, effectivePermissions]);

    const getRoleFromTransfer = (entry: ReceiptBookTransfer) => {
        if (entry.toAgentID) return "Agent";
        if (entry.transferType.includes("Supplier")) return "Supplier";
        if (entry.transferType.includes("RegionalManager")) return "Regional Manager";
        if (entry.transferType.includes("Supervisor")) return "Supervisor";
        if (entry.transferType.includes("StockManager")) return "Stock Manager";
        if (entry.transferType.includes("Archive")) return "Archive";
        return "Unknown";
    };

    const getNodeClass = (entry: ReceiptBookTransfer, prevEntry?: ReceiptBookTransfer, index?: number) => {
        const currentRole = getRoleFromTransfer(entry);
        const prevRole = prevEntry ? getRoleFromTransfer(prevEntry) : null;

        // Same-Role Transfer: Same role as previous (e.g., Regional Manager → Regional Manager)
        const isSameRole = prevRole && currentRole === prevRole && currentRole !== "Agent" && currentRole !== "Supplier";

        // Return: Supervisor → Regional Manager (pre-Agent or post-stub)
        const isReturn = prevRole === "Supervisor" && currentRole === "Regional Manager";

        // Direct Route: Supervisor → Stock Manager after stub collection
        const hasStub = history.some((e, i) => i < (index || 0) && e.transferType === "StubToSupervisor");
        const isDirect = prevRole === "Supervisor" && currentRole === "Stock Manager" && hasStub;

        return `${isSameRole ? "same-role" : ""} ${isReturn ? "return" : ""} ${isDirect ? "direct" : ""}`.trim();
    };

    if (loading) return <div className="loading">Tracking History...</div>;
    if (error || !book) return <div className="error">{error || "Receipt book not found."}</div>;

    return (
        <div className="history-container">
            <header className="history-header">
                <h1>Receipt Book #{book.number} History</h1>
                <button className="back-btn" onClick={() => navigate("/receipt-books")}>
                    <FaArrowLeft /> Back to Receipts
                </button>
            </header>
            <div className="history-footer">
                <p>Current Status: <span style={{ color: getStatusColor(book.status) }}>{book.status}</span></p>
                <p>Current Holder: {book.currentHolderID ? usersMap.get(book.currentHolderID) : book.agentID ? agentsMap.get(book.agentID) : "N/A"}</p>
            </div>
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

const getStatusColor = (status: string) => {
    switch (status) {
        case "In Stock": return "#4CAF50";
        case "Sent to Supplier": return "#2196F3";
        case "With Regional Manager": return "#FF9800";
        case "With Supervisor": return "#9C27B0";
        case "Assigned to Agent": return "#F44336";
        case "Stub Collected": return "#795548";
        case "With Stock Manager": return "#607D8B";
        case "Archived": return "#000000";
        case "ToSupplier": return "#2196F3";
        case "ToRegionalManager": return "#FF9800";
        case "ToSupervisor": return "#9C27B0";
        case "ToAgent": return "#F44336";
        case "StubToSupervisor": return "#795548";
        case "ToStockManager": return "#607D8B";
        case "ToRegionalManagerFromSupervisor": return "#FF9800";
        default: return "#757575";
    }
};

export default ReceiptBookHistory;