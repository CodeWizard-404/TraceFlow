import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaSave } from "react-icons/fa";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../../context/AuthContext";
import { createReceiptBook } from "../../apis/receiptBookAPI";
import "./ReceiptBookForm.css";
import ReceiptBook from "../../models/ReceiptBook";

const ReceiptBookForm: React.FC = () => {
    const { token, userRoles, effectivePermissions } = useAuth();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ number: "", type: "Cash" })
    const [createdBook, setCreatedBook] = useState<ReceiptBook | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isPurchaseTeam = userRoles?.some((role) => role.name === "Purchase Team");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token || !effectivePermissions?.some((p) => p.name === "create_receipt_books")) {
            setError("Access Denied: Only Purchase Team can create receipt books.");
            return;
        }
        try {
            const book = await createReceiptBook(formData, token);
            setCreatedBook(book);
            setError(null);
        } catch (err) {
            setError("Failed to create receipt book.");
            console.error(err);
        }
    };

    return (
        <div className="receipt-book-form-container">
            <header className="form-header">
                <h1>Create Receipt Book</h1>
            </header>
            <div className="form-card">
                {!createdBook ? (
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="number">Number</label>
                            <input
                                id="number"
                                type="text"
                                value={formData.number}
                                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="type">Type</label>
                            <select
                                id="type"
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            >
                                <option value="Cash">Cash</option>
                                <option value="Credit">Credit</option>
                            </select>
                        </div>
                        {error && <div className="error">{error}</div>}
                        <div className="form-actions">
                            <button type="button" className="back-btn" onClick={() => navigate("/receipt-books")}>
                                <FaArrowLeft /> Back
                            </button>
                            <button type="submit" className="save-btn">
                                <FaSave /> Create
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="created-book">
                        <h2>Receipt Book Created</h2>
                        <p><strong>Number:</strong> {createdBook.number}</p>
                        <p><strong>Type:</strong> {createdBook.type}</p>
                        <div className="qr-code">
                            <QRCodeSVG value={createdBook.qrCode} size={150} />
                        </div>
                        <button className="back-btn" onClick={() => navigate("/receipt-books")}>
                            <FaArrowLeft /> Back to List
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReceiptBookForm;