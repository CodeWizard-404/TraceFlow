import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getReceiptBooksByHolder, getTransferHistory } from '../../apis/receiptBookAPI';
import ReceiptBookTransfer from '../../models/ReceiptBookTransfer';

const StubHistoryWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [history, setHistory] = useState<ReceiptBookTransfer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_STUBS
    );

    useEffect(() => {
        const fetchHistory = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                const books = await getReceiptBooksByHolder(user.userID, 'user');
                const transfers: ReceiptBookTransfer[] = [];

                for (const book of books) {
                    if (book.ReceiptStub) {
                        const response = await getTransferHistory(book.bookID);
                        transfers.push(...response);
                    }
                }

                setHistory(transfers.slice(0, 5).sort((a, b) =>
                    new Date(b.transferDate).getTime() - new Date(a.transferDate).getTime()
                ));
            } catch (err) {
                setError('Failed to fetch stub history');
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading history...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Stub History</h2>
            {history.length === 0 ? (
                <p className="text-gray-600">No history available.</p>
            ) : (
                <ul className="list-disc pl-5">
                    {history.map((entry) => (
                        <li key={entry.transferID} className="mb-2">
                            Book {entry.bookID} - {entry.transferType} on{' '}
                            {new Date(entry.transferDate).toLocaleString()}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default StubHistoryWidget;