import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaSearch } from "react-icons/fa";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../../context/AuthContext";
import { getAllReceiptBooks } from "../../apis/receiptBookAPI";
import ReceiptBook from "../../models/ReceiptBook";
import "./ArchivedReceiptBooks.css";

const ArchivedReceiptBooks: React.FC = () => {
    const { token, effectivePermissions, permissionsLoaded } = useAuth();
    const navigate = useNavigate();
    const [books, setBooks] = useState<ReceiptBook[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [search, setSearch] = useState<string>("");

    useEffect(() => {
        const fetchBooks = async () => {
            if (!token || !permissionsLoaded || !effectivePermissions?.some((p) => p.name === "archive_receipt_stubs")) {
                setLoading(false);
                return;
            }
            try {
                const data = await getAllReceiptBooks(token);
                const archivedBooks = data.filter((book) => book.status === "Archived");
                setBooks(archivedBooks);
            } catch (err) {
                console.error("Failed to fetch receipt books:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchBooks();
    }, [token, permissionsLoaded, effectivePermissions]);

    const filteredBooks = books.filter((book) =>
        book.number.toLowerCase().includes(search.toLowerCase()) ||
        book.bookID.toLowerCase().includes(search.toLowerCase())
    );

    if (!permissionsLoaded) return <div>Loading permissions...</div>;
    if (!effectivePermissions?.some((p) => p.name === "archive_receipt_stubs")) {
        return <div>Access Denied: You lack permission to view archived receipt books.</div>;
    }

    return (
        <div className="archived-receipt-books-container">
            <header className="archived-header">
                <h1>Archived Receipt Books</h1>
                <div className="header-actions">
                    <div className="search-bar">
                        <FaSearch />
                        <input
                            type="text"
                            placeholder="Search by ID or Number..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button onClick={() => navigate("/receipt-books")}>
                        <FaArrowLeft /> Back to Active Books
                    </button>
                </div>
            </header>
            {loading ? (
                <div className="loading">Loading...</div>
            ) : (
                <div className="books-list">
                    {filteredBooks.length > 0 ? (
                        filteredBooks.map((book) => (
                            <div
                                key={book.bookID}
                                className="book-card"
                                onClick={() => navigate(`/receipt-book/${book.bookID}`)}
                            >
                                <div className="book-info">
                                    <p>
                                        <strong>{book.number}</strong> - {book.type}
                                    </p>
                                    <p>Last Holder: {book.currentHolderID || "N/A"}</p>
                                </div>
                                <div className="qr-preview">
                                    <QRCodeSVG value={book.qrCode} size={50} />
                                </div>
                                <span className="status-dot status-archived"></span>
                                <p className="status-text">{book.status}</p>
                            </div>
                        ))
                    ) : (
                        <div className="no-books">No archived receipt books found.</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ArchivedReceiptBooks;