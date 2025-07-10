import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaHistory } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import {
  getReceiptBookById,
  getTransferHistory,
} from "../../apis/receiptBookAPI";
import { getUserById } from "../../apis/userAPI";
import { getAgentById } from "../../apis/agentAPI";
import ReceiptBook from "../../models/ReceiptBook";
import ReceiptBookTransfer from "../../models/ReceiptBookTransfer";
import "./ReceiptBookHistory.css";
import { useTranslation } from "react-i18next";

const PERMISSIONS = {
  ACCESS_RECEIPT_BOOK_HISTORY: import.meta.env
    .VITE_PERMISSIONS_ACCESS_RECEIPT_BOOK_HISTORY,
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
  Archived: "#000000",
  ToSupplier: "#2196F3",
  ToRegionalManager: "#FF9800",
  ToSupervisor: "#9C27B0",
  ToAgent: "#F44336",
  StubToSupervisor: "#795548",
  ToStockManager: "#607D8B",
  ToRegionalManagerFromSupervisor: "#FF9800",
} as const;

// Main Component
const ReceiptBookHistory: React.FC = () => {
  // Hooks
  const { bookID } = useParams<{ bookID: string }>();
  const navigate = useNavigate();
  const { effectivePermissions } = useAuth();
  const { t } = useTranslation();

  // State
  const [book, setBook] = useState<ReceiptBook | null>(null);
  const [history, setHistory] = useState<ReceiptBookTransfer[]>([]);
  const [usersMap, setUsersMap] = useState<Map<string, string>>(new Map());
  const [agentsMap, setAgentsMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Permission Checks
  const userPermissions = React.useMemo(
    () => ({
      canViewHistory: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.ACCESS_RECEIPT_BOOK_HISTORY
      ),
    }),
    [effectivePermissions]
  );

  // Fetch receipt book details and transfer history
  useEffect(() => {
    const fetchData = async () => {
      if (!bookID || !userPermissions.canViewHistory) {
        setError(t("receiptBookHistory.errors.accessDenied"));
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [bookData, historyData] = await Promise.all([
          getReceiptBookById(bookID),
          getTransferHistory(bookID),
        ]);
        setBook(bookData);
        setHistory(historyData);

        // Collect unique user and agent IDs from history
        const userIDs = new Set<string>();
        const agentIDs = new Set<string>();
        historyData.forEach((entry) => {
          if (entry.fromUserID) userIDs.add(entry.fromUserID);
          if (entry.toUserID) userIDs.add(entry.toUserID);
          if (entry.toAgentID) agentIDs.add(entry.toAgentID);
        });

        // Fetch user names
        const userPromises = Array.from(userIDs).map((id) => getUserById(id));
        const userResults = await Promise.all(userPromises);
        const newUsersMap = new Map<string, string>(
          userResults.map((user) => [
            user.userID,
            `${user.firstname} ${user.lastname}`,
          ])
        );
        setUsersMap(newUsersMap);

        // Fetch agent names if applicable
        if (agentIDs.size > 0) {
          const agentPromises = Array.from(agentIDs).map((id) =>
            getAgentById(id)
          );
          const agentResults = await Promise.all(agentPromises);
          const newAgentsMap = new Map<string, string>(
            agentResults.map((agent) => [
              agent!.agentID,
              `${agent!.name} ${agent!.lastname}`,
            ])
          );
          setAgentsMap(newAgentsMap);
        }
      } catch (err) {
        setError(t("receiptBookHistory.errors.fetchFailed"));
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [bookID, userPermissions.canViewHistory, t]);

  // Determine the role involved in a transfer
  const getRoleFromTransfer = (entry: ReceiptBookTransfer): string => {
    if (entry.toAgentID) return "Agent";
    if (entry.transferType.includes("Supplier")) return "Supplier";
    if (entry.transferType.includes("RegionalManager")) return "Regional Manager";
    if (entry.transferType.includes("Supervisor")) return "Supervisor";
    if (entry.transferType.includes("StockManager")) return "Stock Manager";
    if (entry.transferType.includes("Archive")) return "Archive";
    return t("receiptBookHistory.unknown");
  };

  // Assign CSS classes to timeline nodes based on transfer context
  const getNodeClass = (
    entry: ReceiptBookTransfer,
    prevEntry?: ReceiptBookTransfer,
    index?: number
  ): string => {
    const currentRole = getRoleFromTransfer(entry);
    const prevRole = prevEntry ? getRoleFromTransfer(prevEntry) : null;

    const isSameRole =
      prevRole &&
      currentRole === prevRole &&
      currentRole !== "Agent" &&
      currentRole !== "Supplier";
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
  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>{t("receiptBookHistory.loading")}</p>
      </div>
    );
  }
  if (error || !book)
    return (
      <div className="error">
        {error || t("receiptBookHistory.errors.bookNotFound")}
      </div>
    );

  // Render
  return (
    <div className="history-container">
      {/* Header Section */}
      <header className="history-header">
        <h1>{t("receiptBookHistory.title", { number: book.number })}</h1>
        <button
          className="back-btn"
          onClick={() => navigate("/receipt-books")}
          aria-label={t("receiptBookHistory.actions.back")}
        >
          <FaArrowLeft /> {t("receiptBookHistory.actions.back")}
        </button>
      </header>

      {/* Footer Section with Current Status */}
      <div className="history-footer">
        <p>
          {t("receiptBookHistory.footer.currentStatus")}
          <span style={{ color: getStatusColor(book.status) }}>
            {book.status}
          </span>
        </p>
        <p>
          {t("receiptBookHistory.footer.currentHolder")}
          {book.currentHolderID
            ? usersMap.get(book.currentHolderID)
            : book.agentID
              ? agentsMap.get(book.agentID)
              : t("receiptBookHistory.na")}
        </p>
      </div>

      {/* Timeline Section */}
      <div className="timeline">
        <div className="timeline-path">
          {history.map((entry, index) => (
            <div
              key={entry.transferID}
              className={`timeline-node ${getNodeClass(
                entry,
                history[index - 1],
                index
              )}`}
            >
              <div
                className="node-marker"
                style={{ backgroundColor: getStatusColor(entry.transferType) }}
              >
                <FaHistory />
              </div>
              <div
                className={`node-details ${getNodeClass(
                  entry,
                  history[index - 1],
                  index
                )}`}
              >
                <h3>{entry.transferType.replace(/([A-Z])/g, " $1").trim()}</h3>
                <p>
                  <strong>{t("receiptBookHistory.timeline.from")}:</strong>{" "}
                  {entry.fromUserID
                    ? usersMap.get(entry.fromUserID)
                    : t("receiptBookHistory.initialStock")}
                </p>
                <p>
                  <strong>{t("receiptBookHistory.timeline.to")}:</strong>{" "}
                  {entry.toUserID
                    ? usersMap.get(entry.toUserID)
                    : entry.toAgentID
                      ? agentsMap.get(entry.toAgentID)
                      : t("receiptBookHistory.supplier")}
                </p>
                <p>
                  <strong>{t("receiptBookHistory.timeline.date")}:</strong>{" "}
                  {new Date(entry.transferDate).toLocaleString()}
                </p>
                <p>
                  <strong>{t("receiptBookHistory.timeline.status")}:</strong>{" "}
                  {entry.status}
                </p>
              </div>
              {index < history.length - 1 && (
                <div className="timeline-connector"></div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReceiptBookHistory;
