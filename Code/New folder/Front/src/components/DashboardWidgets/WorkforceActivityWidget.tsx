import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAllTimesheets } from '../../apis/timesheetAPI';
import Timesheet from '../../models/Timesheet';

interface ActivityStats {
    totalHours: number;
    overtime: number;
}

const WorkforceActivityWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [stats, setStats] = useState<ActivityStats>({ totalHours: 0, overtime: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p: { name: string }) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_TIMESHEETS
    );

    useEffect(() => {
        const fetchStats = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                const response = await getAllTimesheets();
                const timesheets: Timesheet[] = Array.isArray(response) ? response : response || [];
                const totalHours = timesheets.reduce((sum: number, ts: Timesheet) => {
                    const hours = ts.Visits?.reduce((visitSum: number, visit: { duration?: number | null }) =>
                        visitSum + (visit.duration || 0), 0) || 0;
                    return sum + hours;
                }, 0);
                const overtime = timesheets.reduce((sum: number, ts: Timesheet) => {
                    const otHours = ts.Visits?.reduce((visitSum: number, visit: { duration?: number | null }) => {
                        const hours = visit.duration || 0;
                        return visitSum + (hours > 8 ? hours - 8 : 0); // Assuming >8 hours/visit is overtime
                    }, 0) || 0;
                    return sum + otHours;
                }, 0);
                setStats({ totalHours, overtime });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch workforce stats';
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
            <h2 className="text-xl font-bold mb-4">Workforce Activity</h2>
            <p className="text-gray-700">Total Hours: {stats.totalHours.toFixed(2)}</p>
            <p className="text-gray-700">Overtime Hours: {stats.overtime.toFixed(2)}</p>
        </div>
    );
};

export default WorkforceActivityWidget;