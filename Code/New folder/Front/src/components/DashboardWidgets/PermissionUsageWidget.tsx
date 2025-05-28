import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getLogStatistics } from '../../apis/logAPI';

interface PermissionUsage {
    permissionID: string;
    name: string;
    count: number;
}

const PermissionUsageWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [usage, setUsage] = useState<PermissionUsage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_PERMISSIONS
    );

    useEffect(() => {
        const fetchUsage = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // Fetch log statistics to infer permission usage
                const response = await getLogStatistics({ startDate: '2025-01-01' });
                const isSupervisor = user.Roles?.some((role) => role.name.includes('Supervisor'));

                // Map log routes to permissions (simplified mapping)
                const permissionMap: { [route: string]: { id: string; name: string } } = {
                    '/timesheets': { id: 'perm_timesheet_read', name: 'Read Timesheets' },
                    '/receipt-books': { id: 'perm_receipt_read', name: 'Read Receipt Books' },
                    '/users': { id: 'perm_user_read', name: 'Read Users' },
                    '/permissions': { id: 'perm_permission_read', name: 'Read Permissions' },
                    '/roles': { id: 'perm_role_read', name: 'Read Roles' },
                };

                // Process log statistics by route
                let usageData = response.byRoute
                    .filter((r) => permissionMap[r.route])
                    .map((r) => ({
                        permissionID: permissionMap[r.route].id,
                        name: permissionMap[r.route].name,
                        count: r.count,
                    }));

                // Filter for supervisors to show only their team's permissions
                if (isSupervisor) {
                    const supervisorPermissions = effectivePermissions?.map((p) => p.name) || [];
                    usageData = usageData.filter((u) => supervisorPermissions.includes(u.name));
                }

                // Sort by count (descending) and take top 5
                usageData = usageData.sort((a, b) => b.count - a.count).slice(0, 5);

                setUsage(usageData);
            } catch (err) {
                setError('Failed to fetch permission usage');
            } finally {
                setLoading(false);
            }
        };

        fetchUsage();
    }, [user, hasPermission, effectivePermissions]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading usage...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Permission Usage</h2>
            {usage.length === 0 ? (
                <p className="text-gray-600">No usage data available.</p>
            ) : (
                <ul className="space-y-2">
                    {usage.map((perm) => (
                        <li
                            key={perm.permissionID}
                            className="flex justify-between items-center p-2 bg-gray-100 rounded-lg"
                        >
                            <span className="text-gray-800">{perm.name}</span>
                            <span className="font-semibold text-gray-900">{perm.count} uses</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default PermissionUsageWidget;