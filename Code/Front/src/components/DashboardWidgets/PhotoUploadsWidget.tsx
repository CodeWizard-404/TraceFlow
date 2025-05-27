import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getVisitById } from '../../apis/visitAPI';
import { getTimesheetsBySupervisor, getAllTimesheets } from '../../apis/timesheetAPI';
import Timesheet from '../../models/Timesheet';
import Visit from '../../models/Visit';

interface Photo {
    url: string;
    visitID: string;
}

const PhotoUploadsWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_VISIT_DETAILS
    );

    useEffect(() => {
        const fetchPhotos = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // Fetch timesheets based on user role
                let timesheets: Timesheet[] = [];
                const isSupervisor = user.Roles?.some((role) => role.name.includes('Supervisor'));
                if (isSupervisor) {
                    timesheets = await getTimesheetsBySupervisor(user.userID);
                } else {
                    timesheets = await getAllTimesheets();
                }

                // Get visit IDs
                const visitIds = timesheets.flatMap((ts: Timesheet) =>
                    ts.Visits?.map((v: Visit) => v.visitID) || []
                );

                // Fetch visit details concurrently
                const visitDetails = await Promise.all(
                    visitIds.map((id: string) => getVisitById(id))
                );

                // Extract photos with visitID
                const recentPhotos = visitDetails
                    .flatMap((visit: Visit) =>
                        (visit.photos || []).map((url: string) => ({
                            url,
                            visitID: visit.visitID,
                        }))
                    )
                    .slice(0, 5); // Limit to 5 recent photos

                setPhotos(recentPhotos);
            } catch (err) {
                setError('Failed to fetch photos');
            } finally {
                setLoading(false);
            }
        };

        fetchPhotos();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading photos...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Recent Photo Uploads</h2>
            {photos.length === 0 ? (
                <p className="text-gray-600">No recent photos.</p>
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-2">
                    {photos.map((photo, index) => (
                        <img
                            key={`${photo.visitID}-${index}`}
                            src={photo.url}
                            alt="Visit photo"
                            className="w-24 h-24 object-cover rounded-lg"
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default PhotoUploadsWidget;