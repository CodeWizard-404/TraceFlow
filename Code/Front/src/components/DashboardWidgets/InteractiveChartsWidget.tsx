import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { useAuth } from '../../context/AuthContext';
import { getAllTimesheets, getTimesheetsBySupervisor } from '../../apis/timesheetAPI';
import Timesheet from '../../models/Timesheet';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface ChartData {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        backgroundColor: string;
    }[];
}

const InteractiveChartsWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [chartData, setChartData] = useState<ChartData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_KPIS
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
                let timesheets: Timesheet[] = [];
                const isSupervisor = user.Roles?.some((role) => role.name.includes('Supervisor'));

                if (isSupervisor) {
                    // Fetch timesheets for the current supervisor
                    const response = await getTimesheetsBySupervisor(user.userID);
                    timesheets = response;
                } else {
                    // For higher roles (e.g., Regional Manager, Director), fetch all timesheets
                    const response = await getAllTimesheets();
                    timesheets = response;
                }

                // Calculate total hours per supervisor from visit durations
                const hoursBySupervisor: Record<string, number> = {};
                timesheets.forEach((ts) => {
                    const hours = ts.Visits?.reduce((sum, visit) => sum + (visit.duration || 0), 0) || 0;
                    hoursBySupervisor[ts.supervisorID] = (hoursBySupervisor[ts.supervisorID] || 0) + hours;
                });

                // Fetch supervisor names for labels (simplified; could use getUserById API)
                const labels = Object.keys(hoursBySupervisor).map((id) => `Supervisor ${id.slice(0, 8)}`);
                const data = Object.values(hoursBySupervisor);

                setChartData({
                    labels,
                    datasets: [
                        {
                            label: 'Total Hours by Supervisor',
                            data,
                            backgroundColor: 'rgba(75, 192, 192, 0.6)',
                        },
                    ],
                });
            } catch (err) {
                setError('Failed to fetch chart data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading charts...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;
    {
        chartData && (
            // You need to install react-chartjs-2 and chart.js for this to work
            // npm install react-chartjs-2 chart.js
            <Bar
                data={chartData}
                options={{
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'top' as const,
                            labels: {
                                color: '#333',
                                font: {
                                    size: 14,
                                },
                            },
                        },
                        title: {
                            display: true,
                            text: 'Total Hours by Supervisor',
                            color: '#333',
                            font: {
                                size: 16,
                            },
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                        },
                    },
                    scales: {
                        x: {
                            ticks: {
                                color: '#333',
                            },
                            grid: {
                                display: false,
                            },
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                color: '#333',
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)',
                            },
                            title: {
                                display: true,
                                text: 'Hours',
                                color: '#333',
                            },
                        },
                    },
                }}
            />
        )
    }
};

export default InteractiveChartsWidget;