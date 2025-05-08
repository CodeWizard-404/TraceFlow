import React, { useState } from 'react';
import { syncVisitToCalendar } from '../apis/visitAPI';

interface CalendarSyncButtonProps {
    visitId: string;
}

const CalendarSyncButton: React.FC<CalendarSyncButtonProps> = ({ visitId }) => {
    const [loading, setLoading] = useState(false);
    const [, setError] = useState<string | null>(null);

    const handleSync = async () => {
        setLoading(true);
        setError(null);
        try {
            await syncVisitToCalendar(visitId);
            alert('Visit synced to calendar successfully');
        } catch (err) {
            setError('Failed to sync visit to calendar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleSync}
            disabled={loading}
            className="bg-green-500 text-white p-2 rounded hover:bg-green-600"
        >
            {loading ? 'Syncing...' : 'Sync to Calendar'}
        </button>
    );
};

export default CalendarSyncButton;