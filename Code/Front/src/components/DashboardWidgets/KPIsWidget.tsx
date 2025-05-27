import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAllTimesheets, getTimesheetsBySupervisor } from '../../apis/timesheetAPI';
import { getAllReceiptBooks } from '../../apis/receiptBookAPI';
import Timesheet from '../../models/Timesheet';

interface KpiData {
    visits: number;
    hours: number;
    books: number;
}

const KPIsWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [kpis, setKpis] = useState<KpiData>({ visits: 0, hours: 0, books: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_KPIS
    );

    useEffect(() => {
        const fetchKpis = async () => {
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

                // Fetch receipt books
                const receiptBooks = await getAllReceiptBooks();

                // Calculate KPIs
                const visits = timesheets.flatMap((ts: Timesheet) => ts.Visits || []).length;
                const hours = timesheets.reduce((sum: number, ts: Timesheet) => {
                    const tsHours = ts.Visits?.reduce((vSum: number, visit) => vSum + (visit.duration || 0), 0) || 0;
                    return sum + tsHours;
                }, 0);
                const booksCount = receiptBooks.length;

                setKpis({ visits, hours, books: booksCount });
            } catch (err) {
                setError('Failed to fetch KPIs');
            } finally {
                setLoading(false);
            }
        };

        fetchKpis();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading KPIs...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Key Performance Indicators</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-100 rounded-lg text-center">
                    <p className="text-lg font-semibold text-gray-800">Total Visits</p>
                    <p className="text-2xl font-bold text-gray-900">{kpis.visits}</p>
                </div>
                <div className="p-4 bg-gray-100 rounded-lg text-center">
                    <p className="text-lg font-semibold text-gray-800">Total Hours</p>
                    <p className="text-2xl font-bold text-gray-900">{kpis.hours.toFixed(2)}</p>
                </div>
                <div className="p-4 bg-gray-100 rounded-lg text-center">
                    <p className="text-lg font-semibold text-gray-800">Receipt Books</p>
                    <p className="text-2xl font-bold text-gray-900">{kpis.books}</p>
                </div>
            </div>
        </div>
    );
};

export default KPIsWidget;