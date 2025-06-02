import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAllReceiptBooks, getTransferHistory } from '../../apis/receiptBookAPI';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend);

interface ChartData {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        borderColor: string;
        backgroundColor: string;
        fill: boolean;
    }[];
}

const StockTrendsWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [chartData, setChartData] = useState<ChartData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_STOCK
    );

    useEffect(() => {
        const fetchTrends = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                const response = await getAllReceiptBooks(1, 100, 'number', 'ASC', '', 'all', 'all');
                const stockByMonth: Record<string, number> = {};

                for (const book of response) {
                    // Fetch transfer history to get transferDate
                    const history = await getTransferHistory(book.bookID);
                    const latestTransfer = history.length > 0 ? history[0] : null;
                    const date = latestTransfer ? new Date(latestTransfer.transferDate) : new Date();
                    const month = date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
                    stockByMonth[month] = (stockByMonth[month] || 0) + (book.status === 'IN_STOCK' ? 1 : 0);
                }

                const labels = Object.keys(stockByMonth).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
                setChartData({
                    labels,
                    datasets: [{
                        label: 'Stock Levels',
                        data: labels.map((month) => stockByMonth[month]),
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        fill: true,
                    }],
                });
            } catch (err) {
                setError('Failed to fetch stock trends');
            } finally {
                setLoading(false);
            }
        };
        fetchTrends();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading trends...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Stock Trends</h2>
            {chartData ? (
                <Line data={chartData} options={{ responsive: true }} />
            ) : (
                <p className="text-gray-600">No stock data available.</p>
            )}
        </div>
    );
};

export default StockTrendsWidget;