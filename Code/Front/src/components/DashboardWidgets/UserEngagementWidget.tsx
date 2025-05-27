import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAllUsers } from '../../apis/userAPI';
import { getLogs } from '../../apis/logAPI';
import User from '../../models/User';

interface EngagementStats {
    loginFrequency: number;
}

const UserEngagementWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [stats, setStats] = useState<EngagementStats>({ loginFrequency: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_USERS
    );

    useEffect(() => {
        const fetchStats = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                const users: User[] = await getAllUsers();
                const logs = await getLogs({ route: '/auth/login', method: 'POST', status: 200 });
                const loginFrequency = logs.data.length / (users.length || 1);
                setStats({ loginFrequency });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch engagement stats';
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading engagement...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">User Engagement</h2>
            <p className="text-gray-700">Average Logins per User: {stats.loginFrequency.toFixed(2)}</p>
        </div>
    );
};

export default UserEngagementWidget;