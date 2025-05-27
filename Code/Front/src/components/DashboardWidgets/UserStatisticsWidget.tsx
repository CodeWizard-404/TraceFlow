import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAllUsers } from '../../apis/userAPI';
import User from '../../models/User';

interface UserStats {
    newUsers: number;
    activeUsers: number;
}

const UserStatisticsWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [stats, setStats] = useState<UserStats>({ newUsers: 0, activeUsers: 0 });
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
                const newUsers = users.filter((u: User) =>
                    u.createdAt && new Date(u.createdAt).getTime() > Date.now() - 7 * 24 * 3600 * 1000
                ).length;
                const activeUsers = users.filter((u: User) => u.isOnline === true).length; // Using isOnline instead of isActive
                setStats({ newUsers, activeUsers });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user statistics';
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading stats...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">User Statistics</h2>
            <p className="text-gray-700">New Users (Last Week): {stats.newUsers}</p>
            <p className="text-gray-700">Active Users: {stats.activeUsers}</p>
        </div>
    );
};

export default UserStatisticsWidget;