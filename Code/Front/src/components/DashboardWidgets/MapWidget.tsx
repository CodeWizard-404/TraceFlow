import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import MapComponent from '../Google/MapComponent';
import { getAgentLocations } from '../../apis/agentAPI';

const MapWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [, setLocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_AGENT_MAP_LOCATIONS
    );

    useEffect(() => {
        const fetchLocations = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                const response = await getAgentLocations();
                setLocations(response.locations);
            } catch (err) {
                setError('Failed to fetch agent locations');
            } finally {
                setLoading(false);
            }
        };
        fetchLocations();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div>Loading map...</div>;
    if (error) return <div>{error}</div>;

    return (
        <div className="widget-content">
            <h2>Visit Map</h2>
            {/* <MapComponent locations={locations} /> */}
            <MapComponent />

        </div>
    );
};

export default MapWidget;