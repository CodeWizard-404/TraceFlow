import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { validateStubCollection } from '../../apis/receiptStubAPI';
import ReceiptStub from '../../models/ReceiptStub';

const ValidationQueueWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [queue, setQueue] = useState<ReceiptStub[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_VALIDATE_STUBS
    );

    useEffect(() => {
        const fetchQueue = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                // Note: validateStubCollection expects bookIDs, not userID. Using empty array as placeholder.
                // This widget may need a different API to fetch pending stubs for the user.
                const response = await validateStubCollection([], '');
                setQueue([response]); // Wrap single ReceiptStub in array for queue
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch validation queue';
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };
        fetchQueue();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading queue...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Stub Validation Queue</h2>
            {queue.length === 0 ? (
                <p className="text-gray-600">No stubs pending validation.</p>
            ) : (
                <ul className="list-disc pl-5">
                    {queue.map((stub) => (
                        <li key={stub.stubID} className="mb-2">
                            Stub {stub.stubID} - {stub.status}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default ValidationQueueWidget;