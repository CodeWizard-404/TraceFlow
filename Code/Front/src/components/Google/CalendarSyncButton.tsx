import React, { useState } from 'react';
import { syncVisitToCalendar, SyncCalendarResponse } from '../../apis/visitAPI';
import { syncTimesheetToCalendar, SyncTimesheetCalendarResponse } from '../../apis/timesheetAPI';
import { toast } from 'react-toastify';
import api from '../../apis/axiosConfig'; // Import axios instance
import './Calendar.css';

interface CalendarSyncButtonProps {
    visitId?: string;
    timesheetId?: string;
    isSupervisor: boolean;
    hasCalendarEvent?: boolean;
    hasCalendarAccess?: boolean;
}

const CalendarSyncButton: React.FC<CalendarSyncButtonProps> = ({ visitId, timesheetId, isSupervisor, hasCalendarEvent, hasCalendarAccess }) => {
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
            toast.error(err instanceof Error ? err.message : 'Failed to sync timesheet to calendar');
        } finally {
            setLoading(false);
        }
    };

    const handleVisitSync = async () => {
        if (!visitId || !isSupervisor) return;
        setLoading(true);
        try {
            const response = await syncVisitToCalendar(visitId);
            toast.success(`Visit ${response.id} synced to calendar`);
        } catch (err) {
            if (
                typeof err === 'object' &&
                err !== null &&
                'response' in err &&
                typeof (err as any).response?.status === 'number' &&
                'message' in err &&
                typeof (err as any).message === 'string' &&
                (
                    (err as any).response?.status === 401 ||
                    (err as any).response?.status === 404 ||
                    (err as any).message.includes('Invalid Credentials')
                )
            ) {
                toast.error('Calendar access missing or expired. Please re-authorize.');
                handleCalendarAuth(); // Redirects to Google auth URL
            } else if (typeof err === 'object' && err !== null && 'message' in err && typeof (err as any).message === 'string') {
                toast.error((err as any).message || 'Failed to sync visit to calendar');
            } else {
                toast.error('Failed to sync visit to calendar');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCalendarAuth = async () => {
        setLoading(true);
        try {
            sessionStorage.setItem('pendingVisitId', visitId || '');
            const response = await api.get('/auth/get-google-calendar-auth-url');
            window.location.href = response.data.authUrl;
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to initiate calendar authorization');
        } finally {
            setLoading(false);
        }
    };

    if (!hasCalendarAccess && isSupervisor) {
        return (
            <button
                onClick={handleCalendarAuth}
                disabled={loading}
                className="sync-btn"
            >
                {loading ? 'Authorizing...' : 'Grant Calendar Access'}
            </button>
        );
    }

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