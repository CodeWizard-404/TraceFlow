import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { testAIConfig } from '../../apis/aiAPI';

interface PerformanceData {
    accuracy?: number;
    requests?: number;
}

const AIModulePerformanceWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [performance, setPerformance] = useState<PerformanceData>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_AI_PERFORMANCE
    );

    useEffect(() => {
        const fetchPerformance = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                // Hardcoded configID for demonstration; ideally, fetch from user context or input
                const configID = 'default-config-id'; // Replace with actual configID or make dynamic
                const response = await testAIConfig(configID);
                setPerformance({
                    accuracy: response.response.accuracy || 0,
                    requests: response.response.requests || 0,
                });
            } catch (err) {
                setError('Failed to fetch AI performance');
            } finally {
                setLoading(false);
            }
        };
        fetchPerformance();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading AI performance...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">AI Module Performance</h2>
            <p>Accuracy: {performance.accuracy !== undefined ? `${performance.accuracy}%` : 'N/A'}</p>
            <p>Processed Requests: {performance.requests || 0}</p>
        </div>
    );
};

export default AIModulePerformanceWidget;