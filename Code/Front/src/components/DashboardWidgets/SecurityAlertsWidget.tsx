import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { detectAnomalies } from '../../apis/aiAPI';
import { Anomaly } from '../../models/AI';

const SecurityAlertsWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [alerts, setAlerts] = useState<Anomaly[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_SECURITY_ALERTS
    );

    useEffect(() => {
        const fetchAlerts = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                // Example data for anomaly detection; adjust based on actual requirements
                const response = await detectAnomalies({
                    dataType: 'timesheet',
                    data: [], // Empty data for demo; real app should provide relevant data
                });
                setAlerts(response.anomalies || []);
            } catch (err) {
                setError('Failed to fetch security alerts');
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
            <h2 className="text-xl font-bold mb-4">Security Alerts</h2>
            {alerts.length === 0 ? (
                <p className="text-gray-600">No security alerts.</p>
            ) : (
                <ul className="list-disc pl-5">
                    {alerts.map((alert) => (
                        <li key={alert.id} className="mb-2">
                            {alert.description} (Confidence: {alert.confidence})
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default SecurityAlertsWidget;