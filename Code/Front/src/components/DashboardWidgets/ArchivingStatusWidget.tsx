import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { archiveStub } from '../../apis/receiptStubAPI';
import ReceiptStub from 'models/ReceiptStub';

const ArchivingStatusWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [status, setStatus] = useState({ processed: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_MANAGE_STUBS
    );

    useEffect(() => {
        const fetchStatus = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                // Replace with actual bookIDs source (e.g., from context, props, or another API call)
                const bookIDs: string[] = []; // Placeholder: Replace with actual book IDs
                const response = await archiveStub(bookIDs);
                if (Array.isArray(response)) {
                    setStatus({
                        processed: response.filter((s: ReceiptStub) => s.status === 'archived').length || 0,
                        total: response.length || 0,
                    });
                } else if (response) {
                    setStatus({
                        processed: response.status === 'archived' ? 1 : 0,
                        total: 1,
                    });
                } else {
                    setStatus({
                        processed: 0,
                        total: 0,
                    });
                }
            } catch (err) {
                setError('Failed to fetch archiving status');
            } finally {
                setLoading(false);
            }
        };
        fetchStatus();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div>Loading status...</div>;
    if (error) return <div>{error}</div>;

    return (
        <div className="widget-content">
            <h2>Archiving Status</h2>
            <p>Archived: {status.processed} of {status.total}</p>
            {status.total > 0 && (
                <div style={{ background: '#ddd', height: '20px', borderRadius: '5px' }}>
                    <div
                        style={{
                            width: `${(status.processed / status.total) * 100}%`,
                            background: '#4bc0c0',
                            height: '100%',
                            borderRadius: '5px',
                        }}
                    ></div>
                </div>
            )}
        </div>
    );
};

export default ArchivingStatusWidget;