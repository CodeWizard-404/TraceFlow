import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
// import { getReportSchedules } from '../../apis/reportAPI'; // Assumed endpoint, not available

interface ReportSchedule {
    scheduleID: string;
    reportType: string;
    frequency: string;
}

const AutomatedReportScheduleWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_MANAGE_REPORT_SCHEDULES
    );

    useEffect(() => {
        const fetchSchedules = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                // Note: getReportSchedules not available; using placeholder.
                // Replace with actual API call when reportAPI is provided.
                // const response = await getReportSchedules();
                // setSchedules(response.schedules || []);
                setSchedules([]); // Placeholder empty array
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch schedules';
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };
        fetchSchedules();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading schedules...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Automated Report Schedules</h2>
            {schedules.length === 0 ? (
                <p className="text-gray-600">No schedules set.</p>
            ) : (
                <ul className="list-disc pl-5">
                    {schedules.map((schedule) => (
                        <li key={schedule.scheduleID} className="mb-2">
                            {schedule.reportType} - {schedule.frequency}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default AutomatedReportScheduleWidget;