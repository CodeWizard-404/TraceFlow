import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAllReceiptBooks } from '../../apis/receiptBookAPI';

const ReceiptBookDistributionWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [distribution, setDistribution] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_RECEIPT_BOOKS
    );

    useEffect(() => {
        const fetchDistribution = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                const response = await getAllReceiptBooks();
                setDistribution(response.receiptBooks || []);
            } catch (err) {
                setError('Failed to fetch distribution data');
            } finally {
                setLoading(false);
            }
        };
        fetchDistribution();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div>Loading distribution...</div>;
    if (error) return <div>{error}</div>;

    return (
        <div className="widget-content">
            <h2>Receipt Book Distribution</h2>
            {distribution.length === 0 ? (
                <p>No receipt books distributed.</p>
            ) : (
                <ul>
                    {distribution.map((book) => (
                        <li key={book.bookID}>Book {book.bookNumber} - Holder: {book.holderID}</li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default ReceiptBookDistributionWidget;