import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getLogs } from '../../apis/logAPI';
import { Log } from '../../models/log';

const RecentActivitiesWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [activities, setActivities] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_ACTIVITIES
    );

    useEffect(() => {
        const fetchActivities = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                const response = await getLogs({
                    userId: user.userID,
                    page: 1,
                    pageSize: 5,
                    sortBy: 'timestamp',
                    sortOrder: 'DESC',
                });
                setActivities(response.data || []);
            } catch (err) {
                setError('Failed to fetch activities');
            } finally {
                setLoading(false);
            }
        };
        fetchActivities();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading activities...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Recent Activities</h2>
            {activities.length === 0 ? (
                <p className="text-gray-600">No recent activities.</p>
            ) : (
                <ul className="list-disc pl-5">
                    {activities.map((activity) => (
                        <li key={activity.logID} className="mb-2">
                            {activity.message} at {new Date(activity.timestamp).toLocaleString()}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default RecentActivitiesWidget;