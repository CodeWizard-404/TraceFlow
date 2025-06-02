import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAllTimesheets } from '../../apis/timesheetAPI';
import Timesheet from '../../models/Timesheet';

interface TimesheetStats {
  total: number;
  pending: number;
}

const TimesheetOverviewWidget: React.FC = () => {
  const { user, effectivePermissions } = useAuth();
  const [stats, setStats] = useState<TimesheetStats>({ total: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasPermission = effectivePermissions?.some(
    (p) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_TIMESHEETS
  );

  useEffect(() => {
    const fetchStats = async () => {
      if (!user || !hasPermission) {
        setError('Permission denied');
        setLoading(false);
        return;
      }
      try {
        const timesheets: Timesheet[] = await getAllTimesheets();
        const total = timesheets.length;
        const pending = timesheets.filter((ts: Timesheet) => ts.status === 'pending').length;
        setStats({ total, pending });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch timesheet overview';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user, hasPermission]);

  if (!hasPermission) return null;
  if (loading) return <div className="p-4 text-gray-600">Loading overview...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="widget-content p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Timesheet Overview</h2>
      <p className="text-gray-700">Total Timesheets: {stats.total}</p>
      <p className="text-gray-700">Pending Validation: {stats.pending}</p>
    </div>
  );
};

export default TimesheetOverviewWidget;