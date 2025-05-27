import React, { useState, ChangeEvent, FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { sendToSupplier } from '../../apis/receiptBookAPI';

const QRCodeGenerationWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [status, setStatus] = useState({ processed: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [bookIDs, setBookIDs] = useState('');
    const [supplierEmail, setSupplierEmail] = useState('');

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_GENERATE_QR_CODES
    );

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!user || !hasPermission) {
            setError('Permission denied');
            return;
        }
        if (!bookIDs.trim() || !supplierEmail.trim()) {
            setError('Book IDs and supplier email are required');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const bookIDArray = bookIDs.split(',').map(id => id.trim()).filter(id => id);
            const response = await sendToSupplier(bookIDArray, supplierEmail);
            setStatus({
                processed: response.bookIDs?.length || 0,
            });
        } catch (err) {
            setError('Failed to send receipt books to supplier');
        } finally {
            setLoading(false);
        }
    };

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Processing...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">QR Code Generation</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Book IDs (comma-separated)</label>
                    <input
                        type="text"
                        value={bookIDs}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setBookIDs(e.target.value)}
                        placeholder="e.g., book1,book2,book3"
                        className="w-full p-2 border rounded"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Supplier Email</label>
                    <input
                        type="email"
                        value={supplierEmail}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setSupplierEmail(e.target.value)}
                        placeholder="supplier@example.com"
                        className="w-full p-2 border rounded"
                    />
                </div>
                <button
                    type="submit"
                    className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600"
                >
                    Send to Supplier
                </button>
            </form>
            {status.processed > 0 && (
                <div className="mt-4">
                    <p>Processed: {status.processed} receipt book(s)</p>
                </div>
            )}
        </div>
    );
};

export default QRCodeGenerationWidget;