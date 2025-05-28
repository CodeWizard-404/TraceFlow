import { useState, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import Modal from 'react-modal';
import { getGeocode, getDirections } from '../../apis/locationApi';
import { DirectionsResponse } from '../../apis/index';
import './Map.css';

const containerStyle = { width: '100%', height: '70vh' };
const defaultCenter = { lat: 36.8065, lng: 10.1815 };

interface Visit {
    location: string;
    time?: string;
    startTime?: string;
    agentID?: string;
}

interface VisitCoordinate {
    lat: number;
    lng: number;
    visit: Visit;
}

interface RouteMapModalProps {
    visits: Visit[];
    onClose: () => void;
}

const isCoordinates = (str: string): boolean => /^\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+\s*$/.test(str);

const RouteMapModal: React.FC<RouteMapModalProps> = ({ visits, onClose }) => {
    const [visitCoordinates, setVisitCoordinates] = useState<VisitCoordinate[]>([]);
    const [route, setRoute] = useState<DirectionsResponse | null>(null);
    const [selectedVisit, setSelectedVisit] = useState<VisitCoordinate | null>(null);

    useEffect(() => {
        const fetchCoordinates = async () => {
            const coordsPromises = visits.map(async (visit: Visit) => {
                let lat: number, lng: number;
                if (isCoordinates(visit.location)) {
                    [lat, lng] = visit.location.split(',').map(Number);
                } else {
                    const geocode = await getGeocode(visit.location);
                    lat = geocode.latitude;
                    lng = geocode.longitude;
                }
                return { lat, lng, visit };
            });
            const coords = await Promise.all(coordsPromises);
            const sortedCoords = coords.sort((a, b) => {
                const timeA = a.visit.time || a.visit.startTime || '';
                const timeB = b.visit.time || b.visit.startTime || '';
                return timeA.localeCompare(timeB);
            });
            setVisitCoordinates(sortedCoords);
        };
        fetchCoordinates();
    }, [visits]);

    useEffect(() => {
        if (visitCoordinates.length < 2) return;
        const calculateRoute = async () => {
            const origin = `${visitCoordinates[0].lat},${visitCoordinates[0].lng}`;
            const destination = `${visitCoordinates[visitCoordinates.length - 1].lat},${visitCoordinates[visitCoordinates.length - 1].lng}`;
            const waypoints = visitCoordinates.slice(1, -1).map(coord => ({
                location: `${coord.lat},${coord.lng}`,
                stopover: true,
            }));
            const directions = await getDirections(origin, destination, 'driving', waypoints, true);
            setRoute(directions);
        };
        calculateRoute();
    }, [visitCoordinates]);

    const handleStart = () => {
        if (!route) return;
        // Use optimizedPoints if available, otherwise derive from steps
        const points = route.optimizedPoints && route.optimizedPoints.length > 0
            ? route.optimizedPoints
            : route.steps.map(step => `${step.start_location.lat},${step.start_location.lng}`);

        const origin = points[0];
        const destination = points[points.length - 1];
        const waypoints = points.slice(1, -1).join('|');
        const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
        window.open(url, '_blank');
    };

    const formatTime = (timeStr: string): string => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 || 12;
        return `${formattedHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    return (
        <Modal isOpen={true} onRequestClose={onClose} className="map-modal" overlayClassName="map-modal-overlay">
            <div className="map-container">
                <div className="panel-header">
                    <h2>Route for Today's Visits</h2>
                    <button className="control-btn" onClick={onClose}>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
                    <GoogleMap
                        mapContainerStyle={containerStyle}
                        center={visitCoordinates[0] || defaultCenter}
                        zoom={10}
                        options={{
                            mapTypeControl: false,
                            streetViewControl: false,
                            fullscreenControl: false,
                        }}
                    >
                        {visitCoordinates.map((coord, index) => (
                            <Marker
                                key={index}
                                position={coord}
                                onClick={() => setSelectedVisit(coord)}
                                icon={{
                                    url: 'https://maps.gstatic.com/mapfiles/ms2/micons/lightblue.png',
                                }}
                            />
                        ))}
                        {route && route.polyline && (
                            <Polyline
                                path={route.polyline
                                    .split(',')
                                    .map((_, i, arr) => i % 2 === 0 ? { lat: parseFloat(arr[i]), lng: parseFloat(arr[i + 1]) } : null)
                                    .filter((p): p is { lat: number; lng: number } => p !== null)}
                                options={{ strokeColor: '#4cb1c7', strokeOpacity: 0.9, strokeWeight: 6 }}
                            />
                        )}
                        {selectedVisit && (
                            <InfoWindow
                                position={{ lat: selectedVisit.lat, lng: selectedVisit.lng }}
                                onCloseClick={() => setSelectedVisit(null)}
                            >
                                <div className="info-window">
                                    <h3>{selectedVisit.visit.agentID || 'Visit'}</h3>
                                    <p>{selectedVisit.visit.location}</p>
                                    <p>Time: {formatTime(selectedVisit.visit.time || selectedVisit.visit.startTime || '')}</p>
                                </div>
                            </InfoWindow>
                        )}
                    </GoogleMap>
                </LoadScript>
                <div className="control-buttons">
                    <button className="control-btn" onClick={handleStart}>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                        Start
                    </button>
                </div>
                <div className="agent-list">
                    {visitCoordinates.map((coord, index) => (
                        <div key={index} className="agent-card">
                            <h4>Visit {index + 1}</h4>
                            <p>{coord.visit.location}</p>
                            <p>Time: {formatTime(coord.visit.time || coord.visit.startTime || '')}</p>
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    );
};

export default RouteMapModal;