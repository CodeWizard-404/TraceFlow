import React, { useEffect, useState } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api';
import { getVisitById } from '../../apis/visitAPI';
import { getGeocode, getDirections } from '../../apis/locationApi';
import { toast } from 'react-toastify';

interface VisitMapViewProps {
    visitId: string;
}

interface DirectionStep {
    polyline: {
        points: google.maps.LatLngLiteral[] | any;
    };
}

const VisitMapView: React.FC<VisitMapViewProps> = ({ visitId }) => {
    const [visit, setVisit] = useState<any>(null);
    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
    const [directions, setDirections] = useState<any>(null);
    const [origin, setOrigin] = useState('');
    const [manualLocation, setManualLocation] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchVisit = async () => {
            setLoading(true);
            try {
                const visitData = await getVisitById(visitId);
                setVisit(visitData);
                if (visitData.location && visitData.location !== 'Location TBD') {
                    const geo = await getGeocode(visitData.location);
                    setCoordinates({ lat: geo.geometry.location.lat, lng: geo.geometry.location.lng });
                }
            } catch (err) {
                toast.error(
                    err && typeof err === 'object' && 'message' in err
                        ? (err as { message: string }).message
                        : 'Failed to load visit');
            } finally {
                setLoading(false);
            }
        };
        fetchVisit();
    }, [visitId]);

    const setVisitLocation = async () => {
        if (!manualLocation) {
            toast.error('Please enter a location');
            return;
        }
        setLoading(true);
        try {
            const geo = await getGeocode(manualLocation);
            setCoordinates({ lat: geo.geometry.location.lat, lng: geo.geometry.location.lng });
            setManualLocation('');
            toast.success('Visit location set');
        } catch (err) {
            toast.error(
                err && typeof err === 'object' && 'message' in err
                    ? (err as { message: string }).message
                    : 'Failed to set location');
        } finally {
            setLoading(false);
        }
    };

    const handleDirections = async () => {
        if (!origin || !coordinates) {
            toast.error('Please enter an origin address and set a visit location');
            return;
        }
        setLoading(true);
        try {
            const res = await getDirections(origin, visit?.location || manualLocation);
            if (res.mock) {
                toast.warn('Using mock directions data due to missing API key');
            }
            setDirections(res);
        } catch (err) {
            toast.error(
                err && typeof err === 'object' && 'message' in err
                    ? (err as { message: string }).message
                    : 'Failed to fetch directions');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center py-4">Loading map...</div>;
    if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) return <div className="text-center py-4 text-red-500">Map feature is not available</div>;

    const mapContainerStyle = {
        width: '100%',
        height: '400px',
    };

    // Default center to Tunisia
    const defaultCenter = { lat: 36.8065, lng: 10.1815 };

    return (
        <div className="space-y-4">
            {!coordinates && (
                <div className="flex gap-4">
                    <input
                        type="text"
                        placeholder="Enter visit location"
                        value={manualLocation}
                        onChange={(e) => setManualLocation(e.target.value)}
                        className="border rounded px-3 py-2 flex-1"
                    />
                    <button
                        onClick={setVisitLocation}
                        disabled={loading}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
                    >
                        Set Location
                    </button>
                </div>
            )}
            <div className="flex gap-4">
                <input
                    type="text"
                    placeholder="Enter your current location"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="border rounded px-3 py-2 flex-1"
                />
                <button
                    onClick={handleDirections}
                    disabled={loading || !coordinates}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
                >
                    Get Directions
                </button>
            </div>
            <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
                <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={coordinates || defaultCenter}
                    zoom={coordinates ? 12 : 7} // Zoom to 12 if coordinates are set, 7 for full Tunisia view
                >
                    {coordinates && <Marker position={coordinates} title="Visit Location" />}
                    {directions && directions.routes[0]?.legs[0]?.steps && (
                        <Polyline
                            path={directions.routes[0].legs[0].steps
                                .map((step: DirectionStep) => step.polyline.points)
                                .flat()
                            }
                            options={{ strokeColor: '#FF0000', strokeOpacity: 0.8, strokeWeight: 2 }}
                        />
                    )}
                </GoogleMap>
            </LoadScript>
        </div>
    );
};

export default VisitMapView;