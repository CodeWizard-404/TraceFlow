import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getLogStatistics, getUniqueValues } from '../../apis/logAPI';
import Permission from '../../models/Permission';
import { User } from '../../models/User';
import { getUsersByRole } from '../../apis/userAPI';

interface PlatformMetrics {
    activeUsers: number;
    featureUsage: { [key: string]: number };
}

const PlatformUsageWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [metrics, setMetrics] = useState<PlatformMetrics>({
        activeUsers: 0,
        featureUsage: {},
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p: Permission) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_USAGE_METRICS
    );

    useEffect(() => {
        const fetchMetrics = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // Fetch log statistics for the last 30 days
                const response = await getLogStatistics({ startDate: '2025-04-27', endDate: '2025-05-27' });
                const isSupervisor = user.Roles?.some((role) => role.name.includes('Supervisor')) ?? false;

                // Calculate active users (distinct user IDs)
                const uniqueUserIds = await fetchUniqueUsers(user, isSupervisor);
                const activeUsers = uniqueUserIds.length;

                // Process feature usage from routes
                let featureUsage = response.byRoute.reduce((acc, { route, count }) => {
                    const featureName = route.split('/').pop() || route;
                    acc[featureName] = count;
                    return acc;
                }, {} as { [key: string]: number });

                // Filter for supervisors to show only their team's usage
                if (isSupervisor) {
                    featureUsage = await filterSupervisorFeatures(user, featureUsage);
                }

                setMetrics({ activeUsers, featureUsage });
            } catch (err) {
                setError('Failed to fetch usage metrics');
            } finally {
                setLoading(false);
            }
        };

        fetchMetrics();
    }, [user, hasPermission]);

    // Helper to fetch unique user IDs, filtered for supervisors
    const fetchUniqueUsers = async (user: User, isSupervisor: boolean): Promise<string[]> => {
        if (isSupervisor) {
            const subordinates = await getSubordinateUsers(user.userID);
            const logs = await getLogStatistics({ startDate: '2025-04-27', endDate: '2025-05-27' });
            const userIds = new Set(logs.byRoute.flatMap(r => r.route.includes('userId') ? [r.route.split('/').pop() || ''] : []));
            return Array.from(userIds).filter(id => subordinates.includes(id));
        }
        const uniqueUsers = await getUniqueValues('userId');
        return uniqueUsers;
    };

    // Helper to filter feature usage for supervisors
    const filterSupervisorFeatures = async (user: User, usage: { [key: string]: number }) => {
        const subordinates = await getSubordinateUsers(user.userID);
        const logs = await getLogStatistics({ startDate: '2025-04-27', endDate: '2025-05-27' });
        return Object.entries(usage).reduce((acc, [feature]) => {
            const featureLogs = logs.byRoute.filter(r => r.route.includes(feature) && subordinates.some(id => r.route.includes(id)));
            if (featureLogs.length) {
                acc[feature] = featureLogs.reduce((sum, log) => sum + log.count, 0);
            }
            return acc;
        }, {} as { [key: string]: number });
    };

    // Helper to get subordinate users for a supervisor
    const getSubordinateUsers = async (supervisorID: string): Promise<string[]> => {
        const response = await getUsersByRole('Agent');
        return response.filter(u => u.supervisors?.some(s => s.userID === supervisorID)).map(u => u.userID);
    };

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading metrics...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Platform Usage</h2>
            <div className="space-y-2">
                <p className="text-gray-800">
                    Active Users: <span className="font-semibold">{metrics.activeUsers}</span>
                </p>
                <div>
                    <p className="text-gray-800 font-medium">Feature Usage:</p>
                    {Object.keys(metrics.featureUsage).length === 0 ? (
                        <p className="text-gray-600">No feature usage data available.</p>
                    ) : (
                        <ul className="list-disc pl-5 space-y-1">
                            {Object.entries(metrics.featureUsage)
                                .slice(0, 5)
                                .map(([feature, count]) => (
                                    <li key={feature} className="text-gray-700">
                                        {feature}: <span className="font-semibold">{count} uses</span>
                                    </li>
                                ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PlatformUsageWidget;