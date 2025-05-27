import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getReceiptBooksByHolder } from '../../apis/receiptBookAPI';
import ReceiptStubStatus from '../../models/Enum/ReceiptStubStatus';

const StubCollectionOverviewWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [overview, setOverview] = useState<{ total: number; collected: number }>({ total: 0, collected: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_COLLECT_STUBS
    );

    useEffect(() => {
        const fetchOverview = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                const response = await getReceiptBooksByHolder(user.userID, 'user');
                let total = 0;
                let collected = 0;

                response.forEach((book) => {
                    if (book.ReceiptStub) {
                        total += 1;
                        if (book.ReceiptStub.status === ReceiptStubStatus.collected) {
                            collected += 1;
                        }
                    }
                });

                setOverview({ total, collected });
            } catch (err) {
                setError('Failed to fetch stub overview');
            } finally {
                setLoading(false);
            }
        };
        fetchOverview();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading overview...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Stub Collection Overview</h2>
            <p className="text-gray-700">Total Stubs: {overview.total}</p>
            <p className="text-gray-700">Collected: {overview.collected}</p>
        </div>
    );
};

export default StubCollectionOverviewWidget;