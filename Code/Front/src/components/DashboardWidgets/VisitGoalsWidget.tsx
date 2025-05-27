import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getTimesheetsBySupervisor } from '../../apis/timesheetAPI';

const VisitGoalsWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [progress, setProgress] = useState<{ completed: number; total: number }>({ completed: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_VISIT_DETAILS
    );

    useEffect(() => {
        const fetchProgress = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                const response = await getTimesheetsBySupervisor(user.userID);
                const visits = response.flatMap((ts) => ts.Visits || []);
                const completed = visits.filter((v) => v.status === 'validated').length;
                setProgress({ completed, total: visits.length });
            } catch (err) {
                setError('Failed to fetch visit progress');
            } finally {
                setLoading(false);
            }
        };
        fetchProgress();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div>Loading progress...</div>;
    if (error) return <div>{error}</div>;

    const percentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

    return (
        <div className="widget-content">
            <h2>Visit Goals</h2>
            <p>{progress.completed} of {progress.total} visits completed</p>
            <div style={{ background: '#ddd', height: '20px', borderRadius: '5px' }}>
                <div style={{ width: `${percentage}%`, background: '#4bc0c0', height: '100%', borderRadius: '5px' }}></div>
            </div>
        </div>
    );
};

export default VisitGoalsWidget;