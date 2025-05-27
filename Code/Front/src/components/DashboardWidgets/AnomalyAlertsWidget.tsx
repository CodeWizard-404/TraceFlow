import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { detectAnomalies } from '../../apis/aiAPI';
import { Anomaly } from '../../models/AI';

const AnomalyAlertsWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_AI_ANOMALIES
    );

    useEffect(() => {
        const fetchAnomalies = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                const response = await detectAnomalies({ dataType: 'receipt', data: [] });
                setAnomalies(response.anomalies || []);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch anomalies';
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };
        fetchAnomalies();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading anomalies...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Anomaly Alerts</h2>
            {anomalies.length === 0 ? (
                <p className="text-gray-600">No anomalies detected.</p>
            ) : (
                <ul className="list-disc pl-5">
                    {anomalies.map((anomaly) => (
                        <li key={anomaly.id} className="mb-2">
                            {anomaly.description} (Confidence: {anomaly.confidence})
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default AnomalyAlertsWidget;