import React, { useEffect, useState } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { getAllAgents } from '../apis/agentAPI'; // Adjust based on actual API

interface Agent {
    agentID: string;
    latitude: number;
    longitude: number;
}

const MapComponent: React.FC = () => {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAgents = async () => {
            try {
                const response = await getAllAgents();
                setAgents(response.agents.map((agent: any) => ({
                    agentID: agent.agentID,
                    latitude: agent.latitude,
                    longitude: agent.longitude,
                })));
            } catch (err) {
                setError('Failed to load agents');
            } finally {
                setLoading(false);
            }
        };
        fetchAgents();
    }, []);

    if (loading) return <div>Loading map...</div>;
    if (error) return <div>{error}</div>;
    if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) return <div>Map feature is not available</div>;

    const mapContainerStyle = {
        width: '100%',
        height: '400px',
    };

    const center = agents.length > 0 ? { lat: agents[0].latitude, lng: agents[0].longitude } : { lat: 0, lng: 0 };

    return (
        <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
            <GoogleMap mapContainerStyle={mapContainerStyle} center={center} zoom={10}>
                {agents.map(agent => (
                    <Marker key={agent.agentID} position={{ lat: agent.latitude, lng: agent.longitude }} />
                ))}
            </GoogleMap>
        </LoadScript>
    );
};

export default MapComponent;