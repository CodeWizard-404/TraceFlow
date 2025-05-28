import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bar } from 'react-chartjs-2';
import { getSupervisorsByRegionalManager } from '../../apis/userAPI';
import { getTimesheetsBySupervisor } from '../../apis/timesheetAPI';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const SupervisorPerformanceWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [chartData, setChartData] = useState<any>(null);
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
                const supervisors = await getSupervisorsByRegionalManager(user.userID);
                const performanceData = await Promise.all(
                    supervisors.map(async (supervisor) => {
                        const timesheets = await getTimesheetsBySupervisor(supervisor.userID);
                        const completedVisits = timesheets
                            .flatMap((ts) => ts.Visits || [])
                            .filter((v) => v.status === 'validated').length;
                        return { name: `${supervisor.firstname} ${supervisor.lastname}`, visits: completedVisits };
                    })
                );
                setChartData({
                    labels: performanceData.map((d) => d.name),
                    datasets: [{
                        label: 'Completed Visits',
                        data: performanceData.map((d) => d.visits),
                        backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    }],
                });
            } catch (err) {
                setError('Failed to fetch performance data');
            } finally {
                setLoading(false);
            }
        };
        fetchPerformance();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div>Loading performance...</div>;
    if (error) return <div>{error}</div>;

    return (
        <div className="widget-content">
            <h2>Supervisor Performance</h2>
            <Bar data={chartData} options={{ responsive: true }} />
        </div>
    );
};

export default SupervisorPerformanceWidget;