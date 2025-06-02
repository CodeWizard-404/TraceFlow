import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import { getTimesheetsBySupervisor } from '../../apis/timesheetAPI';

const VisitCalendarWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_VISIT_DETAILS
    );

    useEffect(() => {
        const fetchVisits = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                const response = await getTimesheetsBySupervisor(user.userID);
                const today = new Date().toISOString().split('T')[0];
                const visits = response
                    .flatMap((ts) => ts.Visits || [])
                    .filter((visit) => visit.date === today);
                const calendarEvents = visits.map((visit) => ({
                    title: visit.agentID ? `Visit to Agent ${visit.agentID}` : 'Recruitment Visit',
                    start: `${visit.date}T${visit.time}`,
                    end: visit.duration
                        ? new Date(
                            new Date(`${visit.date}T${visit.time}`).getTime() + visit.duration * 60000
                        ).toISOString()
                        : undefined,
                    extendedProps: { visitID: visit.visitID, status: visit.status },
                }));
                setEvents(calendarEvents);
            } catch (err) {
                setError('Failed to fetch visits');
            } finally {
                setLoading(false);
            }
        };
        fetchVisits();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div>Loading visits...</div>;
    if (error) return <div>{error}</div>;

    return (
        <div className="widget-content">
            <h2>Today's Visits</h2>
            <FullCalendar
                plugins={[dayGridPlugin]}
                initialView="dayGridDay"
                events={events}
                height="auto"
                eventClick={(info) =>
                    window.location.href = `/visit/${info.event.extendedProps.visitID}`
                }
            />
        </div>
    );
};

export default VisitCalendarWidget;