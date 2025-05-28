import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { generateReport } from '../../apis/aiAPI';
import User from '../../models/User';
import { GenerateReportResponse } from '../../apis/aiAPI';

type ReportType = 'timesheet' | 'stub' | 'visit';

const DynamicReportsWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [reportType, setReportType] = useState<ReportType>('timesheet');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_GENERATE_REPORTS
    );

    const handleGenerate = async () => {
        if (!user || !hasPermission) {
            setError('Permission denied');
            return;
        }
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const response: GenerateReportResponse = await generateReport({
                filters: { reportType, userID: (user as User).userID },
                format: 'pdf',
            });
            setSuccessMessage(`Report "${response.report}" generated successfully (ID: ${response.report})`);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unable to generate report';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    if (!hasPermission) return null;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Dynamic Reports</h2>
            {error && <p className="text-red-600 mb-2">{error}</p>}
            {successMessage && <p className="text-green-600 mb-2">{successMessage}</p>}
            <div className="flex flex-col gap-4">
                <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value as ReportType)}
                    className="border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="timesheet">Timesheet Report</option>
                    <option value="stub">Stub Report</option>
                    <option value="visit">Visit Report</option>
                </select>
                <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className={`px-4 py-2 rounded-md text-white ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
                >
                    {loading ? 'Generating...' : 'Generate Report'}
                </button>
            </div>
        </div>
    );
};

export default DynamicReportsWidget;