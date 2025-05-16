import React, { useState } from 'react';
import { syncVisitToCalendar, SyncCalendarResponse } from '../../apis/visitAPI';
import { syncTimesheetToCalendar, SyncTimesheetCalendarResponse } from '../../apis/timesheetAPI';
import { toast } from 'react-toastify';
import './Calendar.css';

interface CalendarSyncButtonProps {
    visitId?: string;
    timesheetId?: string;
    isSupervisor: boolean;
    hasCalendarEvent?: boolean;
}

const CalendarSyncButton: React.FC<CalendarSyncButtonProps> = ({ visitId, timesheetId, isSupervisor, hasCalendarEvent }) => {
    const [loading, setLoading] = useState(false);

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

    if (timesheetId && isSupervisor && !visitId) {
        return (
            <button
                onClick={handleTimesheetSync}
                disabled={loading}
                className="sync-btn"
            >
                {loading ? 'Syncing...' : 'Sync Timesheet to Calendar'}
            </button>
        );
    }

    if (visitId && isSupervisor) {
        return (
            <button
                onClick={handleVisitSync}
                disabled={loading || hasCalendarEvent}
                className="sync-btn"
            >
                {loading ? 'Syncing...' : hasCalendarEvent ? 'Synced' : 'Sync to Calendar'}
            </button>
        );
    }

    return null;
};

export default CalendarSyncButton;