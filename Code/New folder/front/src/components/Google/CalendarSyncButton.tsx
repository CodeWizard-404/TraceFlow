import React, { useState } from 'react';
import { syncVisitToCalendar, updateCalendarEvent, deleteCalendarEvent, syncAllVisitsToCalendar } from '../../apis/visitAPI';
import { toast } from 'react-toastify';

interface CalendarSyncButtonProps {
    visitId?: string; // For single visit sync
    supervisorId?: string; // For bulk sync
    isSupervisor: boolean;
    hasCalendarEvent?: boolean; // Indicates if the visit is already synced
}

const CalendarSyncButton: React.FC<CalendarSyncButtonProps> = ({ visitId, supervisorId, isSupervisor, hasCalendarEvent }) => {
    const [loading, setLoading] = useState(false);

    // Handle bulk sync for all visits (used in Timesheets)
    const handleSyncAll = async () => {
        if (!isSupervisor || !supervisorId) return;
        setLoading(true);
        try {
            const response = await syncAllVisitsToCalendar(supervisorId);
            if (response.failedEvents.length > 0) {
                toast.warn(`Synced ${response.syncedEvents.length} events. Failed: ${response.failedEvents.length}`);
            } else {
                toast.success(`Successfully synced ${response.syncedEvents.length} visits to calendar`);
            }
        } catch (err) {
            toast.error(
                err && typeof err === 'object' && 'message' in err
                    ? (err as { message: string }).message
                    : 'Failed to sync visits to calendar'
            );
        } finally {
            setLoading(false);
        }
    };

    // Handle single visit sync
    const handleSync = async () => {
        if (!visitId) return;
        setLoading(true);
        try {
            await syncVisitToCalendar(visitId);
            toast.success('Visit synced to calendar successfully');
        } catch (err) {
            toast.error(
                err && typeof err === 'object' && 'message' in err
                    ? (err as { message: string }).message
                    : 'Failed to sync visit to calendar'
            );
        } finally {
            setLoading(false);
        }
    };

    // Handle updating an existing calendar event
    const handleUpdate = async () => {
        if (!visitId) return;
        setLoading(true);
        try {
            await updateCalendarEvent(visitId);
            toast.success('Calendar event updated successfully');
        } catch (err) {
            toast.error(
                err && typeof err === 'object' && 'message' in err
                    ? (err as { message: string }).message
                    : 'Failed to update calendar event'
            );
        } finally {
            setLoading(false);
        }
    };

    // Handle deleting a calendar event
    const handleDelete = async () => {
        if (!visitId) return;
        setLoading(true);
        try {
            await deleteCalendarEvent(visitId);
            toast.success('Calendar event deleted successfully');
        } catch (err) {
            toast.error(
                err && typeof err === 'object' && 'message' in err
                    ? (err as { message: string }).message
                    : 'Failed to delete calendar event'
            );
        } finally {
            setLoading(false);
        }
    };

    // Render bulk sync button for Timesheets
    if (supervisorId && isSupervisor && !visitId) {
        return (
            <button
                onClick={handleSyncAll}
                disabled={loading}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
            >
                {loading ? 'Syncing...' : 'Sync All Visits to Calendar'}
            </button>
        );
    }

    // Render single visit sync buttons for VisitDetails
    if (visitId && isSupervisor) {
        return (
            <div className="flex gap-2">
                {!hasCalendarEvent ? (
                    <button
                        onClick={handleSync}
                        disabled={loading}
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
                    >
                        {loading ? 'Syncing...' : 'Sync to Calendar'}
                    </button>
                ) : (
                    <>
                        <button
                            onClick={handleUpdate}
                            disabled={loading}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
                        >
                            {loading ? 'Updating...' : 'Update Calendar Event'}
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={loading}
                            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:bg-gray-400"
                        >
                            {loading ? 'Deleting...' : 'Delete Calendar Event'}
                        </button>
                    </>
                )}
            </div>
        );
    }

    return null;
};

export default CalendarSyncButton;