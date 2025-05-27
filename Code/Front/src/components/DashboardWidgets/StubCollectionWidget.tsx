import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getReceiptBooksByHolder } from '../../apis/receiptBookAPI';
import ReceiptStubStatus from '../../models/Enum/ReceiptStubStatus';

interface StubStats {
    collected: number;
    pending: number;
}

const StubCollectionWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [stats, setStats] = useState<StubStats>({ collected: 0, pending: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_COLLECT_STUBS
    );

    useEffect(() => {
        const fetchStats = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                const response = await getReceiptBooksByHolder(user.userID, 'user');
                let collected = 0;
                let pending = 0;

                response.forEach((book) => {
                    if (book.ReceiptStub) {
                        if (book.ReceiptStub.status === ReceiptStubStatus.collected) {
                            collected += 1;
                        } else {
                            pending += 1;
                        }
                    }
                });

                setStats({ collected, pending });
            } catch (err) {
                setError('Failed to fetch stub stats');
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading stub stats...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Stub Collection</h2>
            <p className="text-gray-700">Collected: {stats.collected}</p>
            <p className="text-gray-700">Pending: {stats.pending}</p>
        </div>
    );
};

export default StubCollectionWidget;