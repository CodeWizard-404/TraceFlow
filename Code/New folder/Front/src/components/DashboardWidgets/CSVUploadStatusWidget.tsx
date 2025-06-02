import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { uploadReceiptBooks } from '../../apis/receiptBookAPI';

const CSVUploadStatusWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [status, setStatus] = useState({ processed: 0, total: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_UPLOAD_RECEIPT_BOOKS
    );

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };

    const handleUpload = async () => {
        if (!file || !user || !hasPermission) {
            setError('Please select a file and ensure you have permission');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await uploadReceiptBooks(file, (percentage) => {
                console.log(`Upload progress: ${percentage}%`);
            });
            setStatus({
                processed: response.summary.booksCreated || 0,
                total: response.summary.totalRecords || 0,
            });
        } catch (err) {
            setError('Failed to upload CSV file');
        } finally {
            setLoading(false);
        }
    };

    if (!hasPermission) return null;
    if (loading) return <div>Uploading...</div>;
    if (error) return <div>{error}</div>;

    return (
        <div className="widget-content">
            <h2>CSV Upload Status</h2>
            <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={loading}
            />
            <button onClick={handleUpload} disabled={!file || loading}>
                Upload CSV
            </button>
            {status.total > 0 && (
                <>
                    <p>Processed: {status.processed} of {status.total}</p>
                    <div style={{ background: '#ddd', height: '20px', borderRadius: '5px' }}>
                        <div
                            style={{
                                width: `${(status.processed / status.total) * 100}%`,
                                background: '#4bc0c0',
                                height: '100%',
                                borderRadius: '5px',
                            }}
                        ></div>
                    </div>
                </>
            )}
        </div>
    );
};

export default CSVUploadStatusWidget;