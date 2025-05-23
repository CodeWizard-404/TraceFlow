import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api';
import { toast } from 'react-toastify';
import polyline from '@mapbox/polyline';
import { getDirections } from '../../apis/locationApi';
import './VisitDirectionsModal.css';

interface DirectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  destination: { lat: number; lng: number; address: string };
  userLocation: { lat: number; lng: number } | null;
  agent: { name: string; lastname: string } | null;
  delegation: { name: string } | null;
}

interface CustomDirectionsResponse {
  distance: number;
  duration: number;
  steps: Array<{ instruction: string; distance: string; duration: string }>;
  polyline: string;
}

const containerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: 36.8065, lng: 10.1815 };
const libraries: ('places' | 'geometry')[] = ['places', 'geometry'];

const mapStyles = {
  light: [
    { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#c9c9c9' }] },
    { featureType: 'water', stylers: [{ color: '#b3e5fc' }] },
  ],
  dark: [
    { elementType: 'geometry', stylers: [{ color: '#212121' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#424242' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#616161' }] },
    { featureType: 'water', stylers: [{ color: '#808080' }] },
    { featureType: 'satellite', elementType: 'geometry', stylers: [{ visibility: 'simplified' }] },
    { featureType: 'satellite', elementType: 'labels.text.fill', stylers: [{ color: '#ffffff' }] },
  ],
  satellite: [],
  terrain: [],
  retro: [
    { elementType: 'geometry', stylers: [{ color: '#ebe3cd' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
    { featureType: 'water', stylers: [{ color: '#c9dfaf' }] },
  ],
};

const DirectionsModal: React.FC<DirectionsModalProps> = ({
  isOpen,
  onClose,
  destination,
  userLocation,
  agent,
  delegation,
}) => {
  const [directions, setDirections] = useState<CustomDirectionsResponse | null>(null);
  const [mapStyle, setMapStyle] = useState<keyof typeof mapStyles>(
    document.body.classList.contains('dark') ? 'dark' : 'light'
  );
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(true);
  const mapRef = useRef<google.maps.Map | null>(null);

  const displayName = agent
    ? `${agent.name} ${agent.lastname}`
    : delegation
      ? delegation.name
      : destination.address;

  const cleanInstruction = (instruction: string): string => {
    const div = document.createElement('div');
    div.innerHTML = instruction;
    let text = div.textContent || div.innerText || '';
    text = text.replace(/\s+/g, ' ').trim();
    text = text.replace(/Go through \d+ roundabout/, 'Pass through roundabout');
    return text;
  };

  const parsedSteps = useMemo(() => {
    if (!directions?.steps) return [];
    return directions.steps.map(step => ({
      ...step,
      instruction: cleanInstruction(step.instruction),
    }));
  }, [directions]);

  const routePath = useMemo(() => {
    if (!directions?.polyline) return [];
    try {
      return polyline.decode(directions.polyline).map(([lat, lng]) => ({ lat, lng }));
    } catch (err) {
      console.error('Polyline Decode Error:', err);
      return [];
    }
  }, [directions]);

  useEffect(() => {
    const fetchDirections = async () => {
      if (!isOpen || !userLocation) return;
      setDirections(null);
      try {
        const response = await getDirections(
          `${userLocation.lat},${userLocation.lng}`,
          `${destination.lat},${destination.lng}`,
          'driving'
        );
        setDirections(response);
      } catch (err) {
        console.error('Directions error:', err);
        toast.error('Failed to get directions');
      }
    };
    fetchDirections();
  }, [isOpen, userLocation, destination]);

  useEffect(() => {
    if (!mapRef.current || !userLocation || !destination || !routePath.length) return;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(new google.maps.LatLng(userLocation.lat, userLocation.lng));
    bounds.extend(new google.maps.LatLng(destination.lat, destination.lng));
    routePath.forEach(point => bounds.extend(new google.maps.LatLng(point.lat, point.lng)));

    mapRef.current.fitBounds(bounds, { top: 50, bottom: isSummaryCollapsed ? 50 : 200, left: 50, right: 50 });
  }, [userLocation, destination, routePath, isSummaryCollapsed]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const handleMapStyleChange = (style: keyof typeof mapStyles) => {
    setMapStyle(style);
    if (mapRef.current) {
      mapRef.current.setMapTypeId(style === 'satellite' ? 'satellite' : 'roadmap');
    }
  };

  const handleCenterRoute = () => {
    if (!mapRef.current || !userLocation || !destination || !routePath.length) return;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(new google.maps.LatLng(userLocation.lat, userLocation.lng));
    bounds.extend(new google.maps.LatLng(destination.lat, destination.lng));
    routePath.forEach(point => bounds.extend(new google.maps.LatLng(point.lat, point.lng)));

    mapRef.current.fitBounds(bounds, { top: 50, bottom: isSummaryCollapsed ? 50 : 200, left: 50, right: 50 });
  };

  const toggleSummary = () => {
    setIsSummaryCollapsed(prev => !prev);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-button" onClick={onClose} aria-label="Close modal">
          ×
        </button>
        <div className="map-frame">
          <LoadScript
            googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
            libraries={libraries}
          >
            <div className="controls-bar">
              <select
                value={mapStyle}
                onChange={(e) => handleMapStyleChange(e.target.value as keyof typeof mapStyles)}
                className="map-style-select"
                aria-label="Select map style"
              >
                {Object.keys(mapStyles).map((style) => (
                  <option key={style} value={style}>
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </option>
                ))}
              </select>
              <button
                className="action-button action-button-9"
                onClick={handleCenterRoute}
                aria-label="Center route"
              >
                Center Route
              </button>
            </div>
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={defaultCenter}
              zoom={15}
              onLoad={onMapLoad}
              options={{
                styles: mapStyles[mapStyle],
                mapTypeId: mapStyle === 'satellite' ? 'satellite' : 'roadmap',
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
                zoomControl: true,
                gestureHandling: 'greedy',
              }}
            >
              {userLocation && (
                <Marker
                  position={userLocation}
                  title="Your Location"
                  icon={{
                    url: 'https://maps.gstatic.com/mapfiles/ms2/micons/man.png',
                  }}
                />
              )}
              <Marker
                position={destination}
                title="Destination"
                icon={{
                  url: 'https://maps.gstatic.com/mapfiles/ms2/micons/red.png',
                }}
              />
              {routePath.length > 0 && (
                <Polyline
                  path={routePath}
                  options={{
                    strokeColor: document.body.classList.contains('dark') ? '#63b3ed' : '#4cb1c7',
                    strokeOpacity: 0.8,
                    strokeWeight: 6,
                  }}
                />
              )}
            </GoogleMap>
            {directions && (
              <div className={`route-summary ${isSummaryCollapsed ? 'collapsed' : ''}`}>
                <button
                  className="action-button toggle-summary-button"
                  onClick={toggleSummary}
                  aria-label={isSummaryCollapsed ? 'Expand directions' : 'Collapse directions'}
                >
                  {isSummaryCollapsed ? 'Show Directions' : 'Hide Directions'}
                </button>
                <div className="route-summary-content">
                  <h3>Directions to {displayName}</h3>
                  <p>Distance: {(directions.distance / 1000).toFixed(2)} km</p>
                  <p>Duration: {(directions.duration / 60).toFixed(1)} min</p>
                  <div className="agent-list">
                    {parsedSteps.map((step, index) => (
                      <div key={index} className="agent-card">
                        <h4>Step {index + 1}</h4>
                        <p>{step.instruction}</p>
                        <div className="agent-actions">
                          <span>{step.distance}</span>
                          <span>{step.duration}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {!directions && (
              <div className="loading-overlay">Loading directions...</div>
            )}
          </LoadScript>
        </div>
      </div>
    </div>
  );
};

export default DirectionsModal;
