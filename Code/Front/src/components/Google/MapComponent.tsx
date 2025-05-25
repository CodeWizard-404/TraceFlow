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
  getRegionsByUser,
} from '../../apis/locationApi';
import { getUsersByRole } from '../../apis/userAPI';
import './Map.css';
import { mapStyles } from './mapStyles';
import Modal from 'react-modal';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { debounce } from 'lodash';


Modal.setAppElement('#root');

interface ConfirmationModalProps {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, message, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  const [isFadingOut, setIsFadingOut] = useState(false);

  const handleCancel = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      setIsFadingOut(false);
      onCancel();
    }, 300);
  };



  if (!isOpen) return null;

  return (
    <motion.div
      className={`confirmation-modal-overlay ${isFadingOut ? 'fade-out' : 'fade-in'}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: isFadingOut ? 0 : 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="confirmation-modal">
        <p>{message}</p>
        <div className="confirmation-actions">
          <button className="confirm-button" onClick={onConfirm}>
            {t('map.confirm')}
          </button>
          <button className="cancel-button" onClick={handleCancel}>
            {t('map.cancel')}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

interface RoutePoint {
  id: string;
  location: string;
  address: string;
  type: 'origin' | 'waypoint' | 'destination';
  agentId?: string;
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
  const { t } = useTranslation();
  const { effectivePermissions, user } = useAuth();
  const hasPermission = useCallback(
    (perm: string) => effectivePermissions?.some((p) => p.name === perm) || false,
    [effectivePermissions]
  );

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
    name: '',
    lastname: '',
    email: '',
    phone: '',
    supervisorID: '',
    delegationID: '',
    address: '',
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
  const [routeMode, setRouteMode] = useState<'DRIVING' | 'WALKING'>('DRIVING');
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
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [onConfirmAction, setOnConfirmAction] = useState<(() => void) | null>(null);



  const showConfirmation = (message: string, action: () => void) => {
    setConfirmMessage(message);
    setOnConfirmAction(() => action);
    setShowConfirmModal(true);
  };

  const handleConfirm = () => {
    if (onConfirmAction) onConfirmAction();
    setShowConfirmModal(false);
    setOnConfirmAction(null);
  };

  const handleCancel = () => {
    setShowConfirmModal(false);
    setOnConfirmAction(null);
  };

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

  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setMapStyle(e.matches ? 'standard' : 'platformDark');
    };
    handleThemeChange(darkModeMediaQuery);
    darkModeMediaQuery.addEventListener('change', handleThemeChange);
    return () => darkModeMediaQuery.removeEventListener('change', handleThemeChange);
  }, []);

  const sortedMarkers = useMemo(() => {
    if (!userLocation) return filteredMarkers;
    return [...filteredMarkers].sort(
      (a, b) =>
        calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng) -
        calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng)
    );
  }, [filteredMarkers, userLocation]);


  const handleRefreshAgents = useCallback(
    debounce(async () => {
      if (!hasPermission('access_agent_map_locations')) {
        toast.error(t('map.noPermission'));
        return;
      }
      setLoading(true);
      try {
        const agentLocationsData = await getAgentLocations();
        const initialMarkers = await Promise.all(
          agentLocationsData.locations.map(async (loc) => {
            let lat = loc.latitude;
            let lng = loc.longitude;
            let address = loc.address;
            if (lat == null || lng == null || lat === 0 || lng === 0) {
              try {
                const delegation = delegations.find((d) => d.delegationID === loc.delegation?.id);
                if (delegation) {
                  const geocode = await getGeocode(`${delegation.name}, Tunisia`);
                  lat = geocode.latitude;
                  lng = geocode.longitude;
                  address = geocode.formattedAddress || delegation.name;
                } else {
                  lat = defaultCenter.lat;
                  lng = defaultCenter.lng;
                  address = t('map.unknownDelegation');
                }
              } catch (err) {
                console.error(`Failed to geocode delegation for agent ${loc.agentId}:`, err);
                lat = defaultCenter.lat;
                lng = defaultCenter.lng;
                address = t('map.unknownDelegation');
              }
            }
            return {
              id: loc.agentId,
              lat,
              lng,
              name: loc.name,
              lastname: loc.lastname,
              email: loc.email,
              phone: loc.phone,
              address,
              source: loc.source || 'agent',
              delegation: loc.delegation
                ? { id: loc.delegation.id, name: loc.delegation.name, governorateID: (loc.delegation as any).governorateID }
                : undefined,
              governorate: loc.governorate ? { id: loc.governorate.id, name: loc.governorate.name } : undefined,
              region: loc.region,
            };
          })
        );
        setAllMarkers(initialMarkers);
        setFilteredMarkers(initialMarkers);
        toast.success(t('map.agentsRefreshed'));
      } catch (err) {
        console.error('Refresh Agents Error:', err);
        toast.error(t('map.refreshFailed'));
      } finally {
        setLoading(false);
      }
    }, 1000), // Debounce for 1 second
    [hasPermission, t, delegations]
  );
  useEffect(() => {
    const loadInitialData = async () => {
      if (!user?.userID) {
        toast.error(t('map.userNotAuthenticated'));
        return;
      }
      setLoading(true);
      try {
        const [
          regionData,
          governorateData,
          delegationData,
          agentLocationsData,
          supervisorsData,
        ] = await Promise.all([
          hasPermission('access_regions')
            ? getAllRegions()
            : hasPermission('access_regions_by_user')
              ? getRegionsByUser(user.userID)
              : [],
          hasPermission('access_governorates')
            ? getAllGovernorates()
            : hasPermission('access_governorates_by_user')
              ? getGovernoratesByUser(user.userID)
              : [],
          hasPermission('access_delegations')
            ? getAllDelegations()
            : hasPermission('access_delegations_by_user')
              ? getDelegationsByUser(user.userID)
              : [],
          hasPermission('access_agent_map_locations') ? getAgentLocations() : { locations: [] },
          hasPermission('access_supervisors')
            ? getUsersByRole(import.meta.env.VITE_ROLES_SUPERVISOR)
            : [],
        ]);

        setRegions(regionData);
        setGovernorates(governorateData);
        setDelegations(delegationData);
        setSupervisors(supervisorsData);

        const initialMarkers = hasPermission('access_agent_map_locations')
          ? await Promise.all(
            agentLocationsData.locations.map(async (loc) => {
              let lat = loc.latitude;
              let lng = loc.longitude;
              let address = loc.address;
              if (lat == null || lng == null || lat === 0 || lng === 0) {
                try {
                  const delegation = delegationData.find((d) => d.delegationID === loc.delegation?.id);
                  if (delegation) {
                    const geocode = await getGeocode(`${delegation.name}, Tunisia`);
                    lat = geocode.latitude;
                    lng = geocode.longitude;
                    address = geocode.formattedAddress || delegation.name;
                  } else {
                    lat = defaultCenter.lat;
                    lng = defaultCenter.lng;
                    address = t('map.unknownDelegation');
                  }
                } catch (err) {
                  console.error(`Failed to geocode delegation for agent ${loc.agentId}:`, err);
                  lat = defaultCenter.lat;
                  lng = defaultCenter.lng;
                  address = t('map.unknownDelegation');
                }
              }
              return {
                id: loc.agentId,
                lat,
                lng,
                name: loc.name,
                lastname: loc.lastname,
                email: loc.email,
                phone: loc.phone,
                address,
                source: loc.source || 'agent',
                delegation: loc.delegation
                  ? { id: loc.delegation.id, name: loc.delegation.name, governorateID: (loc.delegation as any).governorateID }
                  : undefined,
                governorate: loc.governorate ? { id: loc.governorate.id, name: loc.governorate.name } : undefined,
                region: loc.region,
              };
            })
          )
          : [];
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
              toast.error(t('map.locationError'));
            }
          );
        }
      } catch (err) {
        console.error('Initial Data Error:', err);
        toast.error(t('map.loadInitialFailed'));
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [user?.userID, hasPermission, t]); // Only depend on user.userID

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
    } else {
      setAssignedGovernorates([]);
      setAssignedDelegations([]);
    }
  }, [filterSupervisor]);

  const handleCalculateRoute = useCallback(
    async (points: RoutePoint[], mode: 'DRIVING' | 'WALKING', optimize: boolean = false) => {
      if (points.length < 2) {
        toast.error(t('map.routePointsError'));
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
        const directions = await getDirections(origin, destination, mode.toLowerCase(), waypointsForApi, optimize);
        console.log('Directions Response:', directions);
        if (directions.polyline && directions.distance > 0 && directions.duration > 0) {
          routeData.current = {
            points,
            response: directions,
            path: polyline.decode(directions.polyline).map(([lat, lng]) => ({ lat, lng })),
            traffic:
              directions.trafficSegments?.flatMap((segment) =>
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
          toast.error(t('map.invalidRouteData'));
        }
      } catch (err) {
        console.error('Calculate Route Error:', err);
        toast.error(t('map.calculateRouteFailed'));
      }
    },
    [t]
  );

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
        toast.error(t('map.updateLocationFailed'));
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
        toast.warn(t('map.retryLocation', { count: retryCount.current, max: maxRetries }));
        return;
      }

      toast.error(t('map.trackLocationFailed', { message: error.message }));
      if (lastPosition.current) {
        setUserLocation({ lat: lastPosition.current.lat, lng: lastPosition.current.lng });
        setMapCenter({ lat: lastPosition.current.lat, lng: lastPosition.current.lng });
      }
    };

    const startWatching = () => {
      if (watchActive.current || !navigator.geolocation) return;

      watchActive.current = true;
      locationWatchId.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
        enableHighAccuracy: true,
        timeout,
        maximumAge,
      });
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
  }, [carMode, routeMode, t, handleCalculateRoute]);

  const handleManualLocation = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (carMode && e.latLng) {
        const newLocation = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        setUserLocation(newLocation);
        setMapCenter(newLocation);
        lastPosition.current = { ...newLocation, timestamp: Date.now() };
        updateUserLocation('currentUser', newLocation).catch((err) => {
          console.error('Manual Location Update Error:', err);
          toast.error(t('map.updateLocationFailed'));
        });
      }
    },
    [carMode, t]
  );

  useEffect(() => {
    if (newAgent.supervisorID) {
      Promise.all([getGovernoratesByUser(newAgent.supervisorID), getDelegationsByUser(newAgent.supervisorID)]).then(
        ([govs, dels]) => {
          setAssignedGovernorates(govs);
          setAssignedDelegations(dels);
        }
      );
    } else {
      setAssignedGovernorates([]);
      setAssignedDelegations([]);
    }
  }, [newAgent.supervisorID]);

  useEffect(() => {
    if (filterSupervisor) {
      Promise.all([getGovernoratesByUser(filterSupervisor), getDelegationsByUser(filterSupervisor)]).then(
        ([govs, dels]) => {
          setAssignedGovernorates(govs);
          setAssignedDelegations(dels);
        }
      );
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
      toast.error(t('map.searchFailed'));
      setFilteredMarkers(allMarkers);
    }
  }, [searchQuery, allMarkers, t]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(handleSearch, 500);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, handleSearch]);


  useEffect(() => {
    console.log('MapComponent rendered', {
      userId: user?.userID,
      effectivePermissions,
      filterSupervisor,
      newAgentSupervisor: newAgent.supervisorID,
    });
  }, [user, effectivePermissions, filterSupervisor, newAgent.supervisorID]);



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
    if (filterSupervisor) filtered = filtered.filter((m) => m.supervisor?.userID === filterSupervisor || !m.supervisor);
    setFilteredMarkers(filtered);
  }, [filterRegion, filterGovernorate, filterDelegation, filterSupervisor, allMarkers]);

  useEffect(() => {
    handleFilter();
  }, [filterRegion, filterGovernorate, filterSupervisor, handleFilter]);

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

  const handleMapClick = useCallback(
    async (event: google.maps.MapMouseEvent) => {
      if (addingAgentMode) {
        setAddingAgentMode(false);
        const lat = event.latLng?.lat();
        const lng = event.latLng?.lng();
        if (lat && lng) {
          try {
            const geocode = await getGeocode(`${lat},${lng}`);
            if (!geocode.formattedAddress) {
              toast.error(t('map.addressError'));
              return;
            }
            setNewAgent({ ...newAgent, address: geocode.formattedAddress });
            closeAllPanels();
            setShowAddPanel(true);
          } catch (err) {
            console.error('Map Click Error:', err);
            toast.error(t('map.getAddressFailed'));
          }
        }
      } else if (carMode) {
        handleManualLocation(event);
      } else if (selectedMarker) {
        setSelectedMarker(null);
      }
    },
    [addingAgentMode, newAgent, carMode, handleManualLocation, selectedMarker, t, closeAllPanels]
  );

  const handleCreateAgent = useCallback(async () => {
    if (
      !newAgent.name ||
      !newAgent.lastname ||
      !newAgent.email ||
      !newAgent.phone ||
      !newAgent.delegationID ||
      !newAgent.supervisorID ||
      !newAgent.address
    ) {
      toast.error(t('map.allFieldsRequired'));
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
      toast.success(t('map.agentCreated'));
    } catch (err) {
      console.error('Create Agent Error:', err);
      toast.error(t('map.createAgentFailed'));
    } finally {
      setLoading(false);
    }
  }, [newAgent, t]);

  const handleEditAgent = useCallback(async () => {
    if (!editAgent || !editAgent.agentID) {
      toast.error(t('map.noAgentSelected'));
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
        prev.map((marker) => (marker.id === editAgent.agentID ? { ...marker, ...updated } : marker))
      );
      setFilteredMarkers((prev) =>
        prev.map((marker) => (marker.id === editAgent.agentID ? { ...marker, ...updated } : marker))
      );
      setShowEditPanel(false);
      setEditAgent(null);
      toast.success(t('map.agentUpdated'));
    } catch (err) {
      console.error('Edit Agent Error:', err);
      toast.error(t('map.updateAgentFailed'));
    } finally {
      setLoading(false);
    }
  }, [editAgent, t]);

  const handleMarkerDragStart = useCallback(
    (markerId: string) => {
      const marker = allMarkers.find((m) => m.id === markerId);
      if (marker) setDraggingMarker({ id: markerId, original: { ...marker } });
    },
    [allMarkers]
  );

  const handleMarkerDragEnd = useCallback(
    async (event: google.maps.MapMouseEvent, markerId: string) => {
      const lat = event.latLng?.lat();
      const lng = event.latLng?.lng();
      if (!lat || !lng || !draggingMarker) {
        toast.error(t('map.invalidMarkerPosition'));
        revertMarkerPosition(markerId);
        return;
      }
      try {
        const geocode = await getGeocode(`${lat},${lng}`);
        if (!geocode.formattedAddress) {
          toast.error(t('map.addressError'));
          revertMarkerPosition(markerId);
          return;
        }
        showConfirmation(
          t('map.confirmUpdateLocation', {
            name: draggingMarker.original.name,
            lastname: draggingMarker.original.lastname,
            address: geocode.formattedAddress,
          }),
          async () => {
            try {
              const updated = await correctAgentLocation(markerId, lat, lng, geocode.formattedAddress);
              updateMarkerPosition(markerId, {
                latitude: updated.latitude,
                longitude: updated.longitude,
                address: updated.address,
                delegation: updated.delegation,
              });
              setMapCenter({ lat: updated.latitude, lng: updated.longitude });
              setZoom(15);
              toast.success(t('map.locationUpdated'));
            } catch (err) {
              console.error('Drag End Error:', err);
              toast.error(t('map.updateLocationFailed'));
              revertMarkerPosition(markerId);
            }
          }
        );
      } catch (err) {
        console.error('Drag End Error:', err);
        toast.error(t('map.updateLocationFailed'));
        revertMarkerPosition(markerId);
      } finally {
        setDraggingMarker(null);
      }
    },
    [draggingMarker, t]
  );

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

  const handleMarkerClick = useCallback(
    async (marker: AgentMarker) => {
      try {
        const agent = await getAgentById(marker.id);
        const supervisor = await getAgentSupervisor(marker.id).catch(() => null);
        setSelectedMarker({
          ...marker,
          supervisor: supervisor
            ? { userID: supervisor.userID, firstname: supervisor.firstname, lastname: supervisor.lastname }
            : undefined,
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
        setSelectedAgents((prev) => (prev.includes(marker.id) ? prev : [...prev, marker.id]));
      } catch (err) {
        console.error('Agent Details Error:', err);
        toast.error(t('map.fetchAgentDetailsFailed'));
      }
    },
    [t]
  );



  const handleGetDirections = useCallback(
    async (marker: AgentMarker) => {
      if (!userLocation) {
        toast.error(t('map.userLocationNotAvailable'));
        return;
      }
      try {
        const originCoords = `${userLocation.lat},${userLocation.lng}`;
        const destCoords = `${marker.lat},${marker.lng}`;
        const [originGeocode, destGeocode] = await Promise.all([getGeocode(originCoords), getGeocode(destCoords)]);
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
            agentId: marker.id,
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
        toast.error(t('map.getDirectionsFailed'));
      }
    },
    [userLocation, routeMode, handleCalculateRoute, t, closeAllPanels]
  );

  const handleAddStop = useCallback(
    async (marker: AgentMarker) => {
      if (!userLocation) {
        toast.error(t('map.userLocationNotAvailable'));
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
          agentId: marker.id,
        };
        let newPoints = [...routeData.current.points];
        if (newPoints.length === 0) {
          newPoints = [
            {
              id: 'origin',
              location: `${userLocation.lat},${userLocation.lng}`,
              address: t('map.myLocation'),
              type: 'origin',
            },
            newWaypoint,
          ];
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
        toast.error(t('map.addStopFailed'));
      }
    },
    [userLocation, routeMode, handleCalculateRoute, t]
  );

  const handleOptimizeRoute = useCallback(() => {
    if (routeData.current.points.length < 3) {
      toast.error(t('map.optimizeRouteError'));
      return;
    }
    handleCalculateRoute(routeData.current.points, routeMode, true);
  }, [handleCalculateRoute, routeMode, t]);

  const clearRoute = useCallback(() => {
    routeData.current = { points: [], response: null, path: [], traffic: [] };
    setShowDirectionsPanel(false);
    setIsDirectionsPanelCollapsed(false);
  }, []);

  const removeAgentFromRoute = useCallback(
    (agentId: string) => {
      const newPoints = routeData.current.points.filter((p) => p.agentId !== agentId);
      routeData.current.points = newPoints;
      if (newPoints.length >= 2) {
        handleCalculateRoute(newPoints, routeMode);
      } else {
        clearRoute();
      }
    },
    [handleCalculateRoute, routeMode, clearRoute]
  );

  const handleReturnToCurrentLocation = useCallback(() => {
    if (!userLocation) {
      toast.error(t('map.userLocationNotAvailable'));
      return;
    }
    setMapCenter(userLocation);
    setZoom(15);
  }, [userLocation, t]);

  const toggleCarMode = useCallback(async () => {
    if (!carMode) {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        if (permission.state === 'denied') {
          toast.error(t('map.locationAccessDenied'));
          return;
        }
        if (!userLocation && !lastPosition.current) {
          toast.error(t('map.userLocationNotAvailable'));
          return;
        }
      } catch (err) {
        console.error('Permission Check Error:', err);
        toast.error(t('map.checkPermissionsFailed'));
        return;
      }
    }
    setCarMode((prev) => !prev);
  }, [carMode, userLocation, t]);

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



  const AgentCard = React.memo(
    ({
      marker,
      onSelect,
      onGetDirections,
      onAddStop,
    }: {
      marker: AgentMarker;
      onSelect: (marker: AgentMarker) => void;
      onGetDirections: (marker: AgentMarker) => void;
      onAddStop: (marker: AgentMarker) => void;
    }) => {
      const isInRoute = routeData.current.points.some((p) => p.agentId === marker.id);
      return (
        <div
          className={`agent-card ${selectedAgents.includes(marker.id) ? 'selected' : ''} ${selectedMarker?.id === marker.id ? 'info-active' : ''
            }`}
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
            {isInRoute ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeAgentFromRoute(marker.id);
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                {t('map.agentCard.remove')}
              </button>
            ) : routeData.current.response ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddStop(marker);
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {t('map.agentCard.addStop')}
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onGetDirections(marker);
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {t('map.agentCard.directions')}
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `tel:${marker.phone}`;
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              {t('map.agentCard.call')}
            </button>
          </div>
        </div>
      );
    }
  );

  const WaypointList = React.memo(() => (
    <div className="waypoint-list">
      <div className="waypoint-header">
        <h3>{t('map.routes.title')}</h3>
        {routeData.current.points.length > 2 && (
          <button onClick={handleOptimizeRoute}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12h8M12 4v16M20 12h-8m-4 4h8m-8-8h8" />
            </svg>
            {t('map.routes.optimize')}
          </button>
        )}
      </div>
      {routeData.current.points.length === 0 ? (
        <p>{t('map.routes.noStops')}</p>
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

  if (loading) return <div className="loading">{t('map.loading')}</div>;

  return (
    <div className={`map-container ${addingAgentMode ? 'adding-agent' : ''}`}>
      <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY} libraries={libraries}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={mapCenter}
          zoom={zoom}
          onLoad={onMapLoad}
          onClick={handleMapClick}
          options={{
            styles: mapStyles[mapStyle],
            mapTypeId: mapStyle === 'satellite' ? 'hybrid' : 'roadmap',
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          }}
        >
          <div className="map-controls">
            <Autocomplete onLoad={onAutocompleteLoad} onPlaceChanged={onPlaceChanged}>
              <input
                type="text"
                placeholder={t('map.searchPlaceholder')}
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
                title={t('map.filter')}
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
                title={t('map.directions')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </button>
              <button
                className={`control-btn ${carMode ? 'active' : ''}`}
                onClick={toggleCarMode}
                title={carMode ? t('map.carModeOff') : t('map.carModeOn')}
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
                <option value="standard">{t('map.mapStyles.standard')}</option>
                <option value="satellite">{t('map.mapStyles.satellite')}</option>
                <option value="minimal">{t('map.mapStyles.minimal')}</option>
                <option value="platformLight">{t('map.mapStyles.platformLight')}</option>
                <option value="platformDark">{t('map.mapStyles.platformDark')}</option>
                <option value="silver">{t('map.mapStyles.silver')}</option>
                <option value="retro">{t('map.mapStyles.retro')}</option>
                <option value="aubergine">{t('map.mapStyles.aubergine')}</option>
                <option value="night">{t('map.mapStyles.night')}</option>
                <option value="dark">{t('map.mapStyles.dark')}</option>
              </select>
            </div>
          </div>

          {showFilterPanel && (
            <div className={`panel filter-panel ${isFilterPanelCollapsed ? 'collapsed' : ''}`}>
              <div className="panel-header" onClick={() => setIsFilterPanelCollapsed(!isFilterPanelCollapsed)}>
                <h2>{t('map.filters.title')}</h2>
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
                    <path d={isFilterPanelCollapsed ? 'M4 12h16M12 4v16' : 'M4 12h16'} />
                  </svg>
                </button>
              </div>
              <div className="panel-content">
                <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)}>
                  <option value="">{t('map.filters.allRegions')}</option>
                  {regions.map((r) => (
                    <option key={r.regionID} value={r.regionID}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <select value={filterGovernorate} onChange={(e) => setFilterGovernorate(e.target.value)}>
                  <option value="">{t('map.filters.allGovernorates')}</option>
                  {filteredGovernorates.map((g) => (
                    <option key={g.governorateID} value={g.governorateID}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <select value={filterDelegation} onChange={(e) => setFilterDelegation(e.target.value)}>
                  <option value="">{t('map.filters.allDelegations')}</option>
                  {filteredDelegations.map((d) => (
                    <option key={d.delegationID} value={d.delegationID}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <select value={filterSupervisor} onChange={(e) => setFilterSupervisor(e.target.value)}>
                  <option value="">{t('map.filters.allSupervisors')}</option>
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
                  <h2>{t('map.directionsPanel.title')}</h2>
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
                      <path d={isDirectionsPanelCollapsed ? 'M4 12h16M12 4v16' : 'M4 12h16'} />
                    </svg>
                  </button>
                </div>
                <div className="panel-content">
                  <div className="origin-input">
                    <input
                      type="text"
                      placeholder={t('map.directionsPanel.originPlaceholder')}
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
                            address: t('map.directionsPanel.myLocation'),
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
                      title={t('map.directionsPanel.myLocation')}
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
                  </div>
                  <input
                    type="text"
                    placeholder={t('map.directionsPanel.destinationPlaceholder')}
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
                    <option value="DRIVING">{t('map.directionsPanel.modes.driving')}</option>
                    <option value="WALKING">{t('map.directionsPanel.modes.walking')}</option>
                  </select>
                  <div className="directions-buttons">
                    <button onClick={() => handleCalculateRoute(routeData.current.points, routeMode)}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                      {t('map.directionsPanel.go')}
                    </button>
                    <button onClick={clearRoute}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                      {t('map.directionsPanel.clear')}
                    </button>
                  </div>
                </div>
              </div>
              <div className={`sub-panel routes-sub-panel ${isRoutesPanelCollapsed ? 'collapsed' : ''}`}>
                <div className="panel-header" onClick={() => setIsRoutesPanelCollapsed(!isRoutesPanelCollapsed)}>
                  <h2>{t('map.routes.title')}</h2>
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
                    draggable={hasPermission('update_agents')}
                    onDragStart={() => handleMarkerDragStart(marker.id)}
                    onDragEnd={(e: google.maps.MapMouseEvent) => handleMarkerDragEnd(e, marker.id)}
                    onClick={() => handleMarkerClick(marker)}
                    icon={{
                      url:
                        marker.lat != null && marker.lng != null && marker.lat !== 0 && marker.lng !== 0 && marker.source === 'agent'
                          ? 'https://maps.gstatic.com/mapfiles/ms2/micons/lightblue.png'
                          : 'https://maps.gstatic.com/mapfiles/ms2/micons/red.png',
                    }}
                  />
                ))}
                {userLocation && (
                  <Marker
                    position={userLocation}
                    title={t('map.yourLocation')}
                    icon={{
                      anchor: window.google ? new window.google.maps.Point(8, 8) : undefined,
                      scaledSize: window.google ? new window.google.maps.Size(32, 32) : undefined,
                      url: 'https://maps.gstatic.com/mapfiles/ms2/micons/man.png',
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
                <p>{selectedMarker.address}</p>
                <p>
                  {t('map.infoWindow.phone')}: {selectedMarker.phone}
                </p>
                <div className="info-buttons">
                  {hasPermission('update_agents') && (
                    <button
                      onClick={() => {
                        closeAllPanels();
                        setShowEditPanel(true);
                        setIsEditAgentPanelCollapsed(false);
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
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      {t('map.infoWindow.edit')}
                    </button>
                  )}
                  {routeData.current.response ? (
                    <button onClick={() => handleAddStop(selectedMarker)}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {t('map.infoWindow.addStop')}
                    </button>
                  ) : (
                    <button onClick={() => handleGetDirections(selectedMarker)}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {t('map.infoWindow.directions')}
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
          title={t('map.returnToMyLocation')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
            <path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
          </svg>
        </button>

        {hasPermission('create_agents') && (
          <button
            className="add-agent-btn"
            onClick={() => {
              setAddingAgentMode(true);
              toast.info(t('map.addAgentPrompt'));
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t('map.addAgent')}
          </button>
        )}

        {hasPermission('access_agent_map_locations') && (
          <button className="refresh-agents-btn" onClick={handleRefreshAgents} title={t('map.refreshAgents')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        )}

        <ConfirmationModal isOpen={showConfirmModal} message={confirmMessage} onConfirm={handleConfirm} onCancel={handleCancel} />

        {showAddPanel && (
          <div className={`panel add-agent-panel ${isAddAgentPanelCollapsed ? 'collapsed' : ''}`}>
            <div className="panel-header" onClick={() => setIsAddAgentPanelCollapsed(!isAddAgentPanelCollapsed)}>
              <h2>{t('map.addAgentPanel.title')}</h2>
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
                  <path d={isAddAgentPanelCollapsed ? 'M4 12h16M12 4v16' : 'M4 12h16'} />
                </svg>
              </button>
            </div>
            <div className="panel-content">
              <input
                type="text"
                placeholder={t('map.addAgentPanel.name')}
                value={newAgent.name}
                onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
              />
              <input
                type="text"
                placeholder={t('map.addAgentPanel.lastname')}
                value={newAgent.lastname}
                onChange={(e) => setNewAgent({ ...newAgent, lastname: e.target.value })}
              />
              <input
                type="email"
                placeholder={t('map.addAgentPanel.email')}
                value={newAgent.email}
                onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })}
              />
              <input
                type="tel"
                placeholder={t('map.addAgentPanel.phone')}
                value={newAgent.phone}
                onChange={(e) => setNewAgent({ ...newAgent, phone: e.target.value })}
              />
              <select
                value={newAgent.supervisorID}
                onChange={(e) => setNewAgent({ ...newAgent, supervisorID: e.target.value })}
              >
                <option value="">{t('map.addAgentPanel.supervisor')}</option>
                {supervisors.map((sup) => (
                  <option key={sup.userID} value={sup.userID}>{`${sup.firstname} ${sup.lastname}`}</option>
                ))}
              </select>
              <select
                value={selectedGovernorate}
                onChange={(e) => {
                  setSelectedGovernorate(e.target.value);
                  setNewAgent({ ...newAgent, delegationID: '' });
                }}
              >
                <option value="">{t('map.addAgentPanel.governorate')}</option>
                {assignedGovernorates.map((gov) => (
                  <option key={gov.governorateID} value={gov.governorateID}>
                    {gov.name}
                  </option>
                ))}
              </select>
              <select
                value={newAgent.delegationID}
                onChange={(e) => setNewAgent({ ...newAgent, delegationID: e.target.value })}
                disabled={!selectedGovernorate}
              >
                <option value="">{t('map.addAgentPanel.delegation')}</option>
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
                placeholder={t('map.addAgentPanel.address')}
                value={newAgent.address}
                onChange={(e) => setNewAgent({ ...newAgent, address: e.target.value })}
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
                  {t('map.addAgentPanel.save')}
                </button>
                <button
                  onClick={() => {
                    setShowAddPanel(false);
                    setNewAgent({ name: '', lastname: '', email: '', phone: '', supervisorID: '', delegationID: '', address: '' });
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
                  {t('map.addAgentPanel.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        {showEditPanel && editAgent && (
          <div className={`panel edit-agent-panel ${isEditAgentPanelCollapsed ? 'collapsed' : ''}`}>
            <div className="panel-header" onClick={() => setIsEditAgentPanelCollapsed(!isEditAgentPanelCollapsed)}>
              <h2>{t('map.editAgentPanel.title')}</h2>
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
                  <path d={isEditAgentPanelCollapsed ? 'M4 12h16M12 4v16' : 'M4 12h16'} />
                </svg>
              </button>
            </div>
            <div className="panel-content">
              <input
                type="text"
                placeholder={t('map.editAgentPanel.name')}
                value={editAgent.name || ''}
                onChange={(e) => setEditAgent({ ...editAgent, name: e.target.value })}
              />
              <input
                type="text"
                placeholder={t('map.editAgentPanel.lastname')}
                value={editAgent.lastname || ''}
                onChange={(e) => setEditAgent({ ...editAgent, lastname: e.target.value })}
              />
              <input
                type="email"
                placeholder={t('map.editAgentPanel.email')}
                value={editAgent.email || ''}
                onChange={(e) => setEditAgent({ ...editAgent, email: e.target.value })}
              />
              <input
                type="tel"
                placeholder={t('map.editAgentPanel.phone')}
                value={editAgent.phone || ''}
                onChange={(e) => setEditAgent({ ...editAgent, phone: e.target.value })}
              />
              <select
                value={editAgent.supervisorID || ''}
                onChange={(e) => setEditAgent({ ...editAgent, supervisorID: e.target.value })}
              >
                <option value="">{t('map.editAgentPanel.supervisor')}</option>
                {supervisors.map((sup) => (
                  <option key={sup.userID} value={sup.userID}>{`${sup.firstname} ${sup.lastname}`}</option>
                ))}
              </select>
              <select
                value={selectedGovernorate}
                onChange={(e) => {
                  setSelectedGovernorate(e.target.value);
                  setEditAgent({ ...editAgent, delegationID: '' });
                }}
              >
                <option value="">{t('map.editAgentPanel.governorate')}</option>
                {assignedGovernorates.map((gov) => (
                  <option key={gov.governorateID} value={gov.governorateID}>
                    {gov.name}
                  </option>
                ))}
              </select>
              <select
                value={editAgent.delegationID || ''}
                onChange={(e) => setEditAgent({ ...editAgent, delegationID: e.target.value })}
                disabled={!selectedGovernorate}
              >
                <option value="">{t('map.editAgentPanel.delegation')}</option>
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
                  {t('map.editAgentPanel.save')}
                </button>
                <button
                  onClick={() => {
                    setShowEditPanel(false);
                    setEditAgent(null);
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
                  {t('map.editAgentPanel.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="agent-list">
          {sortedMarkers.length === 0 ? (
            <p>{t('map.noAgents')}</p>
          ) : (
            <div className="agent-scroll">
              {sortedMarkers.map((marker) => (
                <AgentCard
                  key={marker.id}
                  marker={marker}
                  onSelect={(m) => {
                    setMapCenter({ lat: m.lat, lng: m.lng });
                    setZoom(15);
                    setSelectedMarker(m);
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

export default MapComponent;