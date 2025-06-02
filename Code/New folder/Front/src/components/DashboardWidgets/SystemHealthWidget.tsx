import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getLoggerHealth } from '../../apis/logAPI';

interface SystemHealth {
    status: string;
    logLevel: string;
    transportCount: number;
}

const SystemHealthWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [health, setHealth] = useState<SystemHealth | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_SYSTEM_HEALTH
    );

    useEffect(() => {
        const fetchHealth = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                const response = await getLoggerHealth();
                setHealth({
                    status: response.status || 'Unknown',
                    logLevel: response.config.logLevel || 'Unknown',
                    transportCount: response.transports?.length || 0,
                });
            } catch (err) {
                setError('Failed to fetch system health');
            } finally {
                setLoading(false);
            }
        };
        fetchHealth();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading system health...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">System Health</h2>
            {health ? (
                <>
                    <p className="text-gray-700">Logger Status: {health.status}</p>
                    <p className="text-gray-700">Log Level: {health.logLevel}</p>
                    <p className="text-gray-700">Transports: {health.transportCount}</p>
                </>
            ) : (
                <p className="text-gray-600">No health data available.</p>
            )}
        </div>
    );
};

export default SystemHealthWidget;