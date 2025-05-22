import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { toast } from 'react-toastify';
import { getGeocode } from '../../apis/locationApi';
import './LocationCorrectionModal.css';

interface LocationCorrectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    agentId: string;
    onLocationCorrected: (location: { lat: number; lng: number; address: string }) => void;
    userLocation: { lat: number; lng: number } | null;
}

const containerStyle = { width: '100vw', height: '100vh' };
const defaultCenter = { lat: 36.8065, lng: 10.1815 };
const libraries: ('places')[] = ['places'];

const LocationCorrectionModal: React.FC<LocationCorrectionModalProps> = ({
    isOpen,
    onClose,
    onLocationCorrected,
    userLocation,
}) => {
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [tempAddress, setTempAddress] = useState<string>('');
    const [mapCenter, setMapCenter] = useState(userLocation || defaultCenter);
    const [liveLocation, setLiveLocation] = useState(userLocation);
    const mapRef = useRef<google.maps.Map | null>(null);

    useEffect(() => {
        if (isOpen && userLocation) {
            setMapCenter(userLocation);
            setLiveLocation(userLocation);
        }
    }, [isOpen, userLocation]);

    useEffect(() => {
        if (!isOpen || !navigator.geolocation) return;

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setLiveLocation({ lat: latitude, lng: longitude });
            },
            (error) => {
                console.error('Live location error:', error);
                toast.error('Unable to update live location');
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [isOpen]);

    const handleUseCurrentLocation = async () => {
        if (!liveLocation) {
            toast.error('Current location not available');
            return;
        }
        try {
            const geocode = await getGeocode(`${liveLocation.lat},${liveLocation.lng}`);
            if (!geocode.formattedAddress) {
                toast.error('Unable to determine address');
                return;
            }
            onLocationCorrected({
                lat: liveLocation.lat,
                lng: liveLocation.lng,
                address: geocode.formattedAddress,
            });
            onClose();
            toast.success('Location set to current location');
        } catch (err) {
            console.error('Geocode error:', err);
            toast.error('Failed to get address');
        }
    };

    const handleMapClick = async (event: google.maps.MapMouseEvent) => {
        const lat = event.latLng?.lat();
        const lng = event.latLng?.lng();
        if (lat && lng) {
            try {
                const geocode = await getGeocode(`${lat},${lng}`);
                if (!geocode.formattedAddress) {
                    toast.error('Unable to determine address');
                    return;
                }
                setSelectedLocation({ lat, lng });
                setTempAddress(geocode.formattedAddress);
            } catch (err) {
                console.error('Geocode error:', err);
                toast.error('Failed to get address');
            }
        }
    };

    const handleMarkerDragEnd = async (event: google.maps.MapMouseEvent) => {
        const lat = event.latLng?.lat();
        const lng = event.latLng?.lng();
        if (lat && lng) {
            try {
                const geocode = await getGeocode(`${lat},${lng}`);
                if (!geocode.formattedAddress) {
                    toast.error('Unable to determine address');
                    return;
                }
                setSelectedLocation({ lat, lng });
                setTempAddress(geocode.formattedAddress);
            } catch (err) {
                console.error('Geocode error:', err);
                toast.error('Failed to get address');
            }
        }
    };

    const handleSaveCustomLocation = () => {
        if (!selectedLocation || !tempAddress) {
            toast.error('Please select a location on the map');
            return;
        }
        onLocationCorrected({
            lat: selectedLocation.lat,
            lng: selectedLocation.lng,
            address: tempAddress,
        });
        onClose();
        toast.success('Custom location saved');
    };

    const onMapLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
    }, []);

    if (!isOpen) return null;

    return (
        <div className="location-correction-container active">
            <div className="map-frame">
                <LoadScript
                    googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                    libraries={libraries}
                >
                    <GoogleMap
                        mapContainerStyle={containerStyle}
                        center={mapCenter}
                        zoom={15}
                        onLoad={onMapLoad}
                        onClick={handleMapClick}
                        options={{
                            mapTypeControl: false,
                            streetViewControl: false,
                            fullscreenControl: false,
                            zoomControl: true,
                            gestureHandling: 'greedy',
                        }}
                    >
                        {liveLocation && (
                            <Marker
                                position={liveLocation}
                                title="Your Live Location"
                                icon={{
                                    url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                                }}
                            />
                        )}
                        {selectedLocation && (
                            <Marker
                                position={selectedLocation}
                                title="Selected Location"
                                draggable
                                onDragEnd={handleMarkerDragEnd}
                                icon={{
                                    url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
                                }}
                            />
                        )}
                    </GoogleMap>
                </LoadScript>
                {tempAddress && (
                    <div className="address-display">
                        <span>Selected Address: {tempAddress}</span>
                    </div>
                )}
                <button
                    className="current-location-btn"
                    onClick={handleUseCurrentLocation}
                    disabled={!liveLocation}
                    aria-label="Use current location"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                    </svg>
                </button>
                <button
                    className="save-location-btn"
                    onClick={handleSaveCustomLocation}
                    disabled={!selectedLocation}
                    aria-label="Save custom location"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                </button>
                <button
                    className="close-btn"
                    onClick={onClose}
                    aria-label="Close location correction"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default LocationCorrectionModal;