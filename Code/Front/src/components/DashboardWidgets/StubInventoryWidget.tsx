import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getReceiptBooksByHolder } from '../../apis/receiptBookAPI';
import ReceiptStubStatus from '../../models/Enum/ReceiptStubStatus';

interface StubInventory {
    total: number;
    archived: number;
}

const StubInventoryWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [inventory, setInventory] = useState<StubInventory>({ total: 0, archived: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_MANAGE_STUBS
    );

    useEffect(() => {
        const fetchInventory = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                const response = await getReceiptBooksByHolder(user.userID, 'user');
                let total = 0;
                let archived = 0;

                response.forEach((book) => {
                    if (book.ReceiptStub) {
                        total += 1;
                        if (book.ReceiptStub.status === ReceiptStubStatus.archived) {
                            archived += 1;
                        }
                    }
                });

                setInventory({ total, archived });
            } catch (err) {
                setError('Failed to fetch stub inventory');
            } finally {
                setLoading(false);
            }
        };
        fetchInventory();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading inventory...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Stub Inventory</h2>
            <p className="text-gray-700">Total Stubs: {inventory.total}</p>
            <p className="text-gray-700">Archived: {inventory.archived}</p>
        </div>
    );
};

export default StubInventoryWidget;