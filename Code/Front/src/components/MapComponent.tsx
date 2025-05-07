import React from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { motion } from 'framer-motion';

interface MapComponentProps {
    center: { lat: number; lng: number };
    markers: { lat: number; lng: number }[];
}

const MapComponent: React.FC<MapComponentProps> = ({ center, markers }) => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    const mapContainerStyle = {
        width: '100%',
        height: '400px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    };

    if (!apiKey || apiKey === 'your_google_maps_api_key_here') {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="error-message"
                style={{ textAlign: 'center', padding: '20px' }}
            >
                Google Maps API key is not set. Please configure it in the .env file.
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="form-group"
        >
            <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
                Agent Locations
            </div>
            <LoadScript
                googleMapsApiKey={apiKey}
                loadingElement={
                    <div
                        style={{
                            ...mapContainerStyle,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#f0f0f0',
                        }}
                    >
                        <span className="spinner" />
                    </div>
                }
            >
                <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={center}
                    zoom={10}
                >
                    {markers.map((marker, index) => (
                        <Marker key={index} position={marker} />
                    ))}
                </GoogleMap>
            </LoadScript>
        </motion.div>
    );
};

export default MapComponent;