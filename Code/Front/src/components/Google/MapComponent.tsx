import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoogleMap, LoadScript, InfoWindow, Polyline, MarkerClusterer, Marker, Autocomplete } from '@react-google-maps/api';
import { toast } from 'react-toastify';
import polyline from '@mapbox/polyline';
import {
  getAgentLocations, getAgentSupervisor, createAgent, getAgentById, updateAgent, correctAgentLocation,
} from '../../apis/agentAPI';
import {
  getAllRegions, getAllGovernorates, getAllDelegations, getGeocode, getDirections, searchPlaces,
} from '../../apis/locationApi';
import { getUsersByRole } from '../../apis/userAPI';
import './Map.css';

interface AgentMarker {
  id: string;
  lat: number;
  lng: number;
  name: string;
  lastname: string;
  email: string;
  phone: string;
  address: string;
  source: string;
  delegation?: { id: string; name: string };
  governorate?: { id: string; name: string };
  region?: { id: string; name: string };
  supervisor?: { userID: string; firstname: string; lastname: string };
}

interface User {
  userID: string;
  firstname: string;
  lastname: string;
}

interface CustomDirectionsResponse {
  distance: number;
  duration: number;
  steps: Array<{ polyline: { points: string } }>;
  polyline: string;
}

const containerStyle = { width: '100%', height: '50vh' };
const defaultCenter = { lat: 36.8065, lng: 10.1815 };
const libraries: ('places' | 'geometry')[] = ['places', 'geometry'];

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const deg2rad = (deg: number) => deg * (Math.PI / 180);

const MapComponent: React.FC = () => {
  const [allMarkers, setAllMarkers] = useState<AgentMarker[]>([]);
  const [filteredMarkers, setFilteredMarkers] = useState<AgentMarker[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<AgentMarker | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [zoom, setZoom] = useState(7);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterGovernorate, setFilterGovernorate] = useState('');
  const [filterDelegation, setFilterDelegation] = useState('');
  const [filterSupervisor, setFilterSupervisor] = useState('');
  const [regions, setRegions] = useState<{ regionID: string; name: string }[]>([]);
  const [governorates, setGovernorates] = useState<{ governorateID: string; name: string }[]>([]);
  const [delegations, setDelegations] = useState<{ delegationID: string; name: string }[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [newAgent, setNewAgent] = useState({ name: '', lastname: '', email: '', phone: '', supervisorID: '', delegationID: '', address: '' });
  const [editAgent, setEditAgent] = useState<Partial<any> | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [route, setRoute] = useState<CustomDirectionsResponse | null>(null);
  const [routeMode, setRouteMode] = useState<'driving' | 'walking'>('driving');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [addingAgentMode, setAddingAgentMode] = useState(false);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [draggingMarker, setDraggingMarker] = useState<{ id: string; original: AgentMarker } | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sortedMarkers = useMemo(() => {
    if (!userLocation) return filteredMarkers;
    return [...filteredMarkers].sort((a, b) =>
      calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng) -
      calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng)
    );
  }, [filteredMarkers, userLocation]);

  const routePath = useMemo(() => {
    if (!route || !route.polyline) {
      console.log('No route or polyline available:', route);
      return [];
    }
    try {
      const decodedPath = polyline.decode(route.polyline).map(([lat, lng]) => ({ lat, lng }));
      console.log('Decoded Route Path:', decodedPath);
      return decodedPath;
    } catch (err) {
      console.error('Polyline Decode Error:', err);
      return [];
    }
  }, [route]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          console.log('User Location:', { latitude, longitude });
          setUserLocation({ lat: latitude, lng: longitude });
          setMapCenter({ lat: latitude, lng: longitude });
          setZoom(15);
        },
        (error) => {
          console.error('Geolocation Error:', error);
          toast.error('Unable to get your location');
        }
      );
    } else {
      console.error('Geolocation not supported');
      toast.error('Geolocation not supported');
    }
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [regionData, governorateData, delegationData, agentLocationsData, supervisorsData] = await Promise.all([
          getAllRegions(), getAllGovernorates(), getAllDelegations(), getAgentLocations(), getUsersByRole(import.meta.env.VITE_ROLES_SUPERVISOR),
        ]);
        console.log('Initial Data:', { regionData, governorateData, delegationData, agentLocationsData, supervisorsData });
        setRegions(regionData);
        setGovernorates(governorateData);
        setDelegations(delegationData);
        setSupervisors(supervisorsData);

        const initialMarkers = agentLocationsData.locations.map(loc => ({
          id: loc.agentId,
          lat: loc.latitude,
          lng: loc.longitude,
          name: loc.name,
          lastname: loc.lastname,
          email: loc.email,
          phone: loc.phone,
          address: loc.address,
          source: loc.source,
          delegation: loc.delegation,
          governorate: loc.governorate,
          region: loc.region,
        }));
        setAllMarkers(initialMarkers);
        setFilteredMarkers(initialMarkers);
      } catch (err) {
        console.error('Initial Data Error:', err);
        toast.error(`Failed to load initial data: ${(err as Error).message}`);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery) {
      setFilteredMarkers(allMarkers);
      return;
    }
    setLoading(true);
    try {
      if (/^\d+$/.test(searchQuery)) {
        const agentMarker = allMarkers.find(m => m.phone === searchQuery);
        if (agentMarker) {
          setFilteredMarkers([agentMarker]);
          setMapCenter({ lat: agentMarker.lat, lng: agentMarker.lng });
          setZoom(15);
        } else {
          toast.error('Agent not found');
          setFilteredMarkers(allMarkers);
        }
      } else {
        const places = await searchPlaces(searchQuery + ', Tunisia');
        console.log('Search Places:', places);
        if (places.length > 0) {
          const place = places[0];
          const geocode = await getGeocode(place.name);
          console.log('Geocode Result:', geocode);
          const nearbyAgents = allMarkers.filter(m => {
            const distance = calculateDistance(geocode.latitude, geocode.longitude, m.lat, m.lng);
            return distance <= 5;
          });
          setFilteredMarkers(nearbyAgents);
          setMapCenter({ lat: geocode.latitude, lng: geocode.longitude });
          setZoom(12);
        } else {
          toast.error('No places found');
          setFilteredMarkers(allMarkers);
        }
      }
    } catch (err) {
      console.error('Search Error:', err);
      toast.error(`Search failed: ${(err as Error).message}`);
      setFilteredMarkers(allMarkers);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, allMarkers]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(handleSearch, 500);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, handleSearch]);

  const handleFilter = useCallback(() => {
    let filtered = allMarkers;
    if (filterRegion) filtered = filtered.filter(m => m.region?.id === filterRegion);
    if (filterGovernorate) filtered = filtered.filter(m => m.governorate?.id === filterGovernorate);
    if (filterDelegation) filtered = filtered.filter(m => m.delegation?.id === filterDelegation);
    if (filterSupervisor) filtered = filtered.filter(m => m.supervisor?.userID === filterSupervisor);
    setFilteredMarkers(filtered);
    if (filtered.length > 0 && mapRef.current && !draggingMarker) {
      const bounds = new window.google.maps.LatLngBounds();
      filtered.forEach(agent => bounds.extend({ lat: agent.lat, lng: agent.lng }));
      mapRef.current.fitBounds(bounds);
    }
  }, [filterRegion, filterGovernorate, filterDelegation, filterSupervisor, allMarkers, draggingMarker]);

  useEffect(() => {
    handleFilter();
  }, [filterRegion, filterGovernorate, filterDelegation, filterSupervisor, handleFilter]);

  const handleMapClick = useCallback(async (event: google.maps.MapMouseEvent) => {
    if (!addingAgentMode) return;
    setAddingAgentMode(false);
    const lat = event.latLng?.lat();
    const lng = event.latLng?.lng();
    if (lat && lng) {
      try {
        const geocode = await getGeocode(`${lat},${lng}`);
        console.log('Map Click Geocode:', geocode);
        if (!geocode.formatted_address) {
          toast.error('Unable to determine address');
          return;
        }
        setNewAgent({ ...newAgent, address: geocode.formatted_address });
        setShowAddModal(true);
      } catch (err) {
        console.error('Map Click Error:', err);
        toast.error(`Failed to get address: ${(err as Error).message}`);
      }
    }
  }, [addingAgentMode, newAgent]);

  const handleCreateAgent = useCallback(async () => {
    if (!newAgent.name || !newAgent.lastname || !newAgent.email || !newAgent.phone || !newAgent.delegationID || !newAgent.supervisorID || !newAgent.address) {
      toast.error('All fields are required');
      return;
    }
    setLoading(true);
    try {
      const geocode = await getGeocode(newAgent.address + ', Tunisia');
      console.log('Create Agent Geocode:', geocode);
      const agentData = {
        name: newAgent.name,
        lastname: newAgent.lastname,
        email: newAgent.email,
        phone: newAgent.phone,
        supervisorID: newAgent.supervisorID,
        delegationID: newAgent.delegationID,
        location: newAgent.address,
        latitude: geocode.latitude,
        longitude: geocode.longitude,
      };
      console.log('Create Agent Payload:', agentData);
      const agent = await createAgent(agentData);
      console.log('Created Agent Response:', agent);
      const newMarker: AgentMarker = {
        id: agent.agentID,
        lat: geocode.latitude,
        lng: geocode.longitude,
        name: agent.name,
        lastname: agent.lastname,
        email: agent.email,
        phone: agent.phone,
        address: geocode.formatted_address,
        source: 'agent',
        delegation: agent.Delegation ? { id: agent.Delegation.delegationID, name: agent.Delegation.name } : undefined,
      };
      setAllMarkers(prev => [...prev, newMarker]);
      setFilteredMarkers(prev => [...prev, newMarker]);
      setShowAddModal(false);
      setNewAgent({ name: '', lastname: '', email: '', phone: '', supervisorID: '', delegationID: '', address: '' });
      if (mapRef.current) {
        mapRef.current.panTo({ lat: geocode.latitude, lng: geocode.longitude });
        mapRef.current.setZoom(15);
      }
      toast.success('Agent created');
    } catch (err) {
      console.error('Create Agent Error:', err);
      toast.error(`Failed to create agent: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [newAgent]);

  const handleEditAgent = useCallback(async () => {
    if (!editAgent || !editAgent.agentID) {
      toast.error('No agent selected for editing');
      return;
    }
    setLoading(true);
    try {
      const geocode = editAgent.location ? await getGeocode(editAgent.location + ', Tunisia') : null;
      console.log('Edit Agent Geocode:', geocode);
      const agentData = {
        name: editAgent.name,
        lastname: editAgent.lastname,
        email: editAgent.email,
        phone: editAgent.phone,
        supervisorID: editAgent.supervisorID,
        delegationID: editAgent.delegationID,
        location: editAgent.location,
        latitude: geocode?.latitude,
        longitude: geocode?.longitude,
      };
      console.log('Edit Agent Payload:', agentData);
      const updated = await updateAgent(editAgent.agentID, agentData);
      console.log('Updated Agent Response:', updated);
      setAllMarkers(prev =>
        prev.map(marker =>
          marker.id === editAgent.agentID
            ? { ...marker, ...updated, address: geocode?.formatted_address || marker.address, lat: geocode?.latitude || marker.lat, lng: geocode?.longitude || marker.lng }
            : marker
        )
      );
      setFilteredMarkers(prev =>
        prev.map(marker =>
          marker.id === editAgent.agentID
            ? { ...marker, ...updated, address: geocode?.formatted_address || marker.address, lat: geocode?.latitude || marker.lat, lng: geocode?.longitude || marker.lng }
            : marker
        )
      );
      setShowEditModal(false);
      setEditAgent(null);
      if (mapRef.current && geocode) {
        mapRef.current.panTo({ lat: geocode.latitude, lng: geocode.longitude });
        mapRef.current.setZoom(15);
      }
      toast.success('Agent updated');
    } catch (err) {
      console.error('Edit Agent Error:', err);
      toast.error(`Failed to update agent: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [editAgent]);

  const handleMarkerDragStart = useCallback((markerId: string) => {
    const marker = allMarkers.find(m => m.id === markerId);
    if (marker) setDraggingMarker({ id: markerId, original: { ...marker } });
  }, [allMarkers]);

  const handleMarkerDragEnd = useCallback(async (event: google.maps.MapMouseEvent, markerId: string) => {
    const lat = event.latLng?.lat();
    const lng = event.latLng?.lng();
    if (!lat || !lng || !draggingMarker) {
      toast.error('Invalid marker position');
      return;
    }
    try {
      const geocode = await getGeocode(`${lat},${lng}`);
      console.log('Drag End Geocode:', geocode);
      if (!geocode.formatted_address) {
        toast.error('Unable to determine address');
        revertMarkerPosition(markerId);
        return;
      }
      if (window.confirm(`Update location to ${geocode.formatted_address}?`)) {
        const payload = { agentId: markerId, address: geocode.formatted_address };
        console.log('Correct Location Payload:', payload);
        const updated = await correctAgentLocation(markerId, geocode.formatted_address);
        console.log('Corrected Location Response:', updated);
        updateMarkerPosition(markerId, {
          latitude: geocode.latitude,
          longitude: geocode.longitude,
          address: geocode.formatted_address,
          delegation: updated.delegation,
        });
        if (mapRef.current) {
          mapRef.current.panTo({ lat: geocode.latitude, lng: geocode.longitude });
          mapRef.current.setZoom(15);
        }
        toast.success('Location updated');
      } else {
        revertMarkerPosition(markerId);
      }
    } catch (err) {
      console.error('Correct Location Error:', err);
      toast.error(`Failed to update location: ${(err as Error).message}`);
      revertMarkerPosition(markerId);
    } finally {
      setDraggingMarker(null);
    }
  }, [draggingMarker, allMarkers]);

  const revertMarkerPosition = (markerId: string) => {
    if (draggingMarker) {
      setAllMarkers(prev => prev.map(m => m.id === markerId ? { ...m, ...draggingMarker.original } : m));
      setFilteredMarkers(prev => prev.map(m => m.id === markerId ? { ...m, ...draggingMarker.original } : m));
    }
  };

  const updateMarkerPosition = (markerId: string, updated: any) => {
    setAllMarkers(prev =>
      prev.map(m =>
        m.id === markerId
          ? { ...m, lat: updated.latitude, lng: updated.longitude, address: updated.address, source: 'agent', delegation: updated.delegation }
          : m
      )
    );
    setFilteredMarkers(prev =>
      prev.map(m =>
        m.id === markerId
          ? { ...m, lat: updated.latitude, lng: updated.longitude, address: updated.address, source: 'agent', delegation: updated.delegation }
          : m
      )
    );
    setSelectedMarker(prev =>
      prev && prev.id === markerId
        ? { ...prev, lat: updated.latitude, lng: updated.longitude, address: updated.address, delegation: updated.delegation }
        : prev
    );
  };

  const handleGetDirections = useCallback(async (marker: AgentMarker) => {
    if (!userLocation) {
      toast.error('User location not available');
      return;
    }
    setLoading(true);
    try {
      const originCoords = `${userLocation.lat},${userLocation.lng}`;
      const destCoords = `${marker.lat},${marker.lng}`;
      console.log('Directions Request:', { origin: originCoords, destination: destCoords, mode: routeMode });
      const directions = await getDirections(originCoords, destCoords, routeMode);
      console.log('Directions Response:', directions);
      setRoute(directions);
      setOrigin(originCoords);
      setDestination(destCoords);
      if (mapRef.current) {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend({ lat: userLocation.lat, lng: userLocation.lng });
        bounds.extend({ lat: marker.lat, lng: marker.lng });
        mapRef.current.fitBounds(bounds);
      }
    } catch (err) {
      console.error('Directions Error:', err);
      toast.error(`Failed to get directions: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [userLocation, routeMode]);

  const handleCalculateRoute = useCallback(async () => {
    if (!origin || !destination) {
      toast.error('Origin and destination are required');
      return;
    }
    setLoading(true);
    try {
      console.log('Calculate Route Request:', { origin, destination, mode: routeMode });
      const directions = await getDirections(origin, destination, routeMode);
      console.log('Calculate Route Response:', directions);
      setRoute(directions);
      if (mapRef.current) {
        const bounds = new window.google.maps.LatLngBounds();
        const [originLat, originLng] = origin.split(',').map(Number);
        const [destLat, destLng] = destination.split(',').map(Number);
        bounds.extend({ lat: originLat, lng: originLng });
        bounds.extend({ lat: destLat, lng: destLng });
        mapRef.current.fitBounds(bounds);
      }
    } catch (err) {
      console.error('Calculate Route Error:', err);
      toast.error(`Failed to calculate route: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [origin, destination, routeMode]);

  const clearRoute = useCallback(() => {
    setRoute(null);
    setOrigin('');
    setDestination('');
  }, []);

  const handleReturnToCurrentLocation = useCallback(() => {
    if (!userLocation || !mapRef.current) {
      console.error('Return to Location Error: No user location or map reference');
      toast.error('User location or map not available');
      return;
    }
    console.log('Returning to User Location:', userLocation);
    mapRef.current.panTo(userLocation);
    mapRef.current.setZoom(15);
  }, [userLocation]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    console.log('Map Loaded');
  }, []);

  const MarkerList = React.memo(({ markers, onSelect, onGetDirections }: {
    markers: AgentMarker[];
    onSelect: (marker: AgentMarker) => void;
    onGetDirections: (marker: AgentMarker) => void;
  }) => (
    <div className="agent-list">
      {markers.map(marker => (
        <div key={marker.id} className="agent-card" onClick={() => onSelect(marker)}>
          <h4>{`${marker.name} ${marker.lastname}`}</h4>
          <p>{marker.address}</p>
          <button className="card-directions-btn" onClick={(e) => { e.stopPropagation(); onGetDirections(marker); }}>
            Directions
          </button>
        </div>
      ))}
    </div>
  ));

  const ControlPanel = React.memo(({ onAddAgent, onReturnToLocation }: {
    onAddAgent: () => void;
    onReturnToLocation: () => void;
  }) => (
    <div className="control-panel">
      <input type="text" placeholder="Search by name or phone" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
      <div className="filter-section">
        <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} className="filter-select">
          <option value="">All Regions</option>
          {regions.map(r => <option key={r.regionID} value={r.regionID}>{r.name}</option>)}
        </select>
        <select value={filterGovernorate} onChange={(e) => setFilterGovernorate(e.target.value)} className="filter-select">
          <option value="">All Governorates</option>
          {governorates.map(g => <option key={g.governorateID} value={g.governorateID}>{g.name}</option>)}
        </select>
        <select value={filterDelegation} onChange={(e) => setFilterDelegation(e.target.value)} className="filter-select">
          <option value="">All Delegations</option>
          {delegations.map(d => <option key={d.delegationID} value={d.delegationID}>{d.name}</option>)}
        </select>
        <select value={filterSupervisor} onChange={(e) => setFilterSupervisor(e.target.value)} className="filter-select">
          <option value="">All Supervisors</option>
          {supervisors.map(sup => <option key={sup.userID} value={sup.userID}>{`${sup.firstname} ${sup.lastname}`}</option>)}
        </select>
      </div>
      <div className="route-section">
        <input type="text" placeholder="Origin" value={origin} onChange={(e) => setOrigin(e.target.value)} className="route-input" />
        <button onClick={() => userLocation && setOrigin(`${userLocation.lat},${userLocation.lng}`)} className="route-btn">My Location</button>
        <input type="text" placeholder="Destination" value={destination} onChange={(e) => setDestination(e.target.value)} className="route-input" />
        <select value={routeMode} onChange={(e) => setRouteMode(e.target.value as 'driving' | 'walking')} className="route-select">
          <option value="driving">Driving</option>
          <option value="walking">Walking</option>
        </select>
        <button onClick={handleCalculateRoute} className="route-btn">Get Directions</button>
        <button onClick={clearRoute} className="clear-btn">Clear</button>
      </div>
      <button onClick={onAddAgent} className="add-agent-btn">Add Agent</button>
      <button onClick={onReturnToLocation} className="return-location-btn" disabled={!userLocation}>Return to My Location</button>
    </div>
  ));

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="map-container">
      <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY} libraries={libraries}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={mapCenter}
          zoom={zoom}
          onLoad={onMapLoad}
          onClick={handleMapClick}
          onBoundsChanged={() => console.log('Map Bounds Changed:', mapRef.current?.getBounds())}
        >
          <MarkerClusterer>
            {(clusterer: any) => (
              <>
                {filteredMarkers.map(marker => (
                  <Marker
                    key={marker.id}
                    position={{ lat: marker.lat, lng: marker.lng }}
                    title={`${marker.name} ${marker.lastname}`}
                    icon={{
                      url: marker.source === 'agent' ? 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' : 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
                      scaledSize: new window.google.maps.Size(32, 32),
                    }}
                    draggable={true}
                    onDragStart={() => handleMarkerDragStart(marker.id)}
                    onDragEnd={(e) => handleMarkerDragEnd(e, marker.id)}
                    onClick={async () => {
                      try {
                        const agent = await getAgentById(marker.id);
                        const supervisor = await getAgentSupervisor(marker.id).catch(() => null);
                        console.log('Agent Details:', { agent, supervisor });
                        setSelectedMarker({
                          ...marker,
                          supervisor: supervisor ? { userID: supervisor.userID, firstname: supervisor.firstname, lastname: supervisor.lastname } : undefined,
                        });
                        setEditAgent({
                          agentID: agent?.agentID,
                          name: agent?.name,
                          lastname: agent?.lastname,
                          email: agent?.email,
                          phone: agent?.phone,
                          location: agent?.location,
                          delegationID: agent?.delegationID,
                          supervisorID: agent?.supervisorID,
                        });
                      } catch (err) {
                        console.error('Agent Details Error:', err);
                        toast.error(`Failed to fetch agent details: ${(err as Error).message}`);
                      }
                    }}
                    clusterer={clusterer}
                  />
                ))}
                {userLocation && (
                  <Marker
                    position={userLocation}
                    title="Your Location"
                    icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png', scaledSize: new window.google.maps.Size(32, 32) }}
                  />
                )}
              </>
            )}
          </MarkerClusterer>
          {selectedMarker && (
            <InfoWindow position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }} onCloseClick={() => setSelectedMarker(null)}>
              <div className="info-window">
                <h3>{`${selectedMarker.name} ${selectedMarker.lastname}`}</h3>
                <p><strong>Email:</strong> {selectedMarker.email || 'N/A'}</p>
                <p><strong>Phone:</strong> {selectedMarker.phone || 'N/A'}</p>
                <p><strong>Address:</strong> {selectedMarker.address || 'N/A'}</p>
                <p><strong>Supervisor:</strong> {selectedMarker.supervisor ? `${selectedMarker.supervisor.firstname} ${selectedMarker.supervisor.lastname}` : 'None'}</p>
                <button className="edit-btn" onClick={() => setShowEditModal(true)}>Edit</button>
                <button className="get-directions-btn" onClick={() => handleGetDirections(selectedMarker)}>Get Directions</button>
              </div>
            </InfoWindow>
          )}
          {routePath.length > 0 && (
            <Polyline path={routePath} options={{ strokeColor: '#4285F4', strokeOpacity: 0.8, strokeWeight: 6 }} />
          )}
        </GoogleMap>
      </LoadScript>
      <ControlPanel onAddAgent={() => setAddingAgentMode(true)} onReturnToLocation={handleReturnToCurrentLocation} />
      <MarkerList
        markers={sortedMarkers}
        onSelect={(marker) => {
          setSelectedMarker(marker);
          setMapCenter({ lat: marker.lat, lng: marker.lng });
          setZoom(15);
        }}
        onGetDirections={handleGetDirections}
      />
      {showAddModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Add New Agent</h2>
            <input
              type="text"
              placeholder="Name"
              value={newAgent.name}
              onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
              className="modal-input"
            />
            <input
              type="text"
              placeholder="Last Name"
              value={newAgent.lastname}
              onChange={(e) => setNewAgent({ ...newAgent, lastname: e.target.value })}
              className="modal-input"
            />
            <input
              type="email"
              placeholder="Email"
              value={newAgent.email}
              onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })}
              className="modal-input"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={newAgent.phone}
              onChange={(e) => setNewAgent({ ...newAgent, phone: e.target.value })}
              className="modal-input"
            />
            <select
              value={newAgent.supervisorID}
              onChange={(e) => setNewAgent({ ...newAgent, supervisorID: e.target.value })}
              className="modal-select"
            >
              <option value="">Select Supervisor</option>
              {supervisors.map(sup => (
                <option key={sup.userID} value={sup.userID}>{`${sup.firstname} ${sup.lastname}`}</option>
              ))}
            </select>
            <select
              value={newAgent.delegationID}
              onChange={(e) => setNewAgent({ ...newAgent, delegationID: e.target.value })}
              className="modal-select"
            >
              <option value="">Select Delegation</option>
              {delegations.map(d => (
                <option key={d.delegationID} value={d.delegationID}>{d.name}</option>
              ))}
            </select>
            <Autocomplete
              onLoad={setAutocomplete}
              onPlaceChanged={() => {
                if (autocomplete) setNewAgent({ ...newAgent, address: autocomplete.getPlace().formatted_address || '' });
              }}
              options={{ componentRestrictions: { country: 'tn' } }}
            >
              <input
                type="text"
                placeholder="Address"
                value={newAgent.address}
                onChange={(e) => setNewAgent({ ...newAgent, address: e.target.value })}
                className="modal-input"
              />
            </Autocomplete>
            <button onClick={handleCreateAgent} className="modal-btn">Create</button>
            <button onClick={() => setShowAddModal(false)} className="modal-cancel-btn">Cancel</button>
          </div>
        </div>
      )}
      {showEditModal && editAgent && (
        <div className="modal">
          <div className="modal-content">
            <h2>Edit Agent</h2>
            <input
              type="text"
              placeholder="Name"
              value={editAgent.name || ''}
              onChange={(e) => setEditAgent({ ...editAgent, name: e.target.value })}
              className="modal-input"
            />
            <input
              type="text"
              placeholder="Last Name"
              value={editAgent.lastname || ''}
              onChange={(e) => setEditAgent({ ...editAgent, lastname: e.target.value })}
              className="modal-input"
            />
            <input
              type="email"
              placeholder="Email"
              value={editAgent.email || ''}
              onChange={(e) => setEditAgent({ ...editAgent, email: e.target.value })}
              className="modal-input"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={editAgent.phone || ''}
              onChange={(e) => setEditAgent({ ...editAgent, phone: e.target.value })}
              className="modal-input"
            />
            <Autocomplete
              onLoad={setAutocomplete}
              onPlaceChanged={() => {
                if (autocomplete) setEditAgent({ ...editAgent, location: autocomplete.getPlace().formatted_address || '' });
              }}
              options={{ componentRestrictions: { country: 'tn' } }}
            >
              <input
                type="text"
                placeholder="Address"
                value={editAgent.location || ''}
                onChange={(e) => setEditAgent({ ...editAgent, location: e.target.value })}
                className="modal-input"
              />
            </Autocomplete>
            <button onClick={handleEditAgent} className="modal-btn">Update</button>
            <button onClick={() => setShowEditModal(false)} className="modal-cancel-btn">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;