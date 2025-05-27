import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSupervisorsByRegionalManager } from '../../apis/userAPI';
import { getTimesheetsBySupervisor } from '../../apis/timesheetAPI';
import User from '../../models/User';
import Timesheet from '../../models/Timesheet';

interface PerformanceData {
    supervisorID: string;
    name: string;
    visits: number;
}

const TeamPerformanceWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [performance, setPerformance] = useState<PerformanceData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_SUPERVISORS
    );

    useEffect(() => {
        const fetchPerformance = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                const supervisors: User[] = await getSupervisorsByRegionalManager(user.userID);
                const performanceData = await Promise.all(
                    supervisors.map(async (supervisor: User) => {
                        const timesheets: Timesheet[] = await getTimesheetsBySupervisor(supervisor.userID);
                        const visits = timesheets.reduce((total, ts) => {
                            return total + (ts.Visits?.length || 0);
                        }, 0);
                        return {
                            supervisorID: supervisor.userID,
                            name: `${supervisor.firstname} ${supervisor.lastname}`,
                            visits,
                        };
                    })
                );
                setPerformance(performanceData);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch team performance';
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };
        fetchPerformance();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading performance...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Team Performance</h2>
            {performance.length === 0 ? (
                <p className="text-gray-600">No performance data available.</p>
            ) : (
                <ul className="list-disc pl-5">
                    {performance.map((data) => (
                        <li key={data.supervisorID} className="mb-2">
                            {data.name}: {data.visits} visits
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default TeamPerformanceWidget;