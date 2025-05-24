import React from 'react';
import MapComponent from '../../components/Google/MapComponent';
import "../../components/Google/Map.css"

const AgentManagement: React.FC = () => {
    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Agent Management</h1>
            <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">Agent Locations</h2>
                <MapComponent />
            </div>
        </div>
    );
};

export default React.memo(AgentManagement);