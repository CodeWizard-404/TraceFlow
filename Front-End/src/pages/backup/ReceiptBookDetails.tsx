import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaHistory, FaTruck, FaExchangeAlt, FaArchive } from "react-icons/fa";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../../context/AuthContext";
import { getReceiptBookById, getTransferHistory } from "../../apis/receiptBookAPI";
import ReceiptBook from "../../models/ReceiptBook";
import ReceiptBookTransfer from "../../models/ReceiptBookTransfer";
import "./ReceiptBookDetails.css";

const ReceiptBookDetails: React.FC = () => {
    const { bookID } = useParams<{ bookID: string }>();
    const { token, userRoles, effectivePermissions } = useAuth();
    const navigate = useNavigate();
    const [book, setBook] = useState<ReceiptBook | null>(null);
    const [history, setHistory] = useState<ReceiptBookTransfer[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDetails = async () => {
            if (!bookID || !token || !effectivePermissions?.some((p) => p.name === "access_receipt_book_details")) {
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
            } catch (err) {
                setError("Failed to load receipt book details.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [bookID, token, effectivePermissions]);

    const userRole = userRoles?.[0]?.name || "";
    const canTransfer = effectivePermissions?.some((p) => p.name === "transfer_receipt_books") &&
        ["Purchase Team", "Regional Manager", "Supervisor"].includes(userRole) &&
        ["In Stock", "With Regional Manager", "With Supervisor", "Stub Collected"].includes(book?.status || "");
    const canCollectStub = effectivePermissions?.some((p) => p.name === "collect_receipt_stubs") &&
        userRole === "Supervisor" && book?.status === "Assigned to Agent";
    const canArchive = effectivePermissions?.some((p) => p.name === "archive_receipt_stubs") &&
        userRole === "Stock Manager" && book?.status === "With Stock Manager";

    if (loading) return <div className="loading">Loading...</div>;
    if (error || !book) return <div className="error">{error || "Receipt book not found."}</div>;

    return (
        <div className="receipt-book-details-container">
            <div className="details-hero">
                <h1>
                    {book.number} - {book.type}
                    <span className={`status-dot status-${book.status.toLowerCase().replace(/\s/g, "-")}`}></span>
                    <span>{book.status}</span>
                </h1>
            </div>
            <div className="details-grid">
                <div className="details-card">
                    <h2>Details</h2>
                    <p><strong>ID:</strong> {book.bookID}</p>
                    <p><strong>Holder:</strong> {book.currentHolderID || book.agentID || "N/A"}</p>
                    <div className="qr-code">
                        <QRCodeSVG value={book.qrCode} size={150} />
                    </div>
                </div>
                <div className="details-card">
                    <h2><FaHistory /> Transfer History</h2>
                    {history.length > 0 ? (
                        <ul>
                            {history.map((transfer, index) => (
                                <li key={index}>
                                    {transfer.fromUserID || transfer.toAgentID} → {transfer.toUserID || transfer.toAgentID} ({transfer.transferType}) on {new Date(transfer.transferDate).toLocaleString()}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>No transfer history available.</p>
                    )}
                </div>
            </div>
            <div className="details-actions">
                {canTransfer && (
                    <button onClick={() => navigate(`/receipt-book/${bookID}/transfer`)}>
                        <FaExchangeAlt /> Transfer
                    </button>
                )}
                {canCollectStub && (
                    <button onClick={() => navigate(`/receipt-book/${bookID}/stub-collection`)}>
                        <FaTruck /> Collect Stub
                    </button>
                )}
                {canArchive && (
                    <button onClick={() => navigate(`/receipt-book/${bookID}/archive`)}>
                        <FaArchive /> Archive
                    </button>
                )}
                <button onClick={() => navigate("/receipt-books")}>
                    <FaArrowLeft /> Back
                </button>
            </div>
        </div>
    );
};

export default ReceiptBookDetails;