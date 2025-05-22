import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api';
import { toast } from 'react-toastify';
import polyline from '@mapbox/polyline';
import { getDirections } from '../../apis/locationApi';
import './VisitDirectionsModal.css';

interface Agent {
  name: string;
  lastname: string;
}

interface Delegation {
  name: string;
}

interface DirectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  destination: { lat: number; lng: number; address: string };
  userLocation: { lat: number; lng: number } | null;
  agent: Agent | null;
  delegation: Delegation | null;
}

interface CustomDirectionsResponse {
  distance: number;
  duration: number;
  steps: Array<{ instruction: string; distance: string; duration: string }>;
  polyline: string;
}

const containerStyle = { width: '100%', height: '100vh' };
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
    { featureType: 'water', stylers: [{ color: '#0288d1' }] },
  ],
  satellite: [],
  terrain: [{ featureType: 'landscape', stylers: [{ color: '#dcedc8' }] }],
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
  const [mapCenter, setMapCenter] = useState(userLocation || defaultCenter);
  const [mapStyle, setMapStyle] = useState<keyof typeof mapStyles>('satellite');
  const mapRef = useRef<google.maps.Map | null>(null);

  // Clean HTML tags and normalize RTL text
  const cleanInstruction = (instruction: string): string => {
    const div = document.createElement('div');
    div.innerHTML = instruction;
    let text = div.textContent || div.innerText || '';
    text = text.replace(/\s+/g, ' ').trim();
    text = text.replace(/Go through \d+ roundabout/, 'Pass through roundabout');
    return text;
  };

  // Parse directions steps
  const parsedSteps = useMemo(() => {
    if (!directions?.steps) return [];
    return directions.steps.map(step => ({
      ...step,
      instruction: cleanInstruction(step.instruction),
    }));
  }, [directions]);

  // Decode polyline for route
  const routePath = useMemo(() => {
    if (!directions?.polyline) return [];
    try {
      return polyline.decode(directions.polyline).map(([lat, lng]) => ({ lat, lng }));
    } catch (err) {
      console.error('Polyline Decode Error:', err);
      return [];
    }
  }, [directions]);

  // Determine display name for header
  const displayName = useMemo(() => {
    if (agent) {
      return `${agent.name} ${agent.lastname}`.trim();
    }
    return delegation?.name || destination.address;
  }, [agent, delegation, destination.address]);

  useEffect(() => {
    if (isOpen && userLocation) {
      setMapCenter(userLocation);
    }
  }, [isOpen, userLocation]);

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

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const handleMapStyleChange = (style: keyof typeof mapStyles) => {
    setMapStyle(style);
    if (mapRef.current) {
      mapRef.current.setMapTypeId(style === 'satellite' ? 'satellite' : 'roadmap');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="map-container">
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
                  strokeColor: '#4cb1c7',
                  strokeOpacity: 0.8,
                  strokeWeight: 6,
                }}
              />
            )}
          </GoogleMap>
        </LoadScript>
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
        </div>
        <div className="route-summary">
          <div className="directions-header">
            <h3>Directions to {displayName}</h3>
            {directions && (
              <div className="route-overview">
                <span>{(directions.distance / 1000).toFixed(2)} km</span>
                <span>{(directions.duration / 60).toFixed(1)} min</span>
              </div>
            )}
          </div>
          {directions ? (
            <div className="directions-steps">
              {parsedSteps.map((step, index) => (
                <div key={index} className="step-card">
                  <div className="step-number">{index + 1}</div>
                  <div className="step-content">
                    <p className="step-instruction">{step.instruction}</p>
                    <div className="step-meta">
                      <span>{step.distance}</span>
                      <span>{step.duration}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="loading-message">Loading directions...</div>
          )}
          <button className="cancel-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DirectionsModal;