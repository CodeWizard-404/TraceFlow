import React, { useEffect, useState } from 'react';
import MapComponent from '../../components/Google/MapComponent';
import { getAllTimesheets, getTimesheetsBySupervisor } from '../../apis/timesheetAPI';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

interface Visit {
    visitID: string;
    location?: string;
    date: string;
    time: string;
    status: string;
    agentID: string;
}

const Dashboard: React.FC = () => {
    const { user, userRoles, effectivePermissions } = useAuth();
    const [visits, setVisits] = useState<Visit[]>([]);
    const [loading, setLoading] = useState(true);

    const isSupervisor = userRoles?.some(role => role.name === import.meta.env.VITE_SUPERVISOR_ROLE);
    const canAccessAllTimesheets = effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_TIMESHEETS);
    const supervisorID = user?.userID;

    useEffect(() => {
        const fetchVisits = async () => {
            setLoading(true);
            try {
                let timesheets: any[] = [];
                if (canAccessAllTimesheets) {
                    const response = await getAllTimesheets();
                    timesheets = response; // Assuming ListTimesheetsResponse is an array of timesheets
                } else if (isSupervisor && supervisorID) {
                    const response = await getTimesheetsBySupervisor(supervisorID);
                    timesheets = response; // Assuming TimesheetsBySupervisorResponse is an array of timesheets
                } else {
                    throw new Error('Insufficient permissions to view timesheets');
                }

                // Extract visits from timesheets for the current year
                const currentYear = new Date().getFullYear();
                const allVisits = timesheets
                    .filter(ts => ts.year === currentYear)
                    .flatMap(ts => ts.Visits || [])
                    .map((v: any) => ({
                        visitID: v.visitID,
                        location: v.location || 'Location TBD',
                        date: v.date,
                        time: v.time,
                        status: v.status,
                        agentID: v.agentID,
                    }));

                setVisits(allVisits);
            } catch (err) {
                toast.error(
                    err && typeof err === 'object' && 'message' in err
                        ? (err as { message: string }).message
                        : 'Failed to load visits');
            } finally {
                setLoading(false);
            }
        };
        fetchVisits();
    }, [canAccessAllTimesheets, isSupervisor, supervisorID]);

    if (loading) return <div className="text-center py-4">Loading...</div>;

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
            <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">Visit Locations</h2>
                <MapComponent />
            </div>
            <div>
                <h2 className="text-xl font-semibold mb-2">Recent Visits</h2>
                {visits.length > 0 ? (
                    <ul className="space-y-2">
                        {visits.map(visit => (
                            <li key={visit.visitID} className="bg-white shadow rounded-lg p-4">
                                <p><strong>Visit ID:</strong> {visit.visitID}</p>
                                <p><strong>Location:</strong> {visit.location}</p>
                                <p><strong>Date:</strong> {new Date(visit.date).toLocaleDateString()}</p>
                                <p><strong>Time:</strong> {visit.time}</p>
                                <p><strong>Status:</strong> {visit.status}</p>
                                <p><strong>Agent ID:</strong> {visit.agentID}</p>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-center py-4">No visits found</div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;