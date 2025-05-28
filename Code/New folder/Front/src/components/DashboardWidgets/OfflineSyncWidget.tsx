import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const OfflineSyncWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [syncStatus, setSyncStatus] = useState<{ pending: number }>({ pending: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_OFFLINE_DATA
    );

    useEffect(() => {
        const checkSync = () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                const pendingItems = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
                setSyncStatus({ pending: pendingItems.length });
            } catch (err) {
                setError('Failed to check sync status');
            } finally {
                setLoading(false);
            }
        };
        checkSync();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div>Loading sync status...</div>;
    if (error) return <div>{error}</div>;

    return (
        <div className="widget-content">
            <h2>Offline Sync Status</h2>
            <p>Pending Sync Items: {syncStatus.pending}</p>
            {syncStatus.pending > 0 && <button>Sync Now</button>}
        </div>
    );
};

export default OfflineSyncWidget;