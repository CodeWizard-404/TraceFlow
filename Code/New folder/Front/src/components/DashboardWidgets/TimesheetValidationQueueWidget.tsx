import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getTimesheetsBySupervisor } from '../../apis/timesheetAPI';
import Timesheet from '../../models/Timesheet';

const TimesheetValidationQueueWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [queue, setQueue] = useState<Timesheet[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_VALIDATE_TIMESHEETS
    );

    useEffect(() => {
        const fetchQueue = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                const timesheets: Timesheet[] = await getTimesheetsBySupervisor(user.userID);
                const pending = timesheets.filter((ts: Timesheet) => ts.status === 'pending');
                setQueue(pending);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch validation queue';
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };
        fetchQueue();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading queue...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Timesheet Validation Queue</h2>
            {queue.length === 0 ? (
                <p className="text-gray-600">No timesheets pending validation.</p>
            ) : (
                <ul className="list-disc pl-5">
                    {queue.map((ts) => {
                        const totalHours = (ts.Visits || []).reduce((sum: number, visit) => {
                            return sum + (visit.duration || 0) / 60; // Convert minutes to hours
                        }, 0);
                        return (
                            <li key={ts.timesheetID} className="mb-2">
                                Timesheet {ts.timesheetID} ({totalHours.toFixed(2)} hours, Week {ts.weekNumber}, {ts.year})
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default TimesheetValidationQueueWidget;