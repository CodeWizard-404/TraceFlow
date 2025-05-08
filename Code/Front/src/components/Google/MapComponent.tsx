import React, { useState } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api';
import { getGeocode, getDirections, searchPlaces } from '../../apis/locationApi';
import { toast } from 'react-toastify';

interface DirectionStep {
    polyline: {
        points: google.maps.LatLngLiteral[] | any;
    };
}

const MapComponent: React.FC = () => {
    const [markers, setMarkers] = useState<Array<{ id: string; lat: number; lng: number; name?: string }>>([]);
    const [directions, setDirections] = useState<any>(null);
    const [places, setPlaces] = useState<Array<{ place_id: string; lat: number; lng: number; name: string }>>([]);
    const [address, setAddress] = useState('');
    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [placeQuery, setPlaceQuery] = useState('');
    const [loading, setLoading] = useState(false);

    const addMarker = async () => {
        if (!address) {
            toast.error('Please enter an address');
            return;
        }
        setLoading(true);
        try {
            const res = await getGeocode(address);
            const newMarker = {
                id: `marker-${Date.now()}`,
                lat: res.geometry.location.lat,
                lng: res.geometry.location.lng,
                name: address,
            };
            setMarkers([...markers, newMarker]);
            setAddress('');
            toast.success('Location added to map');
        } catch (err) {
            toast.error(
                err && typeof err === 'object' && 'message' in err
                    ? (err as { message: string }).message
                    : 'Failed to add location');
        } finally {
            setLoading(false);
        }
    };

    const handleDirections = async () => {
        if (!origin || !destination) {
            toast.error('Please enter both origin and destination');
            return;
        }
        setLoading(true);
        try {
            const res = await getDirections(origin, destination);
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

    const handlePlaceSearch = async () => {
        if (!placeQuery) {
            toast.error('Please enter a search query');
            return;
        }
        setLoading(true);
        try {
            const res = await searchPlaces(placeQuery, markers[0] ? { lat: markers[0].lat, lng: markers[0].lng } : undefined);
            setPlaces(res.map(place => ({
                place_id: place.place_id,
                lat: place.geometry.location.lat,
                lng: place.geometry.location.lng,
                name: place.name,
            })));
        } catch (err) {
            toast.error(
                err && typeof err === 'object' && 'message' in err
                    ? (err as { message: string }).message
                    : 'Failed to search places');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center py-4">Loading map...</div>;
    if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) return <div className="text-center py-4 text-red-500">Map feature is not available</div>;

    const mapContainerStyle = {
        width: '100%',
        height: '500px',
    };

    const center = markers.length > 0 ? { lat: markers[0].lat, lng: markers[0].lng } : { lat: 0, lng: 0 };

    return (
        <div className="space-y-4">
            <div className="flex gap-4">
                <input
                    type="text"
                    placeholder="Enter address to add to map"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="border rounded px-3 py-2 flex-1"
                />
                <button
                    onClick={addMarker}
                    disabled={loading}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
                >
                    Add to Map
                </button>
            </div>
            <div className="flex gap-4">
                <input
                    type="text"
                    placeholder="Enter origin"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="border rounded px-3 py-2 flex-1"
                />
                <input
                    type="text"
                    placeholder="Enter destination"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="border rounded px-3 py-2 flex-1"
                />
                <button
                    onClick={handleDirections}
                    disabled={loading}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
                >
                    Get Directions
                </button>
            </div>
            <div className="flex gap-4">
                <input
                    type="text"
                    placeholder="Search places (e.g., coffee shop)"
                    value={placeQuery}
                    onChange={(e) => setPlaceQuery(e.target.value)}
                    className="border rounded px-3 py-2 flex-1"
                />
                <button
                    onClick={handlePlaceSearch}
                    disabled={loading}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
                >
                    Search Places
                </button>
            </div>
            <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
                <GoogleMap mapContainerStyle={mapContainerStyle} center={center} zoom={10}>
                    {markers.map(marker => (
                        <Marker key={marker.id} position={{ lat: marker.lat, lng: marker.lng }} title={marker.name} />
                    ))}
                    {places.map(place => (
                        <Marker
                            key={place.place_id}
                            position={{ lat: place.lat, lng: place.lng }}
                            title={place.name}
                            icon="http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                        />
                    ))}
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

export default MapComponent;