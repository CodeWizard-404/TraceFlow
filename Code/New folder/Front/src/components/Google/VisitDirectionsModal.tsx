import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api';
import { toast } from 'react-toastify';
import polyline from '@mapbox/polyline';
import { getDirections } from '../../apis/locationApi';
import './VisitDirectionsModal.css';
import { mapStyles } from './mapStyles';

interface DirectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  destination: { lat: number; lng: number; address: string };
  userLocation: { lat: number; lng: number } | null;
  agent: { name: string; lastname: string } | null;
  delegation: { name: string } | null;
}

interface CustomDirectionsResponse {
  distance: number; // Distance in meters
  duration: number; // Duration in seconds
  steps: Array<{
    instruction: string;
    distance: string;
    duration: string;
    start_location: { lat: number; lng: number };
    polyline: string;
  }>;
  polyline: string;
}

const containerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: 36.8065, lng: 10.1815 };
const libraries: ('places' | 'geometry')[] = ['places', 'geometry'];

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
    document.body.classList.contains('dark') ? 'platformDark' : 'standard'
  );
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
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
    if (!directions?.polyline) {
      console.warn('No polyline available for routePath');
      return [];
    }
    try {
      const path = polyline.decode(directions.polyline).map(([lat, lng]) => ({ lat, lng }));
      console.log('Decoded routePath:', path);
      return path;
    } catch (err) {
      console.error('Polyline Decode Error:', err);
      return [];
    }
  }, [directions?.polyline]);

  const getStepHeading = (step: CustomDirectionsResponse['steps'][0]) => {
    try {
      const path = polyline.decode(step.polyline).map(([lat, lng]) => ({ lat, lng }));
      if (path.length < 2) return 0;
      const start = path[0];
      const next = path[1];
      const deltaLat = next.lat - start.lat;
      const deltaLng = next.lng - start.lng;
      const heading = (Math.atan2(deltaLng, deltaLat) * 180) / Math.PI;
      return (heading + 360) % 360; // Normalize to 0-360 degrees
    } catch (err) {
      console.error('Error calculating heading:', err);
      return 0;
    }
  };

  useEffect(() => {
    const fetchDirections = async () => {
      if (!isOpen || !userLocation || !destination) {
        console.warn('Cannot fetch directions: missing required data', { isOpen, userLocation, destination });
        return;
      }
      setDirections(null);
      setSelectedStepIndex(null);
      try {
        const response = await getDirections(
          `${userLocation.lat},${userLocation.lng}`,
          `${destination.lat},${destination.lng}`,
          'driving'
        );
        console.log('Directions API response:', response);
        if (!response.distance || !response.duration) {
          throw new Error('Invalid directions response: missing distance or duration');
        }
        setDirections({
          distance: response.distance,
          duration: response.duration,
          steps: response.steps.map(step => ({
            instruction: step.instruction,
            distance: step.distance,
            duration: step.duration,
            start_location: step.start_location,
            polyline: step.polyline,
          })),
          polyline: response.polyline,
        });
      } catch (err) {
        console.error('Directions error:', err);
        toast.error('Failed to get directions');
      }
    };
    fetchDirections();
  }, [isOpen, userLocation, destination]);

  useEffect(() => {
    if (!mapRef.current || !userLocation || !destination) return;

    if (selectedStepIndex !== null && directions?.steps[selectedStepIndex]) {
      const step = directions.steps[selectedStepIndex];
      mapRef.current.setCenter(step.start_location);
      mapRef.current.setZoom(17);
      mapRef.current.setHeading(getStepHeading(step));
    } else {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(new google.maps.LatLng(userLocation.lat, userLocation.lng));
      bounds.extend(new google.maps.LatLng(destination.lat, destination.lng));
      if (routePath.length) {
        routePath.forEach(point => bounds.extend(new google.maps.LatLng(point.lat, point.lng)));
      }
      mapRef.current.fitBounds(bounds, { top: 50, bottom: isSummaryCollapsed ? 50 : 200, left: 50, right: 50 });
    }
  }, [userLocation, destination, routePath, isSummaryCollapsed, selectedStepIndex, directions]);

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
    setSelectedStepIndex(null);
    if (!mapRef.current || !userLocation || !destination || !routePath.length) return;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(new google.maps.LatLng(userLocation.lat, userLocation.lng));
    bounds.extend(new google.maps.LatLng(destination.lat, destination.lng));
    routePath.forEach(point => bounds.extend(new google.maps.LatLng(point.lat, point.lng)));

    mapRef.current.fitBounds(bounds, { top: 50, bottom: isSummaryCollapsed ? 50 : 200, left: 50, right: 50 });
  };

  const handleStepClick = (index: number) => {
    setSelectedStepIndex(index);
  };

  const toggleSummary = () => {
    setIsSummaryCollapsed(prev => !prev);
  };

  const handleStartNavigation = () => {
    if (!userLocation || !destination || !directions?.polyline) {
      toast.error('Cannot start navigation: missing location or route data');
      return;
    }
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving&dir_action=navigate&route=${encodeURIComponent(directions.polyline)}`;
    window.open(mapsUrl, '_blank');
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
                className="map-style-select action-button"
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
              <button
                className="action-button action-button-9"
                onClick={handleStartNavigation}
                aria-label="Start navigation in Google Maps"
              >
                Start
              </button>
            </div>
            {directions ? (
              <div className={`summary-container ${isSummaryCollapsed ? 'summary-collapsed' : ''}`}>
                <button
                  className="action-button summary-toggle"
                  onClick={toggleSummary}
                  aria-label={isSummaryCollapsed ? 'Expand directions' : 'Collapse directions'}
                >
                  {isSummaryCollapsed ? 'Show Directions' : 'Hide Directions'}
                </button>
                <div className="summary-content">
                  <h3 className="summary-title">Directions to {displayName}</h3>
                  <p className="summary-info">
                    Distance: {(directions.distance).toFixed(2)} km
                  </p>
                  <p className="summary-info">
                    Duration: {Math.floor(directions.duration)} min{' '}
                    {Math.round((directions.duration % 1) * 60)} sec
                  </p>
                  <div className="steps-container">
                    {parsedSteps.map((step, index) => (
                      <div
                        key={index}
                        className={`step-item ${selectedStepIndex === index ? 'step-selected' : ''}`}
                        onClick={() => handleStepClick(index)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && handleStepClick(index)}
                        aria-label={`Step ${index + 1}: ${step.instruction}`}
                      >
                        <h4 className="step-title">Step {index + 1}</h4>
                        <p className="step-instruction">{step.instruction}</p>
                        <div className="step-details">
                          <span>{step.distance}</span>
                          <span>{step.duration}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="loading-overlay">Loading directions...</div>
            )}
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
                <>
                  {/* Shadow Polyline (thicker, semi-transparent, behind the main route) */}
                  <Polyline
                    path={routePath}
                    options={{
                      strokeColor: document.body.classList.contains('dark') ? '#1a1a1a' : '#333333', // Darker color for shadow
                      strokeOpacity: 0.5, // Semi-transparent for shadow effect
                      strokeWeight: 15, // Thicker than main line to create a "glow" or shadow
                      zIndex: 1, // Lower zIndex to place behind main route
                    }}
                  />
                  {/* Main Route Polyline */}
                  <Polyline
                    path={routePath}
                    options={{
                      strokeColor: document.body.classList.contains('dark') ? '#63b3ed' : '#4cb1c7', // Original colors for main route
                      strokeOpacity: 0.9, // Slightly more opaque for prominence
                      strokeWeight: 6, // Main route thickness
                      zIndex: 2, // Higher zIndex to place above shadow
                    }}
                  />
                </>
              )}
              {selectedStepIndex !== null && directions?.steps[selectedStepIndex] && (
                <Marker
                  position={directions.steps[selectedStepIndex].start_location}
                  title={`Step ${selectedStepIndex + 1}`}
                  icon={{
                    url: 'https://maps.gstatic.com/mapfiles/ms2/micons/lightblue.png',
                    scaledSize: new google.maps.Size(32, 32),
                  }}
                  zIndex={1000}
                />
              )}
            </GoogleMap>
          </LoadScript>
        </div>
      </div>
    </div>
  );
};

export default DirectionsModal;