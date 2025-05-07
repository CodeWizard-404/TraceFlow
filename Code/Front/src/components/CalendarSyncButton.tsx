import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FaCalendarAlt } from 'react-icons/fa';
import { syncVisitToCalendar } from '../apis/visitAPI';

interface CalendarSyncButtonProps {
    visitId: string;
}

const CalendarSyncButton: React.FC<CalendarSyncButtonProps> = ({ visitId }) => {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [isError, setIsError] = useState(false);

    const handleSync = async () => {
        setLoading(true);
        setMessage(null);
        setIsError(false);
        try {
            const response = await syncVisitToCalendar(visitId);
            setMessage(response.message || 'Visit synced to calendar successfully');
            setIsError(false);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to sync visit to calendar';
            setMessage(errorMessage);
            setIsError(true);
            console.error('Sync error:', error);
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 5000); // Clear message after 5s, matching LoginPage
        }
    };

    return (
        <div className="form-group">
            {message && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={isError ? 'error-message' : 'success-message'}
                >
                    {message}
                </motion.div>
            )}
            <motion.button
                type="button"
                className="action-button-0 secondary"
                onClick={handleSync}
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                }}
            >
                {loading ? (
                    <span className="spinner" />
                ) : (
                    <>
                        <FaCalendarAlt size={18} />
                        Sync to Calendar
                    </>
                )}
            </motion.button>
        </div>
    );
};

export default CalendarSyncButton;