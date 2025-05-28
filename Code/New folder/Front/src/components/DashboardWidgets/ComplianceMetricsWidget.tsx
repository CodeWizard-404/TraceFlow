import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
// import { getComplianceIssues } from '../../apis/complianceAPI'; // Assumed endpoint, not available

interface ComplianceIssue {
    id: string;
    description: string;
}

const ComplianceMetricsWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [issues, setIssues] = useState<ComplianceIssue[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_COMPLIANCE
    );

    useEffect(() => {
        const fetchIssues = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                // Note: getComplianceIssues not available; using placeholder.
                // Replace with actual API call when complianceAPI is provided.
                // const response = await getComplianceIssues();
                // setIssues(response.issues || []);
                setIssues([]); // Placeholder empty array
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch compliance metrics';
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };
        fetchIssues();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading metrics...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Compliance Metrics</h2>
            {issues.length === 0 ? (
                <p className="text-gray-600">No compliance issues.</p>
            ) : (
                <ul className="list-disc pl-5">
                    {issues.map((issue) => (
                        <li key={issue.id} className="mb-2">{issue.description}</li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default ComplianceMetricsWidget;