import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAllTimesheets, getTimesheetsBySupervisor } from '../../apis/timesheetAPI';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import Timesheet from '../../models/Timesheet';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Define the structure of the bar chart data
interface BarChartData {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        backgroundColor: string;
    }[];
}

// Days of the week starting with Monday
const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const ActivityHeatmapWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [chartData, setChartData] = useState<BarChartData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Check permission to access timesheets
    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_TIMESHEETS
    );

    useEffect(() => {
        const fetchData = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // Fetch timesheets based on user role
                let timesheets: Timesheet[] = [];
                const isSupervisor = user.Roles?.some((role) => role.name.includes('Supervisor'));
                if (isSupervisor) {
                    timesheets = await getTimesheetsBySupervisor(user.userID);
                } else {
                    timesheets = await getAllTimesheets();
                }

                // Aggregate hours by day of the week from all visits
                const allVisits = timesheets.flatMap((ts) => ts.Visits || []);
                const hoursByDay: { [key: string]: number } = {};

                allVisits.forEach((visit) => {
                    const date = new Date(visit.date);
                    if (isNaN(date.getTime())) {
                        console.warn(`Invalid date for visit: ${visit.date}`);
                        return;
                    }
                    // Adjust getDay() to start with Monday (0=Mon, 6=Sun)
                    const dayIndex = (date.getDay() + 6) % 7;
                    const day = dayNames[dayIndex];
                    hoursByDay[day] = (hoursByDay[day] || 0) + (visit.duration || 0);
                });

                // Prepare chart data
                setChartData({
                    labels: dayNames,
                    datasets: [
                        {
                            label: 'Hours Worked',
                            data: dayNames.map((day) => hoursByDay[day] || 0),
                            backgroundColor: 'rgba(75, 192, 192, 0.6)',
                        },
                    ],
                });
            } catch (err) {
                setError('Failed to fetch heatmap data');
                console.error('Error fetching timesheets:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user, hasPermission]);

    // Early returns for permission, loading, and error states
    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading heatmap...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    // Chart options for better visualization
    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
            },
            title: {
                display: true,
                text: 'Weekly Activity Heatmap',
            },
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Day of the Week',
                },
            },
            y: {
                title: {
                    display: true,
                    text: 'Hours Worked',
                },
                beginAtZero: true,
            },
        },
    };

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Activity Heatmap</h2>
            {chartData && <Bar data={chartData} options={options} />}
        </div>
    );
};

export default ActivityHeatmapWidget;