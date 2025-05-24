import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  GoogleMap,
  LoadScript,
  InfoWindow,
  Polyline,
  MarkerClusterer,
  Marker,
  Autocomplete,
  TrafficLayer,
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
  updateUserLocation,
} from '../../apis/locationApi';
import { getUsersByRole } from '../../apis/userAPI';
import './Map.css';

interface RoutePoint {
  id: string;
  location: string;
  address: string;
  type: 'origin' | 'waypoint' | 'destination';
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

interface TrafficSegment {
  legIndex: number;
  steps: Array<{
    polyline: string;
    trafficCondition: 'clear' | 'moderate' | 'heavy';
    color: string;
    distance: string;
    duration: string;
    instruction: string;
  }>;
  distance: number;
  duration: number;
}

interface CustomDirectionsResponse {
  distance: number;
  duration: number;
  steps: Array<{ instruction: string; distance: string; duration: string }>;
  polyline: string;
  waypointOrder?: number[];
  mock?: boolean;
  trafficSegments?: TrafficSegment[];
}

const containerStyle = { width: '100%', height: '70vh' };
const defaultCenter = { lat: 36.8065, lng: 10.1815 };
const libraries: ('places' | 'geometry')[] = ['places', 'geometry'];

const mapStyles = {
  standard: [],
  silver: [
    { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
    { featureType: 'road', stylers: [{ color: '#ffffff' }] },
    { featureType: 'water', stylers: [{ color: '#b3e5fc' }] },
  ],
  night: [
    { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
    { featureType: 'road', stylers: [{ color: '#374151' }] },
    { featureType: 'water', stylers: [{ color: '#1e3a8a' }] },
  ],
  satellite: [],
  minimal: [
    { featureType: 'all', elementType: 'all', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ visibility: 'on', color: '#e0e0e0' }] },
    { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ visibility: 'on', color: '#b3e5fc' }] },
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
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showDirectionsPanel, setShowDirectionsPanel] = useState(false);
  const [isFilterPanelCollapsed, setIsFilterPanelCollapsed] = useState(false);
  const [isDirectionsPanelCollapsed, setIsDirectionsPanelCollapsed] = useState(false);
  const [isRoutesPanelCollapsed, setIsRoutesPanelCollapsed] = useState(false);
  const [isAddAgentPanelCollapsed, setIsAddAgentPanelCollapsed] = useState(false);
  const [isEditAgentPanelCollapsed, setIsEditAgentPanelCollapsed] = useState(false);
  const [route, setRoute] = useState<CustomDirectionsResponse | null>(null);
  const [routeMode, setRouteMode] = useState<'DRIVING' | 'WALKING'>('DRIVING');
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [addingAgentMode, setAddingAgentMode] = useState(false);
  const [draggingMarker, setDraggingMarker] = useState<{ id: string; original: AgentMarker } | null>(null);
  const [mapStyle, setMapStyle] = useState<keyof typeof mapStyles>('standard');
  const [carMode, setCarMode] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const locationWatchId = useRef<number | null>(null);
  const watchActive = useRef<boolean>(false);
  const retryCount = useRef<number>(0);
  const lastPosition = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);
  const [assignedGovernorates, setAssignedGovernorates] = useState<{ governorateID: string; name: string }[]>([]);
  const [assignedDelegations, setAssignedDelegations] = useState<{ delegationID: string; name: string; governorateID?: string }[]>([]);
  const [selectedGovernorate, setSelectedGovernorate] = useState('');

  // Memoized state to prevent re-renders
  const routeData = useRef<{
    points: RoutePoint[];
    response: CustomDirectionsResponse | null;
    path: google.maps.LatLngLiteral[];
    traffic: Array<{ path: google.maps.LatLngLiteral[]; color: string }>;
  }>({
    points: [],
    response: null,
    path: [],
    traffic: [],
  });

  // Detect platform theme and set map style
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleThemeChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setMapStyle(e.matches ? 'night' : 'standard');
    };
    handleThemeChange(darkModeMediaQuery);
    darkModeMediaQuery.addEventListener('change', handleThemeChange);
    return () => darkModeMediaQuery.removeEventListener('change', handleThemeChange);
  }, []);

  const sortedMarkers = useMemo(() => {
    if (!userLocation) return filteredMarkers;
    return [...filteredMarkers].sort((a, b) =>
      calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng) -
      calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng)
    );
  }, [filteredMarkers, userLocation]);

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
              const newLocation = { lat: latitude, lng: longitude };
              setUserLocation(newLocation);
              setMapCenter(newLocation);
              lastPosition.current = { ...newLocation, timestamp: Date.now() };
              setZoom(15);
            },
            (error) => {
              console.error('Geolocation Error:', error);
              toast.error('Unable to get your location.');
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

  const handleCalculateRoute = useCallback(async (points: RoutePoint[], mode: 'DRIVING' | 'WALKING', optimize: boolean = false) => {
    if (points.length < 2) {
      toast.error('At least two points required for a route');
      return;
    }
    try {
      const origin = points[0].location;
      const destination = points[points.length - 1].location;
      const waypointsForApi = points
        .slice(1, points.length - 1)
        .map((point) => ({
          location: point.location,
          stopover: true,
        }));
      const directions = await getDirections(
        origin,
        destination,
        mode.toLowerCase(),
        waypointsForApi,
        optimize
      );
      if (directions.polyline) {
        routeData.current = {
          points,
          response: directions,
          path: polyline.decode(directions.polyline).map(([lat, lng]) => ({ lat, lng })),
          traffic: directions.trafficSegments?.flatMap((segment) =>
            segment.steps.map((step) => ({
              path: polyline.decode(step.polyline).map(([lat, lng]) => ({ lat, lng })),
              color: step.color,
            }))
          ) || [],
        };
        if (optimize && directions.waypointOrder && directions.waypointOrder.length > 0) {
          const newPoints = [...points];
          const waypoints = newPoints.slice(1, newPoints.length - 1);
          const reorderedWaypoints = directions.waypointOrder.map((index) => waypoints[index]);
          newPoints.splice(1, waypoints.length, ...reorderedWaypoints);
          routeData.current.points = newPoints;
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
    }
  }, []);

  useEffect(() => {
    const maxRetries = 3;
    const timeout = 15000;
    const maximumAge = 5000;

    const handlePosition = async (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      const newLocation = { lat: latitude, lng: longitude };
      lastPosition.current = { ...newLocation, timestamp: Date.now() };

      setUserLocation((prev) => {
        if (prev && prev.lat === latitude && prev.lng === longitude) return prev;
        return newLocation;
      });
      setMapCenter((prev) => {
        if (prev.lat === latitude && prev.lng === longitude) return prev;
        return newLocation;
      });

      try {
        await updateUserLocation('currentUser', newLocation);
        retryCount.current = 0;
      } catch (err) {
        console.error('Location Update Error:', err);
        toast.error('Failed to update location');
      }

      if (routeData.current.points.length >= 2) {
        handleCalculateRoute(routeData.current.points, routeMode);
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      console.error('Geolocation Watch Error:', {
        code: error.code,
        message: error.message,
        retryCount: retryCount.current,
      });

      if (error.code === 3 && retryCount.current < maxRetries) {
        retryCount.current += 1;
        toast.warn(`Retrying location (${retryCount.current}/${maxRetries})`);
        return;
      }

      toast.error(`Unable to track location: ${error.message}`);
      if (lastPosition.current) {
        setUserLocation({ lat: lastPosition.current.lat, lng: lastPosition.current.lng });
        setMapCenter({ lat: lastPosition.current.lat, lng: lastPosition.current.lng });
      }
    };

    const startWatching = () => {
      if (watchActive.current || !navigator.geolocation) return;

      watchActive.current = true;
      locationWatchId.current = navigator.geolocation.watchPosition(
        handlePosition,
        handleError,
        { enableHighAccuracy: true, timeout, maximumAge }
      );
    };

    if (carMode) {
      startWatching();
    }

    return () => {
      if (locationWatchId.current !== null) {
        navigator.geolocation.clearWatch(locationWatchId.current);
        locationWatchId.current = null;
        watchActive.current = false;
        retryCount.current = 0;
      }
    };
  }, [carMode, routeMode]);

  const handleManualLocation = useCallback((e: google.maps.MapMouseEvent) => {
    if (carMode && e.latLng) {
      const newLocation = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      setUserLocation(newLocation);
      setMapCenter(newLocation);
      lastPosition.current = { ...newLocation, timestamp: Date.now() };
      updateUserLocation('currentUser', newLocation).catch((err) => {
        console.error('Manual Location Update Error:', err);
        toast.error('Failed to update location');
      });
    }
  }, [carMode]);

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
    if (addingAgentMode) {
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
          closeAllPanels();
          setShowAddPanel(true);
        } catch (err) {
          console.error('Map Click Error:', err);
          toast.error('Failed to get address');
        }
      }
    } else if (carMode) {
      handleManualLocation(event);
    } else if (selectedMarker) {
      setSelectedMarker(null);
    }
  }, [addingAgentMode, newAgent, carMode, handleManualLocation, selectedMarker]);

  const handleCreateAgent = useCallback(async () => {
    if (!newAgent.name || !newAgent.lastname || !newAgent.email || !newAgent.phone || !newAgent.delegationID || !newAgent.supervisorID || !newAgent.address) {
      toast.error('All fields required');
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
      setShowAddPanel(false);
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
      toast.error('No agent selected');
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
      setShowEditPanel(false);
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
      if (window.confirm(`Update to ${geocode.formattedAddress}?`)) {
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
      await handleCalculateRoute(newPoints, routeMode);
      routeData.current.points = newPoints;
      setMapCenter({ lat: marker.lat, lng: marker.lng });
      setZoom(15);
      closeAllPanels();
      setShowDirectionsPanel(true);
      setIsDirectionsPanelCollapsed(false);
    } catch (err) {
      console.error('Directions Error:', err);
      toast.error('Failed to get directions');
    }
  }, [userLocation, routeMode, handleCalculateRoute]);

  const handleAddStop = useCallback(async (marker: AgentMarker) => {
    if (!userLocation) {
      toast.error('User location not available');
      return;
    }
    try {
      const newStop = `${marker.lat},${marker.lng}`;
      const geocode = await getGeocode(newStop);
      const newWaypoint: RoutePoint = {
        id: `wp-${Date.now()}`,
        location: newStop,
        address: geocode.formattedAddress || newStop,
        type: 'waypoint',
      };
      let newPoints = [...routeData.current.points];
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
      await handleCalculateRoute(newPoints, routeMode);
      routeData.current.points = newPoints;
      setMapCenter({ lat: marker.lat, lng: marker.lng });
      setZoom(15);
    } catch (err) {
      console.error('Add Stop Error:', err);
      toast.error('Failed to add stop');
    }
  }, [userLocation, routeMode, handleCalculateRoute]);

  const handleOptimizeRoute = useCallback(() => {
    if (routeData.current.points.length < 3) {
      toast.error('At least one waypoint required to optimize');
      return;
    }
    handleCalculateRoute(routeData.current.points, routeMode, true);
  }, [handleCalculateRoute, routeMode]);

  const clearRoute = useCallback(() => {
    routeData.current = { points: [], response: null, path: [], traffic: [] };
    setShowDirectionsPanel(false);
    setIsDirectionsPanelCollapsed(false);
  }, []);

  const handleReturnToCurrentLocation = useCallback(() => {
    if (!userLocation) {
      toast.error('User location not available');
      return;
    }
    setMapCenter(userLocation);
    setZoom(15);
  }, [userLocation]);

  const toggleCarMode = useCallback(async () => {
    if (!carMode) {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        if (permission.state === 'denied') {
          toast.error('Location access denied. Enable in browser settings.');
          return;
        }
        if (!userLocation && !lastPosition.current) {
          toast.error('User location not available.');
          return;
        }
      } catch (err) {
        console.error('Permission Check Error:', err);
        toast.error('Unable to check location permissions.');
        return;
      }
    }
    setCarMode((prev) => !prev);
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
      const newPoints = [...routeData.current.points];
      const [moved] = newPoints.splice(result.source.index, 1);
      newPoints.splice(result.destination.index, 0, moved);
      newPoints[0].type = 'origin';
      newPoints[newPoints.length - 1].type = 'destination';
      for (let i = 1; i < newPoints.length - 1; i++) {
        newPoints[i].type = 'waypoint';
      }
      routeData.current.points = newPoints;
      if (newPoints.length >= 2) {
        handleCalculateRoute(newPoints, routeMode);
      }
    },
    [routeMode, handleCalculateRoute]
  );

  const handleRemovePoint = useCallback(
    (index: number) => {
      const newPoints = [...routeData.current.points].filter((_, i) => i !== index);
      if (newPoints.length >= 2) {
        newPoints[0].type = 'origin';
        newPoints[newPoints.length - 1].type = 'destination';
        for (let i = 1; i < newPoints.length - 1; i++) {
          newPoints[i].type = 'waypoint';
        }
        routeData.current.points = newPoints;
        handleCalculateRoute(newPoints, routeMode);
      } else {
        routeData.current = { points: newPoints, response: null, path: [], traffic: [] };
        setShowDirectionsPanel(false);
        setIsDirectionsPanelCollapsed(false);
      }
    },
    [routeMode, handleCalculateRoute]
  );

  const closeAllPanels = useCallback(() => {
    setShowAddPanel(false);
    setShowEditPanel(false);
    setShowFilterPanel(false);
    setShowDirectionsPanel(false);
    setIsFilterPanelCollapsed(false);
    setIsDirectionsPanelCollapsed(false);
    setIsRoutesPanelCollapsed(false);
    setIsAddAgentPanelCollapsed(false);
    setIsEditAgentPanelCollapsed(false);
  }, []);

  const AgentCard = React.memo(
    ({ marker, onSelect, onGetDirections, onAddStop }: { marker: AgentMarker; onSelect: (marker: AgentMarker) => void; onGetDirections: (marker: AgentMarker) => void; onAddStop: (marker: AgentMarker) => void }) => (
      <div
        className={`agent-card ${selectedAgents.includes(marker.id) ? 'selected' : ''} ${selectedMarker?.id === marker.id ? 'info-active' : ''}`}
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
          {routeData.current.response ? (
            <button onClick={(e) => { e.stopPropagation(); onAddStop(marker); }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Add Stop
            </button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); onGetDirections(marker); }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Directions
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${marker.phone}`; }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            Call
          </button>
        </div>
      </div>
    )
  );

  const WaypointList = React.memo(() => (
    <div className="waypoint-list">
      <div className="waypoint-header">
        <h3>Route Stops</h3>
        {routeData.current.points.length > 2 && (
          <button onClick={handleOptimizeRoute}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12h8M12 4v16M20 12h-8m-4 4h8m-8-8h8" />
            </svg>
            Optimize
          </button>
        )}
      </div>
      {routeData.current.points.length === 0 ? (
        <p>No stops added</p>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="routePoints">
            {(provided) => (
              <ul {...provided.droppableProps} ref={provided.innerRef}>
                {routeData.current.points.map((point, index) => (
                  <Draggable key={point.id} draggableId={point.id} index={index}>
                    {(provided, snapshot) => (
                      <li
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`waypoint-item ${point.type} ${snapshot.isDragging ? 'dragging' : ''}`}
                      >
                        <span>{`${point.address} (${point.type.charAt(0).toUpperCase() + point.type.slice(1)})`}</span>
                        <button onClick={() => handleRemovePoint(index)}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
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
          options={{
            styles: mapStyles[mapStyle],
            mapTypeId: mapStyle === 'satellite' ? 'satellite' : 'roadmap',
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          }}
        >
          <div className="map-controls">
            <Autocomplete onLoad={onAutocompleteLoad} onPlaceChanged={onPlaceChanged}>
              <input
                type="text"
                placeholder="Search agents or places"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </Autocomplete>
            <div className="control-buttons">
              <button
                className={`control-btn ${showFilterPanel ? 'active' : ''}`}
                onClick={() => {
                  closeAllPanels();
                  setShowFilterPanel(true);
                  setIsFilterPanelCollapsed(false);
                }}
                title="Filter"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 3H2l8 9.46V19a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-6.54L22 3z" />
                </svg>
              </button>
              <button
                className={`control-btn ${showDirectionsPanel ? 'active' : ''}`}
                onClick={() => {
                  closeAllPanels();
                  setShowDirectionsPanel(true);
                  setIsDirectionsPanelCollapsed(false);
                }}
                title="Directions"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </button>
              <button
                className={`control-btn ${carMode ? 'active' : ''}`}
                onClick={toggleCarMode}
                title={carMode ? 'Exit Car Mode' : 'Car Mode'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 7l-7 5-7-5M19 12l-7 5-7-5" />
                </svg>
              </button>
              <select
                value={mapStyle}
                onChange={(e) => setMapStyle(e.target.value as keyof typeof mapStyles)}
                className="map-style-select"
              >
                <option value="standard">Standard</option>
                <option value="silver">Silver</option>
                <option value="night">Night</option>
                <option value="satellite">Satellite</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>
          </div>

          {showFilterPanel && (
            <div className={`panel filter-panel ${isFilterPanelCollapsed ? 'collapsed' : ''}`}>
              <div className="panel-header" onClick={() => setIsFilterPanelCollapsed(!isFilterPanelCollapsed)}>
                <h2>Filters</h2>
                <button className="toggle-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d={isFilterPanelCollapsed ? 'M4 12h16M12 4v16' : 'M4 12h16'} />
                  </svg>
                </button>
              </div>
              <div className="panel-content">
                <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)}>
                  <option value="">All Regions</option>
                  {regions.map((r) => (
                    <option key={r.regionID} value={r.regionID}>{r.name}</option>
                  ))}
                </select>
                <select value={filterGovernorate} onChange={(e) => setFilterGovernorate(e.target.value)}>
                  <option value="">All Governorates</option>
                  {filteredGovernorates.map((g) => (
                    <option key={g.governorateID} value={g.governorateID}>{g.name}</option>
                  ))}
                </select>
                <select value={filterDelegation} onChange={(e) => setFilterDelegation(e.target.value)}>
                  <option value="">All Delegations</option>
                  {filteredDelegations.map((d) => (
                    <option key={d.delegationID} value={d.delegationID}>{d.name}</option>
                  ))}
                </select>
                <select value={filterSupervisor} onChange={(e) => setFilterSupervisor(e.target.value)}>
                  <option value="">All Supervisors</option>
                  {supervisors.map((sup) => (
                    <option key={sup.userID} value={sup.userID}>{`${sup.firstname} ${sup.lastname}`}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {showDirectionsPanel && (
            <div className="panel directions-panel">
              <div className={`sub-panel directions-sub-panel ${isDirectionsPanelCollapsed ? 'collapsed' : ''}`}>
                <div className="panel-header" onClick={() => setIsDirectionsPanelCollapsed(!isDirectionsPanelCollapsed)}>
                  <h2>Directions</h2>
                  <button className="toggle-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d={isDirectionsPanelCollapsed ? 'M4 12h16M12 4v16' : 'M4 12h16'} />
                    </svg>
                  </button>
                </div>
                <div className="panel-content">
                  <div className="origin-input">
                    <input
                      type="text"
                      placeholder="Origin"
                      value={routeData.current.points.length > 0 ? routeData.current.points[0].address : ''}
                      onChange={(e) => {
                        if (routeData.current.points.length > 0) {
                          const newPoints = [...routeData.current.points];
                          newPoints[0].address = e.target.value;
                          routeData.current.points = newPoints;
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (userLocation) {
                          const newPoints = routeData.current.points.length > 0 ? [...routeData.current.points] : [];
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
                          routeData.current.points = newPoints;
                        }
                      }}
                      title="My Location"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                        <path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
                      </svg>
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Destination"
                    value={routeData.current.points.length > 1 ? routeData.current.points[routeData.current.points.length - 1].address : ''}
                    onChange={(e) => {
                      if (routeData.current.points.length > 1) {
                        const newPoints = [...routeData.current.points];
                        newPoints[newPoints.length - 1].address = e.target.value;
                        routeData.current.points = newPoints;
                      }
                    }}
                  />
                  <select value={routeMode} onChange={(e) => setRouteMode(e.target.value as 'DRIVING' | 'WALKING')}>
                    <option value="DRIVING">Driving</option>
                    <option value="WALKING">Walking</option>
                  </select>
                  <div className="directions-buttons">
                    <button onClick={() => handleCalculateRoute(routeData.current.points, routeMode)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                      Go
                    </button>
                    <button onClick={clearRoute}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                      Clear
                    </button>
                  </div>
                </div>
              </div>
              <div className={`sub-panel routes-sub-panel ${isRoutesPanelCollapsed ? 'collapsed' : ''}`}>
                <div className="panel-header" onClick={() => setIsRoutesPanelCollapsed(!isRoutesPanelCollapsed)}>
                  <h2>Routes</h2>
                  <button className="toggle-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d={isRoutesPanelCollapsed ? 'M4 12h16M12 4v16' : 'M4 12h16'} />
                    </svg>
                  </button>
                </div>
                <div className="panel-content">
                  <WaypointList />
                </div>
              </div>
            </div>
          )}

          {carMode && routeData.current.traffic.length > 0 ? (
            routeData.current.traffic.map((segment, index) => (
              <Polyline
                key={`traffic-segment-${index}`}
                path={segment.path}
                options={{
                  strokeColor: segment.color,
                  strokeOpacity: 0.75,
                  strokeWeight: 6,
                }}
              />
            ))
          ) : (
            routeData.current.path.length > 0 && (
              <Polyline
                path={routeData.current.path}
                options={{
                  strokeColor: '#4285F4',
                  strokeOpacity: 0.75,
                  strokeWeight: 6,
                }}
              />
            )
          )}
          {carMode && routeData.current.response && <TrafficLayer />}
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
                      url: (marker.lat != null && marker.lng != null && marker.lat !== 0 && marker.lng !== 0)
                        ? 'https://maps.gstatic.com/mapfiles/ms2/micons/lightblue.png'
                        : 'https://maps.gstatic.com/mapfiles/ms2/micons/red.png'
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
            <InfoWindow
              position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div className="info-window">
                <h3>{`${selectedMarker.name} ${selectedMarker.lastname}`}</h3>
                <p>{selectedMarker.address}</p>
                <p>Phone: {selectedMarker.phone}</p>
                <div className="info-buttons">
                  <button onClick={() => { closeAllPanels(); setShowEditPanel(true); setIsEditAgentPanelCollapsed(false); }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit
                  </button>
                  {routeData.current.response ? (
                    <button onClick={() => handleAddStop(selectedMarker)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      Add Stop
                    </button>
                  ) : (
                    <button onClick={() => handleGetDirections(selectedMarker)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      Directions
                    </button>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>

        <button
          className="locate-btn"
          onClick={handleReturnToCurrentLocation}
          disabled={!userLocation}
          title="Return to My Location"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
            <path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
          </svg>
        </button>

        <button
          className="add-agent-btn"
          onClick={() => {
            setAddingAgentMode(true);
            toast.info('Click on the map to select a location for the new agent');
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add
        </button>

        {showAddPanel && (
          <div className={`panel add-agent-panel ${isAddAgentPanelCollapsed ? 'collapsed' : ''}`}>
            <div
              className="panel-header"
              onClick={() => setIsAddAgentPanelCollapsed(!isAddAgentPanelCollapsed)}
            >
              <h2>Add New Agent</h2>
              <button className="toggle-btn">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    d={isAddAgentPanelCollapsed ? 'M4 12h16M12 4v16' : 'M4 12h16'}
                  />
                </svg>
              </button>
            </div>
            <div className="panel-content">
              <input
                type="text"
                placeholder="Name"
                value={newAgent.name}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, name: e.target.value })
                }
              />
              <input
                type="text"
                placeholder="Lastname"
                value={newAgent.lastname}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, lastname: e.target.value })
                }
              />
              <input
                type="email"
                placeholder="Email"
                value={newAgent.email}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, email: e.target.value })
                }
              />
              <input
                type="tel"
                placeholder="Phone"
                value={newAgent.phone}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, phone: e.target.value })
                }
              />
              <select
                value={newAgent.supervisorID}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, supervisorID: e.target.value })
                }
              >
                <option value="">Select Supervisor</option>
                {supervisors.map((sup) => (
                  <option key={sup.userID} value={sup.userID}>
                    {`${sup.firstname} ${sup.lastname}`}
                  </option>
                ))}
              </select>
              <select
                value={selectedGovernorate}
                onChange={(e) => {
                  setSelectedGovernorate(e.target.value);
                  setNewAgent({ ...newAgent, delegationID: '' });
                }}
              >
                <option value="">Select Governorate</option>
                {assignedGovernorates.map((gov) => (
                  <option key={gov.governorateID} value={gov.governorateID}>
                    {gov.name}
                  </option>
                ))}
              </select>
              <select
                value={newAgent.delegationID}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, delegationID: e.target.value })
                }
                disabled={!selectedGovernorate}
              >
                <option value="">Select Delegation</option>
                {assignedDelegations
                  .filter((del) => del.governorateID === selectedGovernorate)
                  .map((del) => (
                    <option key={del.delegationID} value={del.delegationID}>
                      {del.name}
                    </option>
                  ))}
              </select>
              <input
                type="text"
                placeholder="Address"
                value={newAgent.address}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, address: e.target.value })
                }
              />
              <div className="panel-buttons">
                <button onClick={handleCreateAgent}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowAddPanel(false);
                    setIsAddAgentPanelCollapsed(false);
                    setNewAgent({
                      name: '',
                      lastname: '',
                      email: '',
                      phone: '',
                      supervisorID: '',
                      delegationID: '',
                      address: '',
                    });
                    setSelectedGovernorate('');
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showEditPanel && editAgent && (
          <div className={`panel edit-agent-panel ${isEditAgentPanelCollapsed ? 'collapsed' : ''}`}>
            <div
              className="panel-header"
              onClick={() => setIsEditAgentPanelCollapsed(!isEditAgentPanelCollapsed)}
            >
              <h2>Edit Agent</h2>
              <button className="toggle-btn">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    d={isEditAgentPanelCollapsed ? 'M4 12h16M12 4v16' : 'M4 12h16'}
                  />
                </svg>
              </button>
            </div>
            <div className="panel-content">
              <input
                type="text"
                placeholder="Name"
                value={editAgent.name || ''}
                onChange={(e) =>
                  setEditAgent({ ...editAgent, name: e.target.value })
                }
              />
              <input
                type="text"
                placeholder="Lastname"
                value={editAgent.lastname || ''}
                onChange={(e) =>
                  setEditAgent({ ...editAgent, lastname: e.target.value })
                }
              />
              <input
                type="email"
                placeholder="Email"
                value={editAgent.email || ''}
                onChange={(e) =>
                  setEditAgent({ ...editAgent, email: e.target.value })
                }
              />
              <input
                type="tel"
                placeholder="Phone"
                value={editAgent.phone || ''}
                onChange={(e) =>
                  setEditAgent({ ...editAgent, phone: e.target.value })
                }
              />
              <select
                value={editAgent.supervisorID || ''}
                onChange={(e) =>
                  setEditAgent({ ...editAgent, supervisorID: e.target.value })
                }
              >
                <option value="">Select Supervisor</option>
                {supervisors.map((sup) => (
                  <option key={sup.userID} value={sup.userID}>
                    {`${sup.firstname} ${sup.lastname}`}
                  </option>
                ))}
              </select>
              <select
                value={selectedGovernorate}
                onChange={(e) => {
                  setSelectedGovernorate(e.target.value);
                  setEditAgent({ ...editAgent, delegationID: '' });
                }}
              >
                <option value="">Select Governorate</option>
                {assignedGovernorates.map((gov) => (
                  <option key={gov.governorateID} value={gov.governorateID}>
                    {gov.name}
                  </option>
                ))}
              </select>
              <select
                value={editAgent.delegationID || ''}
                onChange={(e) =>
                  setEditAgent({ ...editAgent, delegationID: e.target.value })
                }
                disabled={!selectedGovernorate}
              >
                <option value="">Select Delegation</option>
                {assignedDelegations
                  .filter((del) => del.governorateID === selectedGovernorate)
                  .map((del) => (
                    <option key={del.delegationID} value={del.delegationID}>
                      {del.name}
                    </option>
                  ))}
              </select>
              <div className="panel-buttons">
                <button onClick={handleEditAgent}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowEditPanel(false);
                    setIsEditAgentPanelCollapsed(false);
                    setEditAgent(null);
                    setSelectedGovernorate('');
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {routeData.current.response && (
          <div className="route-info">
            <span>
              {`${(routeData.current.response.distance / 1000).toFixed(1)} km | ${Math.round(
                routeData.current.response.duration / 60
              )} min`}
            </span>
            <button onClick={clearRoute}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="agent-list">
          {sortedMarkers.length === 0 ? (
            <div className="no-agents">No agents found</div>
          ) : (
            <div className="agent-scroll">
              {sortedMarkers.map((marker) => (
                <AgentCard
                  key={marker.id}
                  marker={marker}
                  onSelect={(m) => {
                    setSelectedMarker(m);
                    setMapCenter({ lat: m.lat, lng: m.lng });
                    setZoom(15);
                  }}
                  onGetDirections={handleGetDirections}
                  onAddStop={handleAddStop}
                />
              ))}
            </div>
          )}
        </div>
      </LoadScript>
    </div>
  );
};

export default React.memo(MapComponent);