import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getNearbyAgents, getAgentsByUser } from '../../apis/agentAPI';
import { NearbyAgentsResponse } from '../../apis/index';
import Permission from '../../models/Permission';

const ProximityAlertsWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [alerts, setAlerts] = useState<NearbyAgentsResponse>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p: Permission) => p.name === import.meta.env.VITE_PERMISSIONS_READ_AGENT_PROXIMITY
    );

    useEffect(() => {
        const fetchAlerts = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // Default location (e.g., company HQ). Replace with actual user location.
                // TODO: Use navigator.geolocation to get user's current position.
                const userLocation = { lat: 36.8065, lng: 10.1815 }; // Example: Tunis, Tunisia
                const radius = 5; // 5 km radius

                // Fetch nearby agents
                const nearbyAgents = await getNearbyAgents(userLocation.lat, userLocation.lng, radius);

                // Filter by user's role
                let filteredAgents = nearbyAgents;
                const isSupervisor = user.Roles?.some((role) => role.name.includes('Supervisor'));
                if (isSupervisor) {
                    const userAgents = await getAgentsByUser(user.userID);
                    const userAgentIds = new Set(userAgents.agents.map(agent => agent.agentID));
                    filteredAgents = nearbyAgents.filter(agent => userAgentIds.has(agent.agentID));
                }

                setAlerts(filteredAgents);
            } catch (err) {
                setError('Failed to fetch proximity alerts');
            } finally {
                setLoading(false);
            }
        };

        fetchAlerts();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading alerts...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Proximity Alerts</h2>
            {alerts.length === 0 ? (
                <p className="text-gray-600">No nearby agents detected.</p>
            ) : (
                <ul className="space-y-2">
                    {alerts.map((agent) => (
                        <li
                            key={agent.agentID}
                            className="text-gray-700"
                        >
                            Agent {agent.name} {agent.lastname} is nearby ({agent.distance.toFixed(2)} km).
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default ProximityAlertsWidget;