import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { detectAnomalies } from '../../apis/aiAPI';

interface Alert {
    id: string;
    description: string;
    confidence: number;
    type: string;
}

const AlertsSummaryWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_ALERTS
    );

    useEffect(() => {
        const fetchAlerts = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                // Note: getSecurityAlerts not available; using detectAnomalies only.
                // Replace with correct securityAPI call when available.
                const anomalies = await detectAnomalies({ dataType: 'receipt', data: [] });
                setAlerts(
                    anomalies.anomalies.map((a) => ({ ...a, type: 'Anomaly' })).slice(0, 5)
                );
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch alerts';
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };
        fetchAlerts();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading alerts...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Alerts Summary</h2>
            {alerts.length === 0 ? (
                <p className="text-gray-600">No critical alerts.</p>
            ) : (
                <ul className="list-disc pl-5">
                    {alerts.map((alert) => (
                        <li key={alert.id} className="mb-2">
                            {alert.type}: {alert.description} (Confidence: {alert.confidence})
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default AlertsSummaryWidget;