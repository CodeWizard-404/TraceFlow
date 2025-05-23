import React, { useState, useEffect } from 'react';
import { syncVisitToCalendar, SyncCalendarResponse } from '../../apis/visitAPI';
import { syncTimesheetToCalendar, SyncTimesheetCalendarResponse } from '../../apis/timesheetAPI';
import { toast } from 'react-toastify';
import api from '../../apis/axiosConfig';
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
    const [allVisitsSynced, setAllVisitsSynced] = useState(false);

    // Check timesheet sync status on mount if timesheetId is provided
    useEffect(() => {
        const checkTimesheetSyncStatus = async () => {
            if (!timesheetId || !isSupervisor || visitId) return;
            try {
                const events = await api.get(`/visits/timesheet/${timesheetId}/calendar-events`);
                const visits = await api.get(`/timesheets/${timesheetId}`);
                const allSynced = visits.data.Visits.every((visit: any) =>
                    events.data.some((event: any) => event.extendedProperties?.private?.visitId === visit.visitID)
                );
                setAllVisitsSynced(allSynced);
            } catch (err) {
                console.error('Failed to check timesheet sync status:', err);
            }
        };
        checkTimesheetSyncStatus();
    }, [timesheetId, isSupervisor, visitId]);

    const handleTimesheetSync = async () => {
        if (!isSupervisor || !timesheetId) return;
        setLoading(true);
        try {
            const response: SyncTimesheetCalendarResponse = await syncTimesheetToCalendar(timesheetId);
            const created = response.filter(r => r.status === 'created').length;
            const updated = response.filter(r => r.status === 'updated').length;
            toast.success(`Synced ${created} new and ${updated} updated events to calendar`);
            setAllVisitsSynced(true);
            console.log(`Timesheet ${timesheetId} synced: ${created} created, ${updated} updated`);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to sync timesheet to calendar';
            toast.error(errorMsg);
            if (errorMsg.includes('Invalid Credentials') || (err as any).response?.status === 401) {
                handleCalendarAuth();
            }
            console.error('Timesheet sync error:', err);
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
            console.log(`Visit ${visitId} synced successfully`);
        } catch (err) {
            const axiosErr = err as any;
            if (axiosErr.response?.status === 401 || axiosErr.message?.includes('Invalid Credentials')) {
                toast.error('Calendar access missing or expired. Please re-authorize.');
                handleCalendarAuth();
            } else {
                const errorMsg = axiosErr.message || 'Failed to sync visit to calendar';
                toast.error(errorMsg, { onClick: () => handleVisitSync() });
                console.error('Visit sync error:', err);
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
            console.log('Redirecting to Google auth URL');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to initiate calendar authorization');
            console.error('Calendar auth error:', err);
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
                {loading ? 'Syncing...' : allVisitsSynced ? 'Synced' : 'Sync Timesheet to Calendar'}
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