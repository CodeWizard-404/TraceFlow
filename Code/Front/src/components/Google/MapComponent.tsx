import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  GoogleMap,
  LoadScript,
  InfoWindow,
  Polyline,
  MarkerClusterer,
  Marker,
  Autocomplete,
} from '@react-google-maps/api';
import { toast } from 'react-toastify';
import polyline from '@mapbox/polyline';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  getAgentLocations,
  getAgentSupervisor,
  createAgent,
  getAgentById,
  updateAgent,
  correctAgentLocation,
} from '../../apis/agentAPI';
import {
  getAllRegions,
  getAllGovernorates,
  getAllDelegations,
  getGeocode,
  getDirections,
  getGovernoratesByUser,
  getDelegationsByUser,
} from '../../apis/locationApi';
import { getUsersByRole } from '../../apis/userAPI';
import './Map.css';

// Define route point type for unified list
interface RoutePoint {
  id: string; // Unique ID for drag-and-drop
  location: string; // Coordinate string (lat,lng)
  address: string; // Formatted address for display
  type: 'origin' | 'waypoint' | 'destination'; // Type of point
}

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
  delegation?: { id: string; name: string; governorateID?: string };
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
  steps: Array<{ instruction: string; distance: string; duration: string }>;
  polyline: string;
  waypointOrder?: number[]; // Optimized order of waypoints
  mock?: boolean;
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
  terrain: [],
  retro: [
    { elementType: 'geometry', stylers: [{ color: '#ebe3cd' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
    { featureType: 'water', stylers: [{ color: '#c9dfaf' }] },
  ],
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const deg2rad = (deg: number) => deg * (Math.PI / 180);

const MapComponent: React.FC = () => {
  const [allMarkers, setAllMarkers] = useState<AgentMarker[]>([]);
  const [filteredMarkers, setFilteredMarkers] = useState<AgentMarker[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<AgentMarker | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [zoom, setZoom] = useState(7);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterGovernorate, setFilterGovernorate] = useState('');
  const [filterDelegation, setFilterDelegation] = useState('');
  const [filterSupervisor, setFilterSupervisor] = useState('');
  const [regions, setRegions] = useState<{ regionID: string; name: string }[]>([]);
  const [governorates, setGovernorates] = useState<{ governorateID: string; name: string }[]>([]);
  const [delegations, setDelegations] = useState<{ delegationID: string; name: string; governorateID?: string }[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [newAgent, setNewAgent] = useState({
    name: '', lastname: '', email: '', phone: '', supervisorID: '', delegationID: '', address: '',
  });
  const [editAgent, setEditAgent] = useState<Partial<any> | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [route, setRoute] = useState<CustomDirectionsResponse | null>(null);
  const [routeMode, setRouteMode] = useState<'DRIVING' | 'WALKING'>('DRIVING');
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [addingAgentMode, setAddingAgentMode] = useState(false);
  const [draggingMarker, setDraggingMarker] = useState<{ id: string; original: AgentMarker } | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [filterSectionOpen, setFilterSectionOpen] = useState(false);
  const [directionsSectionOpen, setDirectionsSectionOpen] = useState(false);
  const [assignedGovernorates, setAssignedGovernorates] = useState<{ governorateID: string; name: string }[]>([]);
  const [assignedDelegations, setAssignedDelegations] = useState<{ delegationID: string; name: string; governorateID?: string }[]>([]);
  const [selectedGovernorate, setSelectedGovernorate] = useState('');
  const [mapStyle, setMapStyle] = useState<keyof typeof mapStyles>('light');
  const mapRef = useRef<google.maps.Map | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const sortedMarkers = useMemo(() => {
    if (!userLocation) return filteredMarkers;
    return [...filteredMarkers].sort((a, b) =>
      calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng) -
      calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng)
    );
  }, [filteredMarkers, userLocation]);

  const routePath = useMemo(() => {
    if (!route || !route.polyline) return [];
    try {
      return polyline.decode(route.polyline).map(([lat, lng]) => ({ lat, lng }));
    } catch (err) {
      console.error('Polyline Decode Error:', err);
      return [];
    }
  }, [route]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [regionData, governorateData, delegationData, agentLocationsData, supervisorsData] = await Promise.all([
          getAllRegions(),
          getAllGovernorates(),
          getAllDelegations(),
          getAgentLocations(),
          getUsersByRole(import.meta.env.VITE_ROLES_SUPERVISOR),
        ]);
        setRegions(regionData);
        setGovernorates(governorateData);
        setDelegations(delegationData);
        setSupervisors(supervisorsData);

        const initialMarkers = agentLocationsData.locations.map((loc) => ({
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

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords;
              setUserLocation({ lat: latitude, lng: longitude });
              setMapCenter({ lat: latitude, lng: longitude });
              setZoom(15);
            },
            (error) => {
              console.error('Geolocation Error:', error);
              toast.error('Unable to get your location');
            }
          );
        }
      } catch (err) {
        console.error('Initial Data Error:', err);
        toast.error('Failed to load initial data');
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    if (newAgent.supervisorID) {
      Promise.all([
        getGovernoratesByUser(newAgent.supervisorID),
        getDelegationsByUser(newAgent.supervisorID),
      ]).then(([govs, dels]) => {
        setAssignedGovernorates(govs);
        setAssignedDelegations(dels);
      });
    } else {
      setAssignedGovernorates([]);
      setAssignedDelegations([]);
    }
  }, [newAgent.supervisorID]);

  useEffect(() => {
    if (filterSupervisor) {
      Promise.all([
        getGovernoratesByUser(filterSupervisor),
        getDelegationsByUser(filterSupervisor),
      ]).then(([govs, dels]) => {
        setAssignedGovernorates(govs);
        setAssignedDelegations(dels);
      });
    }
  }, [filterSupervisor]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery) {
      setFilteredMarkers(allMarkers);
      return;
    }
    setLoading(true);
    try {
      const matchingAgents = allMarkers.filter(
        (m) =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.lastname.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.phone.includes(searchQuery)
      );
      setFilteredMarkers(matchingAgents);
      if (matchingAgents.length === 1) {
        setMapCenter({ lat: matchingAgents[0].lat, lng: matchingAgents[0].lng });
        setZoom(15);
      }
    } catch (err) {
      console.error('Search Error:', err);
      toast.error('Search failed');
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

  const filteredGovernorates = useMemo(() => {
    let result = governorates;
    if (filterRegion) result = result.filter((g: any) => g.regionID === filterRegion);
    if (filterSupervisor) {
      const supervisorGovs = assignedGovernorates.map((g) => g.governorateID);
      result = result.filter((g) => supervisorGovs.includes(g.governorateID));
    }
    return result;
  }, [governorates, filterRegion, filterSupervisor, assignedGovernorates]);

  const filteredDelegations = useMemo(() => {
    let result = delegations;
    if (filterGovernorate) result = result.filter((d) => d.governorateID === filterGovernorate);
    if (filterSupervisor) {
      const supervisorDels = assignedDelegations.map((d) => d.delegationID);
      result = result.filter((d) => supervisorDels.includes(d.delegationID));
    }
    return result;
  }, [delegations, filterGovernorate, filterSupervisor, assignedDelegations]);

  const handleFilter = useCallback(() => {
    let filtered = allMarkers;
    if (filterRegion) filtered = filtered.filter((m) => m.region?.id === filterRegion);
    if (filterGovernorate) filtered = filtered.filter((m) => m.governorate?.id === filterGovernorate);
    if (filterDelegation) filtered = filtered.filter((m) => m.delegation?.id === filterDelegation);
    if (filterSupervisor) filtered = filtered.filter((m) => m.supervisor?.userID === filterSupervisor);
    setFilteredMarkers(filtered);
  }, [filterRegion, filterGovernorate, filterDelegation, filterSupervisor, allMarkers]);

  useEffect(() => {
    handleFilter();
  }, [filterRegion, filterGovernorate, filterSupervisor, handleFilter]);

  const handleMapClick = useCallback(async (event: google.maps.MapMouseEvent) => {
    if (!addingAgentMode) return;
    setAddingAgentMode(false);
    const lat = event.latLng?.lat();
    const lng = event.latLng?.lng();
    if (lat && lng) {
      try {
        const geocode = await getGeocode(`${lat},${lng}`);
        if (!geocode.formattedAddress) {
          toast.error('Unable to determine address');
          return;
        }
        setNewAgent({ ...newAgent, address: geocode.formattedAddress });
        setShowAddModal(true);
      } catch (err) {
        console.error('Map Click Error:', err);
        toast.error('Failed to get address');
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
      const agent = await createAgent(agentData);
      const newMarker: AgentMarker = {
        id: agent.agentID,
        lat: geocode.latitude,
        lng: geocode.longitude,
        name: agent.name,
        lastname: agent.lastname,
        email: agent.email,
        phone: agent.phone,
        address: geocode.formattedAddress,
        source: 'agent',
        delegation: agent.Delegation ? { id: agent.Delegation.delegationID, name: agent.Delegation.name } : undefined,
      };
      setAllMarkers((prev) => [...prev, newMarker]);
      setFilteredMarkers((prev) => [...prev, newMarker]);
      setShowAddModal(false);
      setNewAgent({ name: '', lastname: '', email: '', phone: '', supervisorID: '', delegationID: '', address: '' });
      setMapCenter({ lat: geocode.latitude, lng: geocode.longitude });
      setZoom(15);
      toast.success('Agent created');
    } catch (err) {
      console.error('Create Agent Error:', err);
      toast.error('Failed to create agent');
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
      const agentData = {
        name: editAgent.name,
        lastname: editAgent.lastname,
        email: editAgent.email,
        phone: editAgent.phone,
        supervisorID: editAgent.supervisorID,
        delegationID: editAgent.delegationID,
      };
      const updated = await updateAgent(editAgent.agentID, agentData);
      setAllMarkers((prev) =>
        prev.map((marker) =>
          marker.id === editAgent.agentID ? { ...marker, ...updated } : marker
        )
      );
      setFilteredMarkers((prev) =>
        prev.map((marker) =>
          marker.id === editAgent.agentID ? { ...marker, ...updated } : marker
        )
      );
      setShowEditModal(false);
      setEditAgent(null);
      toast.success('Agent updated');
    } catch (err) {
      console.error('Edit Agent Error:', err);
      toast.error('Failed to update agent');
    } finally {
      setLoading(false);
    }
  }, [editAgent]);

  const handleMarkerDragStart = useCallback((markerId: string) => {
    const marker = allMarkers.find((m) => m.id === markerId);
    if (marker) setDraggingMarker({ id: markerId, original: { ...marker } });
  }, [allMarkers]);

  const handleMarkerDragEnd = useCallback(async (event: google.maps.MapMouseEvent, markerId: string) => {
    const lat = event.latLng?.lat();
    const lng = event.latLng?.lng();
    if (!lat || !lng || !draggingMarker) {
      toast.error('Invalid marker position');
      revertMarkerPosition(markerId);
      return;
    }
    try {
      const geocode = await getGeocode(`${lat},${lng}`);
      if (!geocode.formattedAddress) {
        toast.error('Unable to determine address');
        revertMarkerPosition(markerId);
        return;
      }
      if (window.confirm(`Update location to ${geocode.formattedAddress}?`)) {
        const updated = await correctAgentLocation(markerId, lat, lng, geocode.formattedAddress);
        updateMarkerPosition(markerId, {
          latitude: updated.latitude,
          longitude: updated.longitude,
          address: updated.address,
          delegation: updated.delegation,
        });
        setMapCenter({ lat: updated.latitude, lng: updated.longitude });
        setZoom(15);
        toast.success('Location updated');
      } else {
        revertMarkerPosition(markerId);
      }
    } catch (err) {
      console.error('Drag End Error:', err);
      toast.error('Failed to update location');
      revertMarkerPosition(markerId);
    } finally {
      setDraggingMarker(null);
    }
  }, [draggingMarker]);

  const revertMarkerPosition = (markerId: string) => {
    if (draggingMarker) {
      setAllMarkers((prev) => prev.map((m) => (m.id === markerId ? { ...m, ...draggingMarker.original } : m)));
      setFilteredMarkers((prev) => prev.map((m) => (m.id === markerId ? { ...m, ...draggingMarker.original } : m)));
    }
  };

  const updateMarkerPosition = (markerId: string, updated: any) => {
    setAllMarkers((prev) =>
      prev.map((m) =>
        m.id === markerId
          ? { ...m, lat: updated.latitude, lng: updated.longitude, address: updated.address, source: 'agent', delegation: updated.delegation }
          : m
      )
    );
    setFilteredMarkers((prev) =>
      prev.map((m) =>
        m.id === markerId
          ? { ...m, lat: updated.latitude, lng: updated.longitude, address: updated.address, source: 'agent', delegation: updated.delegation }
          : m
      )
    );
    setSelectedMarker((prev) =>
      prev && prev.id === markerId ? { ...prev, lat: updated.latitude, lng: updated.longitude, address: updated.address } : prev
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
      const [originGeocode, destGeocode] = await Promise.all([
        getGeocode(originCoords),
        getGeocode(destCoords),
      ]);
      const newPoints: RoutePoint[] = [
        {
          id: 'origin',
          location: originCoords,
          address: originGeocode.formattedAddress || originCoords,
          type: 'origin',
        },
        {
          id: 'destination',
          location: destCoords,
          address: destGeocode.formattedAddress || destCoords,
          type: 'destination',
        },
      ];
      const directions = await getDirections(originCoords, destCoords, routeMode.toLowerCase(), []);
      if (directions.polyline) {
        setRoute(directions);
        setRoutePoints(newPoints);
        setMapCenter({ lat: marker.lat, lng: marker.lng });
        setZoom(15);
      } else {
        toast.error('No directions found');
      }
    } catch (err) {
      console.error('Directions Error:', err);
      toast.error('Failed to get directions');
    } finally {
      setLoading(false);
    }
  }, [userLocation, routeMode]);

  const handleAddStop = useCallback(async (marker: AgentMarker) => {
    if (!userLocation) {
      toast.error('User location not available');
      return;
    }
    setLoading(true);
    try {
      const newStop = `${marker.lat},${marker.lng}`;
      const geocode = await getGeocode(newStop);
      const newWaypoint: RoutePoint = {
        id: `wp-${Date.now()}`,
        location: newStop,
        address: geocode.formattedAddress || newStop,
        type: 'waypoint',
      };
      let newPoints = [...routePoints];
      if (newPoints.length === 0) {
        newPoints = [{
          id: 'origin',
          location: `${userLocation.lat},${userLocation.lng}`,
          address: 'My Location',
          type: 'origin',
        }, newWaypoint];
      } else {
        const destIndex = newPoints.findIndex((p) => p.type === 'destination');
        if (destIndex >= 0) {
          newPoints.splice(destIndex, 0, newWaypoint);
        } else {
          newPoints.push(newWaypoint);
        }
      }
      const origin = newPoints[0].location;
      const destination = newPoints[newPoints.length - 1].location;
      const waypointsForApi = newPoints.slice(1, newPoints.length - 1).map((wp) => ({
        location: wp.location,
        stopover: true,
      }));
      const directions = await getDirections(
        origin,
        destination,
        routeMode.toLowerCase(),
        waypointsForApi
      );
      if (directions.polyline) {
        setRoute(directions);
        setRoutePoints(newPoints);
        setMapCenter({ lat: marker.lat, lng: marker.lng });
        setZoom(15);
      } else {
        toast.error('No directions found');
      }
    } catch (err: any) {
      console.error('Add Stop Error:', err);
      toast.error(err.message || 'Failed to add stop');
    } finally {
      setLoading(false);
    }
  }, [userLocation, routePoints, routeMode]);

  const handleCalculateRoute = useCallback(async (optimize: boolean = false) => {
    if (routePoints.length < 2) {
      toast.error('At least two points are required for a route');
      return;
    }
    setLoading(true);
    try {
      const origin = routePoints[0].location;
      const destination = routePoints[routePoints.length - 1].location;
      const waypointsForApi = routePoints
        .slice(1, routePoints.length - 1)
        .map((point) => ({
          location: point.location,
          stopover: true,
        }));
      const directions = await getDirections(
        origin,
        destination,
        routeMode.toLowerCase(),
        waypointsForApi,
        optimize
      );
      if (directions.polyline) {
        setRoute(directions);
        if (optimize && directions.waypointOrder && directions.waypointOrder.length > 0) {
          const newPoints = [...routePoints];
          const waypoints = newPoints.slice(1, newPoints.length - 1);
          const reorderedWaypoints = directions.waypointOrder.map((index) => waypoints[index]);
          newPoints.splice(1, waypoints.length, ...reorderedWaypoints);
          setRoutePoints(newPoints);
        }
        const [destLat, destLng] = destination.split(',').map(Number);
        setMapCenter({ lat: destLat, lng: destLng });
        setZoom(15);
      } else {
        toast.error('No directions found');
      }
    } catch (err) {
      console.error('Calculate Route Error:', err);
      toast.error('Failed to calculate route');
    } finally {
      setLoading(false);
    }
  }, [routePoints, routeMode]);

  const handleOptimizeRoute = useCallback(() => {
    if (routePoints.length < 3) {
      toast.error('At least one waypoint is required to optimize');
      return;
    }
    handleCalculateRoute(true);
  }, [handleCalculateRoute, routePoints]);

  const clearRoute = useCallback(() => {
    setRoute(null);
    setRoutePoints([]);
  }, []);

  const handleReturnToCurrentLocation = useCallback(() => {
    if (!userLocation) {
      toast.error('User location not available');
      return;
    }
    setMapCenter(userLocation);
    setZoom(15);
  }, [userLocation]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setLoading(false);
  }, []);

  const onAutocompleteLoad = (autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  };

  const onPlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setMapCenter({ lat, lng });
        setZoom(15);
        setSearchQuery(place.formatted_address || '');
        handleSearch();
      }
    }
  };

  const handleDragEnd = useCallback(
    (result: any) => {
      if (!result.destination) return;
      const newPoints = [...routePoints];
      const [moved] = newPoints.splice(result.source.index, 1);
      newPoints.splice(result.destination.index, 0, moved);
      newPoints[0].type = 'origin';
      newPoints[newPoints.length - 1].type = 'destination';
      for (let i = 1; i < newPoints.length - 1; i++) {
        newPoints[i].type = 'waypoint';
      }
      setRoutePoints(newPoints);
      if (newPoints.length >= 2) {
        handleCalculateRoute();
      }
    },
    [routePoints, handleCalculateRoute]
  );

  const handleRemovePoint = useCallback(
    (index: number) => {
      const newPoints = [...routePoints].filter((_, i) => i !== index);
      if (newPoints.length >= 2) {
        newPoints[0].type = 'origin';
        newPoints[newPoints.length - 1].type = 'destination';
        for (let i = 1; i < newPoints.length - 1; i++) {
          newPoints[i].type = 'waypoint';
        }
        setRoutePoints(newPoints);
        handleCalculateRoute();
      } else {
        setRoutePoints(newPoints);
        setRoute(null);
      }
    },
    [routePoints, handleCalculateRoute]
  );

  const MarkerList = React.memo(
    ({ markers, onSelect, onGetDirections, onAddStop }: { markers: AgentMarker[]; onSelect: (marker: AgentMarker) => void; onGetDirections: (marker: AgentMarker) => void; onAddStop: (marker: AgentMarker) => void }) => (
      <div className="agent-list">
        {markers.length === 0 ? (
          <p className="no-agents">No agents found</p>
        ) : (
          markers.map((marker) => (
            <div
              key={marker.id}
              className={`agent-card ${selectedAgents.includes(marker.id) ? 'selected' : ''}`}
              onClick={() => {
                setSelectedAgents((prev) => {
                  const newSelected = prev.includes(marker.id) ? prev.filter((id) => id !== marker.id) : [...prev, marker.id];
                  if (!newSelected.includes(marker.id)) {
                    setSelectedMarker((prev) => (prev?.id === marker.id ? null : prev));
                  }
                  return newSelected;
                });
                onSelect(marker);
              }}
            >
              <h4>{`${marker.name} ${marker.lastname}`}</h4>
              <p>{marker.address}</p>
              <div className="agent-actions">
                {route ? (
                  <button className="action-button" onClick={(e) => { e.stopPropagation(); onAddStop(marker); }}>Add Stop</button>
                ) : (
                  <button className="action-button" onClick={(e) => { e.stopPropagation(); onGetDirections(marker); }}>Directions</button>
                )}
                <button className="action-button" onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${marker.phone}`; }}>Call</button>
              </div>
            </div>
          ))
        )}
      </div>
    )
  );

  const WaypointList = React.memo(() => (
    <div className="waypoint-list">
      <h3>Route Points</h3>
      {routePoints.length === 0 ? (
        <p>No route points added</p>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="routePoints">
            {(provided) => (
              <ul {...provided.droppableProps} ref={provided.innerRef}>
                {routePoints.map((point, index) => (
                  <Draggable key={point.id} draggableId={point.id} index={index}>
                    {(provided, snapshot) => (
                      <li
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`waypoint-item ${point.type} ${snapshot.isDragging ? 'dragging' : ''}`}
                      >
                        <span>{`${index + 1}. ${point.address} (${point.type.charAt(0).toUpperCase() + point.type.slice(1)})`}</span>
                        <button
                          onClick={() => handleRemovePoint(index)}
                          className="remove-waypoint"
                        >
                          Remove
                        </button>
                      </li>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      )}
      {routePoints.length > 2 && (
        <button onClick={handleOptimizeRoute} className="action-button">
          Optimize Route
        </button>
      )}
    </div>
  ));

  if (loading) return <div className="loading-overlay">Loading...</div>;

  return (
    <div className="map-container">
      <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY} libraries={libraries}>
        <div className="controls-bar">
          <Autocomplete onLoad={onAutocompleteLoad} onPlaceChanged={onPlaceChanged}>
            <div className="search-input-container">
              <input
                type="text"
                placeholder="Search agents"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <label className="search-label">Search agents</label>
            </div>
          </Autocomplete>
          <button
            className={`menu-button ${showControls ? 'active' : ''}`}
            onClick={() => setShowControls(!showControls)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          <select
            className="map-style-select"
            value={mapStyle}
            onChange={(e) => setMapStyle(e.target.value as keyof typeof mapStyles)}
          >
            {Object.keys(mapStyles).map((style) => (
              <option key={style} value={style}>{style.charAt(0).toUpperCase() + style.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className={`control-panel ${showControls ? 'active' : ''}`}>
          <div className="filter-section">
            <div
              className="section-header"
              onClick={() => setFilterSectionOpen(!filterSectionOpen)}
            >
              <h3>Filters</h3>
              <span>{filterSectionOpen ? '▲' : '▼'}</span>
            </div>
            <div className={`section-content ${filterSectionOpen ? 'active' : ''}`}>
              <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} className="filter-select">
                <option value="">All Regions</option>
                {regions.map((r) => (
                  <option key={r.regionID} value={r.regionID}>{r.name}</option>
                ))}
              </select>
              <select value={filterGovernorate} onChange={(e) => setFilterGovernorate(e.target.value)} className="filter-select">
                <option value="">All Governorates</option>
                {filteredGovernorates.map((g) => (
                  <option key={g.governorateID} value={g.governorateID}>{g.name}</option>
                ))}
              </select>
              <select value={filterDelegation} onChange={(e) => setFilterDelegation(e.target.value)} className="filter-select">
                <option value="">All Delegations</option>
                {filteredDelegations.map((d) => (
                  <option key={d.delegationID} value={d.delegationID}>{d.name}</option>
                ))}
              </select>
              <select value={filterSupervisor} onChange={(e) => setFilterSupervisor(e.target.value)} className="filter-select">
                <option value="">All Supervisors</option>
                {supervisors.map((sup) => (
                  <option key={sup.userID} value={sup.userID}>{`${sup.firstname} ${sup.lastname}`}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="directions-section">
            <div
              className="section-header"
              onClick={() => setDirectionsSectionOpen(!directionsSectionOpen)}
            >
              <h3>Directions</h3>
              <span>{directionsSectionOpen ? '▲' : '▼'}</span>
            </div>
            <div className={`section-content ${directionsSectionOpen ? 'active' : ''}`}>
              <div className="modal-input-container">
                <input
                  type="text"
                  placeholder="Origin"
                  value={routePoints.length > 0 ? routePoints[0].address : ''}
                  onChange={(e) => {
                    if (routePoints.length > 0) {
                      const newPoints = [...routePoints];
                      newPoints[0].address = e.target.value;
                      setRoutePoints(newPoints);
                    }
                  }}
                  className="route-input"
                />
                <label className="modal-label">Origin</label>
              </div>
              <button onClick={() => {
                if (userLocation) {
                  const newPoints = routePoints.length > 0 ? [...routePoints] : [];
                  const originPoint: RoutePoint = {
                    id: 'origin',
                    location: `${userLocation.lat},${userLocation.lng}`,
                    address: 'My Location',
                    type: 'origin',
                  };
                  if (newPoints.length === 0) {
                    newPoints.push(originPoint);
                  } else {
                    newPoints[0] = originPoint;
                  }
                  setRoutePoints(newPoints);
                }
              }} className="action-button">My Location</button>
              <div className="modal-input-container">
                <input
                  type="text"
                  placeholder="Destination"
                  value={routePoints.length > 1 ? routePoints[routePoints.length - 1].address : ''}
                  onChange={(e) => {
                    if (routePoints.length > 1) {
                      const newPoints = [...routePoints];
                      newPoints[newPoints.length - 1].address = e.target.value;
                      setRoutePoints(newPoints);
                    }
                  }}
                  className="route-input"
                />
                <label className="modal-label">Destination</label>
              </div>
              <select value={routeMode} onChange={(e) => setRouteMode(e.target.value as 'DRIVING' | 'WALKING')} className="route-select">
                <option value="DRIVING">Driving</option>
                <option value="WALKING">Walking</option>
              </select>
              <button onClick={() => handleCalculateRoute()} className="action-button">Get Directions</button>
              <button onClick={clearRoute} className="cancel-button">Clear</button>
            </div>
          </div>
          <WaypointList />
        </div>

        <GoogleMap
          mapContainerStyle={containerStyle}
          center={mapCenter}
          zoom={zoom}
          onLoad={onMapLoad}
          onClick={handleMapClick}
          options={{
            styles: mapStyles[mapStyle],
            disableDefaultUI: true,
          }}
        >
          <MarkerClusterer>
            {() => (
              <>
                {filteredMarkers.map((marker) => (
                  <Marker
                    key={marker.id}
                    position={{ lat: marker.lat, lng: marker.lng }}
                    title={`${marker.name} ${marker.lastname}`}
                    draggable={true}
                    onDragStart={() => handleMarkerDragStart(marker.id)}
                    onDragEnd={(e: google.maps.MapMouseEvent) => handleMarkerDragEnd(e, marker.id)}
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
                        setSelectedAgents((prev) => prev.includes(marker.id) ? prev : [...prev, marker.id]);
                      } catch (err) {
                        console.error('Agent Details Error:', err);
                        toast.error('Failed to fetch agent details');
                      }
                    }}
                    icon={{
                      url: 'https://maps.gstatic.com/mapfiles/ms2/micons/lightblue.png'
                    }}
                  />
                ))}
                {userLocation && (
                  <Marker
                    position={userLocation}
                    title="Your Location"
                    icon={{
                      url: 'https://maps.gstatic.com/mapfiles/ms2/micons/man.png'
                    }}
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
                <button className="action-button" onClick={() => setShowEditModal(true)}>Edit</button>
                {route ? (
                  <button className="action-button" onClick={() => handleAddStop(selectedMarker)}>Add Stop</button>
                ) : (
                  <button className="action-button" onClick={() => handleGetDirections(selectedMarker)}>Directions</button>
                )}
              </div>
            </InfoWindow>
          )}
          {routePath.length > 0 && (
            <Polyline path={routePath} options={{ strokeColor: '#4cb1c7', strokeOpacity: 0.8, strokeWeight: 6 }} />
          )}
        </GoogleMap>

        {route && (
          <div className="route-summary">
            <p>Distance: {route.distance} km</p>
            <p>Duration: {route.duration} min</p>
            <button onClick={clearRoute} className="cancel-button">Clear Route</button>
          </div>
        )}

        <button className="fab" onClick={() => setAddingAgentMode(true)}>+</button>
        <button className="location-button" onClick={handleReturnToCurrentLocation} disabled={!userLocation}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
            <path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
          </svg>
        </button>

        <div className="agent-container">
          <MarkerList
            markers={sortedMarkers}
            onSelect={(marker) => {
              setSelectedMarker(marker);
              setMapCenter({ lat: marker.lat, lng: marker.lng });
              setZoom(15);
            }}
            onGetDirections={handleGetDirections}
            onAddStop={handleAddStop}
          />
        </div>

        {showAddModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Add New Agent</h2>
              <div className="modal-input-container">
                <input
                  type="text"
                  placeholder="Name"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  className="modal-input"
                />
                <label className="modal-label">Name</label>
              </div>
              <div className="modal-input-container">
                <input
                  type="text"
                  placeholder="Last Name"
                  value={newAgent.lastname}
                  onChange={(e) => setNewAgent({ ...newAgent, lastname: e.target.value })}
                  className="modal-input"
                />
                <label className="modal-label">Last Name</label>
              </div>
              <div className="modal-input-container">
                <input
                  type="email"
                  placeholder="Email"
                  value={newAgent.email}
                  onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })}
                  className="modal-input"
                />
                <label className="modal-label">Email</label>
              </div>
              <div className="modal-input-container">
                <input
                  type="tel"
                  placeholder="Phone"
                  value={newAgent.phone}
                  onChange={(e) => setNewAgent({ ...newAgent, phone: e.target.value })}
                  className="modal-input"
                />
                <label className="modal-label">Phone</label>
              </div>
              <div className="modal-input-container">
                <select
                  value={newAgent.supervisorID}
                  onChange={(e) => setNewAgent({ ...newAgent, supervisorID: e.target.value })}
                  className="modal-select"
                >
                  <option value="">Select Supervisor</option>
                  {supervisors.map((sup) => (
                    <option key={sup.userID} value={sup.userID}>{`${sup.firstname} ${sup.lastname}`}</option>
                  ))}
                </select>
                <label className="modal-label">Supervisor</label>
              </div>
              <div className="modal-input-container">
                <select
                  value={selectedGovernorate}
                  onChange={(e) => setSelectedGovernorate(e.target.value)}
                  className="modal-select"
                >
                  <option value="">Select Governorate</option>
                  {assignedGovernorates.map((g) => (
                    <option key={g.governorateID} value={g.governorateID}>{g.name}</option>
                  ))}
                </select>
                <label className="modal-label">Governorate</label>
              </div>
              <div className="modal-input-container">
                <select
                  value={newAgent.delegationID}
                  onChange={(e) => setNewAgent({ ...newAgent, delegationID: e.target.value })}
                  className="modal-select"
                >
                  <option value="">Select Delegation</option>
                  {assignedDelegations.filter((d) => d.governorateID === selectedGovernorate).map((d) => (
                    <option key={d.delegationID} value={d.delegationID}>{d.name}</option>
                  ))}
                </select>
                <label className="modal-label">Delegation</label>
              </div>
              <p><strong>Address:</strong> {newAgent.address}</p>
              <div className="modal-actions">
                <button onClick={handleCreateAgent} className="action-button">Create</button>
                <button onClick={() => setShowAddModal(false)} className="cancel-button">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {showEditModal && editAgent && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Edit Agent</h2>
              <div className="modal-input-container">
                <input
                  type="text"
                  placeholder="Name"
                  value={editAgent.name || ''}
                  onChange={(e) => setEditAgent({ ...editAgent, name: e.target.value })}
                  className="modal-input"
                />
                <label className="modal-label">Name</label>
              </div>
              <div className="modal-input-container">
                <input
                  type="text"
                  placeholder="Last Name"
                  value={editAgent.lastname || ''}
                  onChange={(e) => setEditAgent({ ...editAgent, lastname: e.target.value })}
                  className="modal-input"
                />
                <label className="modal-label">Last Name</label>
              </div>
              <div className="modal-input-container">
                <input
                  type="email"
                  placeholder="Email"
                  value={editAgent.email || ''}
                  onChange={(e) => setEditAgent({ ...editAgent, email: e.target.value })}
                  className="modal-input"
                />
                <label className="modal-label">Email</label>
              </div>
              <div className="modal-input-container">
                <input
                  type="tel"
                  placeholder="Phone"
                  value={editAgent.phone || ''}
                  onChange={(e) => setEditAgent({ ...editAgent, phone: e.target.value })}
                  className="modal-input"
                />
                <label className="modal-label">Phone</label>
              </div>
              <div className="modal-input-container">
                <select
                  value={editAgent.supervisorID || ''}
                  onChange={(e) => setEditAgent({ ...editAgent, supervisorID: e.target.value })}
                  className="modal-select"
                >
                  <option value="">Select Supervisor</option>
                  {supervisors.map((sup) => (
                    <option key={sup.userID} value={sup.userID}>{`${sup.firstname} ${sup.lastname}`}</option>
                  ))}
                </select>
                <label className="modal-label">Supervisor</label>
              </div>
              <div className="modal-input-container">
                <select
                  value={editAgent.delegationID || ''}
                  onChange={(e) => setEditAgent({ ...editAgent, delegationID: e.target.value })}
                  className="modal-select"
                >
                  <option value="">Select Delegation</option>
                  {delegations.map((d) => (
                    <option key={d.delegationID} value={d.delegationID}>{d.name}</option>
                  ))}
                </select>
                <label className="modal-label">Delegation</label>
              </div>
              <p><strong>Address:</strong> {editAgent.location}</p>
              <div className="modal-actions">
                <button onClick={handleEditAgent} className="action-button">Save</button>
                <button onClick={() => setShowEditModal(false)} className="cancel-button">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </LoadScript>
    </div>
  );
};

export default MapComponent;