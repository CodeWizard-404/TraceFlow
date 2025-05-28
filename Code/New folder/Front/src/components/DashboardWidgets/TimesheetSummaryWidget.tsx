import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getTimesheetsBySupervisor } from '../../apis/timesheetAPI';
import Timesheet from '../../models/Timesheet';

interface TimesheetSummary {
    totalHours: number;
    pending: number;
}

const TimesheetSummaryWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [summary, setSummary] = useState<TimesheetSummary>({ totalHours: 0, pending: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_TIMESHEETS
    );

    useEffect(() => {
        const fetchSummary = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                const timesheets: Timesheet[] = await getTimesheetsBySupervisor(user.userID);
                const totalHours = timesheets.reduce((sum: number, ts: Timesheet) => {
                    const hours = (ts.Visits || []).reduce((visitSum: number, visit) => {
                        return visitSum + (visit.duration || 0) / 60; // Convert minutes to hours
                    }, 0);
                    return sum + hours;
                }, 0);
                const pending = timesheets.filter((ts: Timesheet) => ts.status === 'pending').length;
                setSummary({ totalHours, pending });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch timesheets';
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };
        fetchSummary();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading summary...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Timesheet Summary</h2>
            <p className="text-gray-700">Total Hours This Week: {summary.totalHours.toFixed(2)}</p>
            <p className="text-gray-700">Pending Validations: {summary.pending}</p>
        </div>
    );
};

export default TimesheetSummaryWidget;