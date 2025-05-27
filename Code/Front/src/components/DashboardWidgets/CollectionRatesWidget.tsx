import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { collectStub } from '../../apis/receiptStubAPI';

const CollectionRatesWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [rates, setRates] = useState({ collected: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_COLLECT_STUBS
    );

    useEffect(() => {
        const fetchRates = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                // Note: collectStub expects bookIDs, not userID. Using empty array as placeholder.
                // This widget may need a different API to fetch collection rates (e.g., getCollectionRates).
                await collectStub([]);
                // Since CollectStubResponse is { message: string }, use default rates
                setRates({ collected: 0, total: 0 });
            } catch (err) {
                setError('Failed to fetch collection rates');
            } finally {
                setLoading(false);
            }
        };
        fetchRates();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading rates...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    const percentage = rates.total > 0 ? (rates.collected / rates.total) * 100 : 0;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Collection Rates</h2>
            <p className="text-gray-700">Collected: {rates.collected} of {rates.total}</p>
            <div className="bg-gray-200 h-5 rounded">
                <div className="bg-teal-500 h-full rounded" style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

export default CollectionRatesWidget;