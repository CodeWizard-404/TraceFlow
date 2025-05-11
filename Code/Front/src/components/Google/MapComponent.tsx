import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoogleMap, LoadScript, InfoWindow, Polyline, MarkerClusterer, Marker } from '@react-google-maps/api';
import { toast } from 'react-toastify';
import polyline from '@mapbox/polyline';
import {
  getAgentLocations, getAgentsByDelegation, getAgentSupervisor, getAgentsByUser, createAgent,
  getAllAgents, getAgentById, updateAgent, getNearbyAgents, correctAgentLocation,
  getAgentByPhone, getAgentsByBounds,
} from '../../apis/agentAPI';
import {
  getAllRegions, getAllGovernorates, getAllDelegations, getDelegationsByGovernorate,
  getGovernoratesByRegion, getGeocode, getDirections, getGovernoratesByDelegation,
  searchPlaces, getDistanceMatrix,
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
  delegation?: { delegationID: string; name: string; Governorate?: { governorateID: string; name: string } };
  governorate?: { governorateID: string; name: string };
  region?: { regionID: string; name: string };
  supervisor?: { userID: string; firstname: string; lastname: string };
}

interface ExtendedDirectionsResponse {
  routes: Array<{
    legs: Array<{
      distance: { text: string; value: number };
      duration: { text: string; value: number };
      start_address: string;
      end_address: string;
      steps: Array<{ polyline: { points: string }; instructions: string; distance: { text: string; value: number } }>;
    }>;
  }>;
}

interface User {
  userID: string;
  firstname: string;
  lastname: string;
}

const containerStyle = { width: '100%', height: '100vh' };
const defaultCenter = { lat: 36.8065, lng: 10.1815 };
const libraries: ('places' | 'geometry')[] = ['places', 'geometry'];

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const deg2rad = (deg: number) => deg * (Math.PI / 180);

interface MapDisplayProps {
  center: { lat: number; lng: number };
  zoom: number;
  markers: AgentMarker[];
  selectedMarker: AgentMarker | null;
  route: ExtendedDirectionsResponse | null;
  onMapLoad: (map: google.maps.Map) => void;
  onMapClick: (event: google.maps.MapMouseEvent) => void;
  onMarkerDragEnd: (event: google.maps.MapMouseEvent, markerId: string) => void;
  setSelectedMarker: (marker: AgentMarker | null) => void;
  setEditAgent: (agent: Partial<any> | null) => void;
  userLocation: { lat: number; lng: number } | null;
  handleGetDirections: (marker: AgentMarker) => void;
}

const MapDisplay = React.memo(
  ({
    center, zoom, markers, selectedMarker, route, onMapLoad, onMapClick, onMarkerDragEnd,
    setSelectedMarker, setEditAgent, userLocation, handleGetDirections,
  }: MapDisplayProps) => {
    if (!window.google) return <div className="loading">Loading Google Maps...</div>;

    return (
      <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={zoom} onLoad={onMapLoad} onClick={onMapClick}>
        <MarkerClusterer>
          {(clusterer: any) => (
            <>
              {markers.map(marker => (
                <Marker
                  key={marker.id}
                  position={{ lat: marker.lat, lng: marker.lng }}
                  title={`${marker.name} ${marker.lastname}`}
                  icon={{
                    url: marker.source !== 'agent' ? 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png' : 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
                    scaledSize: new window.google.maps.Size(32, 32),
                  }}
                  draggable={true}
                  onDragEnd={(e: google.maps.MapMouseEvent) => onMarkerDragEnd(e, marker.id)}
                  onClick={async () => {
                    try {
                      const agent = await getAgentById(marker.id);
                      const supervisor = await getAgentSupervisor(marker.id).catch(() => null);
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
                    } catch (error) {
                      toast.error(`Failed to fetch agent details: ${(error as Error).message}`);
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
              <p><strong>Supervisor:</strong> {selectedMarker.supervisor ? `${selectedMarker.supervisor.firstname} ${selectedMarker.supervisor.lastname}` : 'No Supervisor'}</p>
              <button className="get-directions-btn" onClick={() => handleGetDirections(selectedMarker)}>Get Directions</button>
            </div>
          </InfoWindow>
        )}
        {route?.routes?.[0] && (
          <Polyline
            path={route.routes[0].legs.flatMap(leg => leg.steps.flatMap(step => decodePolyline(step.polyline.points)))}
            options={{ strokeColor: '#4285F4', strokeOpacity: 0.8, strokeWeight: 6 }}
          />
        )}
      </GoogleMap>
    );
  }
);

const MapComponent: React.FC = () => {
  const [markers, setMarkers] = useState<AgentMarker[]>([]);
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
  const [route, setRoute] = useState<ExtendedDirectionsResponse | null>(null);
  const [routeMode, setRouteMode] = useState<'driving' | 'walking'>('driving');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [waypoints, setWaypoints] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [addingAgentMode, setAddingAgentMode] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const memoizedMarkers = useMemo(() => markers, [markers]);
  const sortedMarkers = useMemo(() => {
    if (!userLocation) return memoizedMarkers;
    return [...memoizedMarkers].sort((a, b) => calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng) - calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng));
  }, [memoizedMarkers, userLocation]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setMapCenter({ lat: latitude, lng: longitude });
          setZoom(15);
        },
        (error) => toast.error('Unable to get your location')
      );
    }
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [regionData, governorateData, delegationData, allAgents, supervisorsData] = await Promise.all([
          getAllRegions(), getAllGovernorates(), getAllDelegations(), getAllAgents(), getUsersByRole('supervisor'),
        ]);
        setRegions(regionData);
        setGovernorates(governorateData);
        setDelegations(delegationData);
        setSupervisors(supervisorsData);
        const initialMarkers = allAgents.agents.map(agent => ({
          id: agent.agentID,
          lat: agent.latitude || defaultCenter.lat,
          lng: agent.longitude || defaultCenter.lng,
          name: agent.name,
          lastname: agent.lastname,
          email: agent.email,
          phone: agent.phone,
          address: agent.location || 'Unknown',
          source: 'agent',
          delegation: agent.Delegation ? { delegationID: agent.Delegation.delegationID, name: agent.Delegation.name, Governorate: agent.Delegation.Governorate } : undefined,
        }));
        setMarkers(initialMarkers);
        await loadAgentLocations();
      } catch (err) {
        toast.error(`Failed to load initial data: ${(err as Error).message}`);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const loadAgentLocations = useCallback(async () => {
    setLoading(true);
    try {
      const locations = await getAgentLocations();
      const newMarkers = locations.locations.map(loc => ({
        id: loc.agentId,
        lat: loc.latitude,
        lng: loc.longitude,
        name: loc.name,
        lastname: loc.lastname,
        email: loc.email,
        phone: loc.phone,
        address: loc.address,
        source: loc.source,
        delegation: loc.delegation
          ? {
            delegationID: loc.delegation.id,
            name: loc.delegation.name,
            Governorate: loc.governorate
              ? { governorateID: loc.governorate.id, name: loc.governorate.name }
              : undefined,
          }
          : undefined,
      }));
      setMarkers(prev => JSON.stringify(prev) === JSON.stringify(newMarkers) ? prev : newMarkers);
    } catch (err) {
      toast.error(`Failed to load agent locations: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery) {
      await loadAgentLocations();
      return;
    }
    setLoading(true);
    try {
      const agentByPhone = await getAgentByPhone(searchQuery).catch(() => null);
      if (agentByPhone) {
        setMarkers([{
          id: agentByPhone.agentID,
          lat: agentByPhone.latitude || defaultCenter.lat,
          lng: agentByPhone.longitude || defaultCenter.lng,
          name: agentByPhone.name,
          lastname: agentByPhone.lastname,
          email: agentByPhone.email,
          phone: agentByPhone.phone,
          address: agentByPhone.location || 'Unknown',
          source: 'agent',
          delegation: agentByPhone.Delegation ? { delegationID: agentByPhone.Delegation.delegationID, name: agentByPhone.Delegation.name, Governorate: agentByPhone.Delegation.Governorate } : undefined,
        }]);
        setMapCenter({ lat: agentByPhone.latitude || defaultCenter.lat, lng: agentByPhone.longitude || defaultCenter.lng });
        setZoom(15);
      } else {
        const places = await searchPlaces(searchQuery);
        const geocode = await getGeocode(places[0]?.name || `${searchQuery}, Tunisia`);
        const nearbyAgents = await getNearbyAgents(geocode.latitude, geocode.longitude, 5000);
        const nearbyMarkers = nearbyAgents.map(agent => ({
          id: agent.agentID,
          lat: agent.latitude || geocode.latitude,
          lng: agent.longitude || geocode.longitude,
          name: agent.name,
          lastname: agent.lastname,
          email: agent.email,
          phone: agent.phone,
          address: agent.location || geocode.formatted_address,
          source: 'agent',
          delegation: agent.Delegation ? { delegationID: agent.Delegation.delegationID, name: agent.Delegation.name, Governorate: agent.Delegation.Governorate } : undefined,
        }));
        setMarkers(nearbyMarkers);
        setMapCenter({ lat: geocode.latitude, lng: geocode.longitude });
        setZoom(12);
      }
    } catch (err) {
      toast.error(`Search failed: ${(err as Error).message}`);
      await loadAgentLocations();
    } finally {
      setLoading(false);
    }
  }, [searchQuery, loadAgentLocations]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(handleSearch, 500);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, handleSearch]);

  const handleFilter = useCallback(async () => {
    setLoading(true);
    try {
      let filteredAgents: AgentMarker[] = [];
      if (filterSupervisor) {
        const agents = await getAgentsByUser(filterSupervisor);
        filteredAgents = agents.agents.map(agent => ({
          id: agent.agentID,
          lat: agent.latitude || defaultCenter.lat,
          lng: agent.longitude || defaultCenter.lng,
          name: agent.name,
          lastname: agent.lastname,
          email: agent.email,
          phone: agent.phone,
          address: agent.location || 'Unknown',
          source: 'agent',
          delegation: agent.Delegation ? { delegationID: agent.Delegation.delegationID, name: agent.Delegation.name, Governorate: agent.Delegation.Governorate } : undefined,
        }));
      } else if (filterDelegation) {
        const agents = await getAgentsByDelegation(filterDelegation);
        filteredAgents = agents.agents.map(agent => ({
          id: agent.agentID,
          lat: agent.latitude || defaultCenter.lat,
          lng: agent.longitude || defaultCenter.lng,
          name: agent.name,
          lastname: agent.lastname,
          email: agent.email,
          phone: agent.phone,
          address: agent.location || 'Unknown',
          source: 'agent',
          delegation: agent.Delegation ? { delegationID: agent.Delegation.delegationID, name: agent.Delegation.name, Governorate: agent.Delegation.Governorate } : undefined,
        }));
      } else if (filterGovernorate) {
        const delegations = await getDelegationsByGovernorate(filterGovernorate);
        const agentsPromises = delegations.map(d => getAgentsByDelegation(d.delegationID));
        const agentsArrays = await Promise.all(agentsPromises);
        filteredAgents = agentsArrays.flatMap(a => a.agents).map(agent => ({
          id: agent.agentID,
          lat: agent.latitude || defaultCenter.lat,
          lng: agent.longitude || defaultCenter.lng,
          name: agent.name,
          lastname: agent.lastname,
          email: agent.email,
          phone: agent.phone,
          address: agent.location || 'Unknown',
          source: 'agent',
          delegation: agent.Delegation ? { delegationID: agent.Delegation.delegationID, name: agent.Delegation.name, Governorate: agent.Delegation.Governorate } : undefined,
        }));
      } else if (filterRegion) {
        const governorates = await getGovernoratesByRegion(filterRegion);
        const delegationsPromises = governorates.map(g => getDelegationsByGovernorate(g.governorateID));
        const delegationsArrays = await Promise.all(delegationsPromises);
        const agentsPromises = delegationsArrays.flat().map(d => getAgentsByDelegation(d.delegationID));
        const agentsArrays = await Promise.all(agentsPromises);
        filteredAgents = agentsArrays.flatMap(a => a.agents).map(agent => ({
          id: agent.agentID,
          lat: agent.latitude || defaultCenter.lat,
          lng: agent.longitude || defaultCenter.lng,
          name: agent.name,
          lastname: agent.lastname,
          email: agent.email,
          phone: agent.phone,
          address: agent.location || 'Unknown',
          source: 'agent',
          delegation: agent.Delegation ? { delegationID: agent.Delegation.delegationID, name: agent.Delegation.name, Governorate: agent.Delegation.Governorate } : undefined,
        }));
      } else {
        await loadAgentLocations();
        return;
      }
      setMarkers(filteredAgents);
      if (filteredAgents.length > 0 && mapRef.current) {
        const bounds = new window.google.maps.LatLngBounds();
        filteredAgents.forEach(agent => bounds.extend({ lat: agent.lat, lng: agent.lng }));
        mapRef.current.fitBounds(bounds);
      }
    } catch (err) {
      toast.error(`Filtering failed: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [filterRegion, filterGovernorate, filterDelegation, filterSupervisor, loadAgentLocations]);

  useEffect(() => {
    if (filterRegion) getGovernoratesByRegion(filterRegion).then(setGovernorates).catch(err => toast.error(`Failed to load governorates: ${err.message}`));
    else getAllGovernorates().then(setGovernorates).catch(err => toast.error(`Failed to load governorates: ${err.message}`));
  }, [filterRegion]);

  useEffect(() => {
    if (filterGovernorate) getDelegationsByGovernorate(filterGovernorate).then(setDelegations).catch(err => toast.error(`Failed to load delegations: ${err.message}`));
    else getAllDelegations().then(setDelegations).catch(err => toast.error(`Failed to load delegations: ${err.message}`));
  }, [filterGovernorate]);

  const handleMapClick = useCallback(async (event: google.maps.MapMouseEvent) => {
    if (!addingAgentMode) return;
    setAddingAgentMode(false);
    const lat = event.latLng?.lat();
    const lng = event.latLng?.lng();
    if (lat && lng) {
      try {
        const geocode = await getGeocode(`${lat},${lng}`);
        setNewAgent({ ...newAgent, address: geocode.formatted_address });
        setShowAddModal(true);
      } catch (err) {
        toast.error(`Failed to get address: ${(err as Error).message}`);
      }
    }
  }, [addingAgentMode, newAgent]);

  const handleCreateAgent = useCallback(async () => {
    if (!newAgent.name || !newAgent.lastname || !newAgent.email || !newAgent.phone || !newAgent.delegationID || !newAgent.supervisorID) {
      toast.error('All fields are required');
      return;
    }
    setLoading(true);
    try {
      const geocode = await getGeocode(newAgent.address + ', Tunisia');
      const agent = await createAgent({ ...newAgent, latitude: geocode.latitude, longitude: geocode.longitude });
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
        delegation: agent.Delegation ? { delegationID: agent.Delegation.delegationID, name: agent.Delegation.name, Governorate: agent.Delegation.Governorate } : undefined,
      };
      setMarkers(prev => [...prev, newMarker]);
      setShowAddModal(false);
      setNewAgent({ name: '', lastname: '', email: '', phone: '', supervisorID: '', delegationID: '', address: '' });
      toast.success('Agent created');
    } catch (err) {
      toast.error(`Failed to create agent: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [newAgent]);

  const handleEditAgent = useCallback(async () => {
    if (!editAgent || !editAgent.agentID) return;
    setLoading(true);
    try {
      const updated = await updateAgent(editAgent.agentID, editAgent);
      const geocode = editAgent.location ? await getGeocode(editAgent.location + ', Tunisia') : null;
      setMarkers(prev =>
        prev.map(marker =>
          marker.id === editAgent.agentID
            ? {
              ...marker,
              name: updated.name,
              lastname: updated.lastname,
              email: updated.email,
              phone: updated.phone,
              address: geocode?.formatted_address || marker.address,
              lat: geocode?.latitude || marker.lat,
              lng: geocode?.longitude || marker.lng,
              delegation: updated.Delegation ? { delegationID: updated.Delegation.delegationID, name: updated.Delegation.name, Governorate: updated.Delegation.Governorate } : marker.delegation,
            }
            : marker
        )
      );
      setShowEditModal(false);
      setEditAgent(null);
      toast.success('Agent updated');
    } catch (err) {
      toast.error(`Failed to update agent: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [editAgent]);

  const handleMarkerDragEnd = useCallback(async (event: google.maps.MapMouseEvent, markerId: string) => {
    const lat = event.latLng?.lat();
    const lng = event.latLng?.lng();
    if (lat && lng) {
      try {
        const geocode = await getGeocode(`${lat},${lng}`);
        if (window.confirm(`Update agent location to ${geocode.formatted_address}?`)) {
          const updated = await correctAgentLocation(markerId, geocode.formatted_address);
          const governorate = updated.delegation ? await getGovernoratesByDelegation(updated.delegation.id) : undefined;
          setMarkers(prev =>
            prev.map(marker =>
              marker.id === markerId
                ? {
                  ...marker,
                  lat: updated.latitude,
                  lng: updated.longitude,
                  address: updated.address,
                  delegation: updated.delegation ? { delegationID: updated.delegation.id, name: updated.delegation.name, Governorate: governorate?.[0] } : marker.delegation,
                }
                : marker
            )
          );
          toast.success('Agent location updated');
        }
      } catch (err) {
        toast.error(`Failed to update location: ${(err as Error).message}`);
      }
    }
  }, []);

  const handleGetDirections = useCallback(async (marker: AgentMarker) => {
    if (!userLocation) {
      toast.error('User location not available');
      return;
    }
    setLoading(true);
    try {
      const originCoords = `${userLocation.lat},${userLocation.lng}`;
      const destCoords = `${marker.lat},${marker.lng}`;
      const directions = await getDirections(originCoords, destCoords, routeMode);
      const distanceMatrix = await getDistanceMatrix([originCoords], [destCoords], routeMode);
      setRoute(directions as ExtendedDirectionsResponse);
      setOrigin(originCoords);
      setDestination(destCoords);
      toast.success(`Distance: ${distanceMatrix[0].elements[0].distance.text}, Duration: ${distanceMatrix[0].elements[0].duration.text}`);
    } catch (err) {
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
      const directions = await getDirections(origin, destination, routeMode);
      setRoute(directions as ExtendedDirectionsResponse);
    } catch (err) {
      toast.error(`Failed to calculate route: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [origin, destination, routeMode]);

  const clearRoute = useCallback(() => {
    setRoute(null);
    setOrigin('');
    setDestination('');
    setWaypoints([]);
  }, []);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    map.addListener('bounds_changed', () => {
      const bounds = map.getBounds();
      if (bounds) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        getAgentsByBounds(sw.lat(), sw.lng(), ne.lat(), ne.lng()).then(agents =>
          setMarkers(agents.map(agent => ({
            id: agent.agentID,
            lat: agent.latitude || defaultCenter.lat,
            lng: agent.longitude || defaultCenter.lng,
            name: agent.name,
            lastname: agent.lastname,
            email: agent.email,
            phone: agent.phone,
            address: agent.location || 'Unknown',
            source: 'agent',
            delegation: agent.Delegation ? { delegationID: agent.Delegation.delegationID, name: agent.Delegation.name, Governorate: agent.Delegation.Governorate } : undefined,
          })))
        ).catch(err => toast.error(`Failed to load agents by bounds: ${err.message}`));
      }
    });
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="map-container">
      <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY} libraries={libraries}>
        <MapDisplay
          center={mapCenter}
          zoom={zoom}
          markers={memoizedMarkers}
          selectedMarker={selectedMarker}
          route={route}
          onMapLoad={onMapLoad}
          onMapClick={handleMapClick}
          onMarkerDragEnd={handleMarkerDragEnd}
          setSelectedMarker={setSelectedMarker}
          setEditAgent={setEditAgent}
          userLocation={userLocation}
          handleGetDirections={handleGetDirections}
        />
      </LoadScript>
      <div className="control-panel">
        <input
          type="text"
          placeholder="Search by name or phone"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
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
            {supervisors.length ? supervisors.map(sup => (
              <option key={sup.userID} value={sup.userID}>{`${sup.firstname} ${sup.lastname}`}</option>
            )) : <option value="" disabled>No Supervisor</option>}
          </select>
          <button onClick={handleFilter} className="filter-btn">Apply Filters</button>
        </div>
        <div className="route-section">
          <input type="text" placeholder="Origin" value={origin} onChange={(e) => setOrigin(e.target.value)} className="route-input" />
          <button onClick={() => userLocation && setOrigin(`${userLocation.lat},${userLocation.lng}`)} className="route-btn">My Location</button>
          <input type="text" placeholder="Destination" value={destination} onChange={(e) => setDestination(e.target.value)} className="route-input" />
          <input
            type="text"
            placeholder="Add Waypoint"
            onKeyPress={(e) => e.key === 'Enter' && setWaypoints([...waypoints, e.currentTarget.value])}
            className="route-input"
          />
          <select value={routeMode} onChange={(e) => setRouteMode(e.target.value as 'driving' | 'walking')} className="route-select">
            <option value="driving">Driving</option>
            <option value="walking">Walking</option>
          </select>
          <button onClick={handleCalculateRoute} className="route-btn">Get Directions</button>
          <button onClick={clearRoute} className="clear-btn">Clear</button>
        </div>
        <button onClick={() => setAddingAgentMode(true)} className="add-agent-btn">Add Agent</button>
      </div>
      <div className="agent-list">
        {sortedMarkers.map(marker => (
          <div key={marker.id} className="agent-card" onClick={() => {
            setSelectedMarker(marker);
            setMapCenter({ lat: marker.lat, lng: marker.lng });
            setZoom(15);
          }}>
            <h4>{`${marker.name} ${marker.lastname}`}</h4>
            <p>{marker.address}</p>
            <button className="card-directions-btn" onClick={(e) => { e.stopPropagation(); handleGetDirections(marker); }}>Directions</button>
          </div>
        ))}
      </div>
      {showAddModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Add New Agent</h2>
            <input type="text" placeholder="Name" value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} className="modal-input" />
            <input type="text" placeholder="Last Name" value={newAgent.lastname} onChange={(e) => setNewAgent({ ...newAgent, lastname: e.target.value })} className="modal-input" />
            <input type="email" placeholder="Email" value={newAgent.email} onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })} className="modal-input" />
            <input type="tel" placeholder="Phone" value={newAgent.phone} onChange={(e) => setNewAgent({ ...newAgent, phone: e.target.value })} className="modal-input" />
            <select value={newAgent.supervisorID} onChange={(e) => setNewAgent({ ...newAgent, supervisorID: e.target.value })} className="modal-select">
              <option value="">Select Supervisor</option>
              {supervisors.length ? supervisors.map(sup => (
                <option key={sup.userID} value={sup.userID}>{`${sup.firstname} ${sup.lastname}`}</option>
              )) : <option value="" disabled>No Supervisor</option>}
            </select>
            <select value={newAgent.delegationID} onChange={(e) => setNewAgent({ ...newAgent, delegationID: e.target.value })} className="modal-select">
              <option value="">Select Delegation</option>
              {delegations.map(d => <option key={d.delegationID} value={d.delegationID}>{d.name}</option>)}
            </select>
            <input type="text" placeholder="Address" value={newAgent.address} onChange={(e) => setNewAgent({ ...newAgent, address: e.target.value })} className="modal-input" />
            <button onClick={handleCreateAgent} className="modal-btn">Create</button>
            <button onClick={() => setShowAddModal(false)} className="modal-cancel-btn">Cancel</button>
          </div>
        </div>
      )}
      {showEditModal && editAgent && (
        <div className="modal">
          <div className="modal-content">
            <h2>Edit Agent</h2>
            <input type="text" placeholder="Name" value={editAgent.name || ''} onChange={(e) => setEditAgent({ ...editAgent, name: e.target.value })} className="modal-input" />
            <input type="text" placeholder="Last Name" value={editAgent.lastname || ''} onChange={(e) => setEditAgent({ ...editAgent, lastname: e.target.value })} className="modal-input" />
            <input type="email" placeholder="Email" value={editAgent.email || ''} onChange={(e) => setEditAgent({ ...editAgent, email: e.target.value })} className="modal-input" />
            <input type="tel" placeholder="Phone" value={editAgent.phone || ''} onChange={(e) => setEditAgent({ ...editAgent, phone: e.target.value })} className="modal-input" />
            <input type="text" placeholder="Address" value={editAgent.location || ''} onChange={(e) => setEditAgent({ ...editAgent, location: e.target.value })} className="modal-input" />
            <button onClick={handleEditAgent} className="modal-btn">Update</button>
            <button onClick={() => setShowEditModal(false)} className="modal-cancel-btn">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

function decodePolyline(encoded: string): google.maps.LatLngLiteral[] {
  return polyline.decode(encoded).map(([lat, lng]: [number, number]) => ({ lat, lng }));
}

export default MapComponent;