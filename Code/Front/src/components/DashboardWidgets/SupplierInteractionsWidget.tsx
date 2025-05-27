import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getReceiptBooksByHolder, getTransferHistory } from '../../apis/receiptBookAPI';
import ReceiptBookTransferType from '../../models/Enum/ReceiptBookTransferType';

interface Delivery {
    transferID: string;
    bookID: string;
    status: string;
    transferDate: string;
}

const SupplierInteractionsWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_MANAGE_SUPPLIERS
    );

    useEffect(() => {
        const fetchDeliveries = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                const books = await getReceiptBooksByHolder(user.userID, 'user');
                const supplierDeliveries: Delivery[] = [];

                for (const book of books) {
                    const transfers = await getTransferHistory(book.bookID);
                    const supplierTransfers = transfers
                        .filter((t) => t.transferType === ReceiptBookTransferType.FromSupplier)
                        .map((t) => ({
                            transferID: t.transferID,
                            bookID: t.bookID,
                            status: t.status,
                            transferDate: t.transferDate,
                        }));
                    supplierDeliveries.push(...supplierTransfers);
                }

                setDeliveries(
                    supplierDeliveries
                        .sort((a, b) => new Date(b.transferDate).getTime() - new Date(a.transferDate).getTime())
                        .slice(0, 5)
                );
            } catch (err) {
                setError('Failed to fetch supplier deliveries');
            } finally {
                setLoading(false);
            }
        };
        fetchDeliveries();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading deliveries...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Supplier Deliveries</h2>
            {deliveries.length === 0 ? (
                <p className="text-gray-600">No recent deliveries.</p>
            ) : (
                <ul className="list-disc pl-5">
                    {deliveries.map((delivery) => (
                        <li key={delivery.transferID} className="mb-2">
                            Book {delivery.bookID} - {delivery.status} on{' '}
                            {new Date(delivery.transferDate).toLocaleString()}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default SupplierInteractionsWidget;