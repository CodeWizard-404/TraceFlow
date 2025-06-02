import React, { useEffect, useState, ChangeEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { uploadAgents } from '../../apis/agentAPI';

const AgentUploadStatusWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [status, setStatus] = useState({ processed: 0, total: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_UPLOAD_AGENTS
    );

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };

    useEffect(() => {
        const fetchStatus = async () => {
            if (!user || !hasPermission || !file) {
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const response = await uploadAgents(file);
                setStatus({
                    processed: (response.summary.agentsCreated || 0) + (response.summary.agentsUpdated || 0),
                    total: response.summary.totalRecords || 0,
                });
            } catch (err) {
                setError('Failed to upload agents');
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();
    }, [file, user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Uploading agents...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Agent Upload Status</h2>
            <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="mb-4 p-2 border rounded"
            />
            {status.total > 0 && (
                <>
                    <p className="mb-2">Processed: {status.processed} of {status.total}</p>
                    <div className="bg-gray-200 h-5 rounded">
                        <div
                            style={{ width: `${(status.processed / status.total) * 100}%` }}
                            className="bg-teal-500 h-full rounded"
                        ></div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AgentUploadStatusWidget;