import React, { useState, useEffect } from 'react';
import MapComponent from '../../components/Google/MapComponent';
import "../../components/Google/Map.css";
import { getAgentLocations } from '../../apis/agentAPI';
import { getUsersByRole } from '../../apis/userAPI';
import { useAuth } from '../../context/AuthContext';

// Define permissions as constants
const PERMISSIONS = {
    ACCESS_AGENT_MAP_LOCATIONS: import.meta.env.VITE_PERMISSIONS_READ_AGENT_MAP_LOCATIONS,
    ACCESS_SUPERVISORS: import.meta.env.VITE_PERMISSIONS_READ_SUPERVISORS,
};

// Define roles as constants
const ROLES = {
    SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
};

const AgentManagement: React.FC = () => {
    const { effectivePermissions } = useAuth();
    const [metrics, setMetrics] = useState({
        totalAgents: 0,
        withLocations: 0,
        withoutLocations: 0,
        totalSupervisors: 0,
    });
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                // Check permission to view agent locations
                const hasAgentPermission = effectivePermissions!.some(
                    (p) => p.name === PERMISSIONS.ACCESS_AGENT_MAP_LOCATIONS
                );
                if (hasAgentPermission) {
                    const agentLocations = await getAgentLocations();
                    const agents = agentLocations.locations;
                    const totalAgents = agents.length;
                    const withLocations = agents.filter(
                        (a) => a.latitude != null && a.longitude != null
                    ).length;
                    const withoutLocations = totalAgents - withLocations;
                    setMetrics((prev) => ({
                        ...prev,
                        totalAgents,
                        withLocations,
                        withoutLocations,
                    }));
                }

                // Check permission to view supervisors
                const hasSupervisorPermission = effectivePermissions!.some(
                    (p) => p.name === PERMISSIONS.ACCESS_SUPERVISORS
                );
                if (hasSupervisorPermission) {
                    const supervisors = await getUsersByRole(ROLES.SUPERVISOR);
                    setMetrics((prev) => ({
                        ...prev,
                        totalSupervisors: supervisors.length,
                    }));
                }

                setLastUpdated(new Date());
            } catch (error) {
                console.error('Failed to fetch metrics:', error);
            }
        };

        fetchMetrics();
    }, [effectivePermissions]);

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Agent Management</h1>

            {/* Metrics Section */}
            <div className="metrics-container">
                <div className="metric-card">
                    <h3>Total Agents</h3>
                    <p>{metrics.totalAgents}</p>
                </div>
                <div className="metric-card">
                    <h3>Agents with Locations</h3>
                    <p>{metrics.withLocations}</p>
                </div>
                <div className="metric-card">
                    <h3>Agents without Locations</h3>
                    <p>{metrics.withoutLocations}</p>
                </div>
                <div className="metric-card">
                    <h3>Total Supervisors</h3>
                    <p>{metrics.totalSupervisors}</p>
                </div>
            </div>

            {/* Last Updated Timestamp */}
            <p className="last-updated">
                Last updated: {lastUpdated ? lastUpdated.toLocaleString() : 'Never'}
            </p>

            {/* Map Section */}
            <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">Agent Locations</h2>
                <MapComponent />
            </div>
        </div>
    );
};

export default React.memo(AgentManagement);