import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAllReceiptBooks } from '../../apis/receiptBookAPI';
import ReceiptBook from '../../models/ReceiptBook';
import ReceiptBookStatus from '../../models/Enum/ReceiptBookStatus';

interface Inventory {
    inStock: number;
    distributed: number;
}

const InventoryLevelsWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [inventory, setInventory] = useState<Inventory>({ inStock: 0, distributed: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_STOCK
    );

    useEffect(() => {
        const fetchInventory = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                const response = await getAllReceiptBooks(1, 1000, 'number', 'ASC', '', 'all', 'all');
                const inStock = response.receiptBooks.filter((b: ReceiptBook) => b.status === ReceiptBookStatus.InStock).length;
                const distributed = response.receiptBooks.filter((b: ReceiptBook) => b.status === ReceiptBookStatus.AssignedToAgent).length;
                setInventory({ inStock, distributed });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch inventory';
                setError(errorMessage);
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
            <h2 className="text-xl font-bold mb-4">Inventory Levels</h2>
            <p className="text-gray-700 mb-2">In Stock: {inventory.inStock}</p>
            <p className="text-gray-700">Distributed: {inventory.distributed}</p>
        </div>
    );
};

export default InventoryLevelsWidget;