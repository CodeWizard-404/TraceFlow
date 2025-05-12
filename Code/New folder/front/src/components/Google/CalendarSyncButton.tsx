import React, { useState } from 'react';
import { syncVisitToCalendar, SyncCalendarResponse } from '../../apis/visitAPI';
import { syncTimesheetToCalendar, SyncTimesheetCalendarResponse } from '../../apis/timesheetAPI';
import { toast } from 'react-toastify';

interface CalendarSyncButtonProps {
    visitId?: string; // For single visit sync
    timesheetId?: string; // For timesheet sync
    isSupervisor: boolean;
    hasCalendarEvent?: boolean; // Indicates if the visit is already synced
}

const CalendarSyncButton: React.FC<CalendarSyncButtonProps> = ({ visitId, timesheetId, isSupervisor, hasCalendarEvent }) => {
    const [loading, setLoading] = useState(false);

    // Handle timesheet sync
    const handleTimesheetSync = async () => {
        if (!isSupervisor || !timesheetId) return;
        setLoading(true);
        try {
            const response: SyncTimesheetCalendarResponse = await syncTimesheetToCalendar(timesheetId);
            const created = response.filter(r => r.status === 'created').length;
            const updated = response.filter(r => r.status === 'updated').length;
            toast.success(`Synced ${created} new and ${updated} updated events to calendar`);
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : 'Failed to sync timesheet to calendar'
            );
        } finally {
            setLoading(false);
        }
    };

    // Handle single visit sync
    const handleVisitSync = async () => {
        if (!visitId || !isSupervisor) return;
        setLoading(true);
        try {
            const response: SyncCalendarResponse = await syncVisitToCalendar(visitId);
            toast.success(`Visit ${response.id} synced to calendar`);
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : 'Failed to sync visit to calendar'
            );
        } finally {
            setLoading(false);
        }
    };

    // Render timesheet sync button
    if (timesheetId && isSupervisor && !visitId) {
        return (
            <button
                onClick={handleTimesheetSync}
                disabled={loading}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
            >
                {loading ? 'Syncing...' : 'Sync Timesheet to Calendar'}
            </button>
        );
    }

    // Render single visit sync button
    if (visitId && isSupervisor) {
        return (
            <button
                onClick={handleVisitSync}
                disabled={loading || hasCalendarEvent}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
            >
                {loading ? 'Syncing...' : hasCalendarEvent ? 'Synced' : 'Sync to Calendar'}
            </button>
        );
    }

    return null;
};

export default CalendarSyncButton;