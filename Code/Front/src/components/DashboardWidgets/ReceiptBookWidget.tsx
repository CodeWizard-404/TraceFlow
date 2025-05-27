import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getReceiptBooksByHolder } from '../../apis/receiptBookAPI';
import ReceiptBook from '../../models/ReceiptBook';

const ReceiptBookWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [books, setBooks] = useState<ReceiptBook[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_RECEIPT_BOOKS
    );

    useEffect(() => {
        const fetchBooks = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                // Assume userType is 'user' or 'agent' based on role; adjust as needed
                const userType = user.Roles?.some(role => role.name.includes('Agent')) ? 'agent' : 'user';
                const response = await getReceiptBooksByHolder(user.userID, userType);
                setBooks(response || []);
            } catch (err) {
                setError('Failed to fetch receipt books');
            } finally {
                setLoading(false);
            }
        };
        fetchBooks();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading receipt books...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Assigned Receipt Books</h2>
            {books.length === 0 ? (
                <p className="text-gray-600">No receipt books assigned.</p>
            ) : (
                <ul className="list-disc pl-5">
                    {books.map((book) => (
                        <li key={book.bookID} className="mb-2">
                            {book.number} ({book.status})
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default ReceiptBookWidget;