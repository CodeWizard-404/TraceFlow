/* eslint-disable react-hooks/exhaustive-deps */
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
  getAgentsByUser,
  getAgentsByDelegation,
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
  getDelegationsByGovernorate,
  getGovernoratesByRegion,
} from '../../apis/locationApi';
import {
  getUsersByRole,
  getUsersByGovernorate,
  getUsersByDelegation,
} from '../../apis/userAPI';
import './Map.css';
import { mapStyles } from './mapStyles';
import Modal from 'react-modal';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { debounce } from 'lodash';
import Delegation from 'models/Delegation';
import Governorate from 'models/Governorate';
import { DirectionsResponse } from '../../apis/';

Modal.setAppElement('#root');

const PERMISSIONS = {
  ACCESS_AGENT_MAP_LOCATIONS: import.meta.env.VITE_PERMISSIONS_READ_AGENT_MAP_LOCATIONS,
  CREATE_AGENTS: import.meta.env.VITE_PERMISSIONS_CREATE_AGENTS,
  UPDATE_AGENTS: import.meta.env.VITE_PERMISSIONS_UPDATE_AGENTS,
  ACCESS_REGIONS: import.meta.env.VITE_PERMISSIONS_READ_REGIONS,
  ACCESS_GOVERNORATES: import.meta.env.VITE_PERMISSIONS_READ_GOVERNORATES,
  ACCESS_DELEGATIONS: import.meta.env.VITE_PERMISSIONS_READ_DELEGATIONS,
  ACCESS_REGIONS_BY_USER: import.meta.env.VITE_PERMISSIONS_ACCESS_REGIONS_BY_USER,
  ACCESS_GOVERNORATES_BY_USER: import.meta.env.VITE_PERMISSIONS_ACCESS_GOVERNORATES_BY_USER,
  ACCESS_DELEGATIONS_BY_USER: import.meta.env.VITE_PERMISSIONS_ACCESS_DELEGATIONS_BY_USER,
  ACCESS_SUPERVISORS: import.meta.env.VITE_PERMISSIONS_READ_SUPERVISORS,
} as const;

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
  time?: string;
  reasons?: string;
}

interface User {
  userID: string;
  firstname: string;
  lastname: string;
}

interface MapComponentProps {
  visits?: {
    visitID: string;
    latitude: number;
    longitude: number;
    location: string;
    time: string;
    reasons: string;
    agentName: string;
  }[];
  userLocation?: { lat: number; lng: number } | null;
  isTimesheetModal?: boolean;
}



const containerStyle = { width: '100%', height: '80vh' };
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

const cleanInstruction = (instruction: string): string => {
  const div = document.createElement('div');
  div.innerHTML = instruction;
  let text = div.textContent || div.innerText || '';
  text = text.replace(/\s+/g, ' ').trim();
  text = text.replace(/Go through \d+ roundabout/, 'Pass through roundabout');
  return text;
};

const getStepHeading = (step: DirectionsResponse['steps'][0]) => {
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

const MapComponent: React.FC<MapComponentProps> = ({
  visits = [],
  userLocation: propUserLocation,
  isTimesheetModal = false,
}) => {
  const { t } = useTranslation();
  const { effectivePermissions, user } = useAuth();
  const hasPermission = useCallback(
    (perm: string) => effectivePermissions?.some((p) => p.name === perm) || false,
    [effectivePermissions]
  );

  const [allMarkers, setAllMarkers] = useState<AgentMarker[]>([]);
  const [filteredMarkers, setFilteredMarkers] = useState<AgentMarker[]>(allMarkers);
  const [filteredAgents, setFilteredAgents] = useState<AgentMarker[]>([]);
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
  const [isDirectionsPanelCollapsed, setIsDirectionsPanelCollapsed] = useState(true);
  const [isRoutesPanelCollapsed, setIsRoutesPanelCollapsed] = useState(true);
  const [isAddAgentPanelCollapsed, setIsAddAgentPanelCollapsed] = useState(false);
  const [isEditAgentPanelCollapsed, setIsEditAgentPanelCollapsed] = useState(false);
  const [routeMode, setRouteMode] = useState<'DRIVING' | 'WALKING'>('DRIVING');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(propUserLocation || null);
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
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [isRouteProcessing, setIsRouteProcessing] = useState(false);
  const routePointsRef = useRef(routePoints);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
  const [isStepsPanelCollapsed, setIsStepsPanelCollapsed] = useState(true);
  const [showMobileControls, setShowMobileControls] = useState(false);

  const userPermissions = useMemo(
    () => ({
      accessAgentMapLocations: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_AGENT_MAP_LOCATIONS
      ),
      createAgents: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_AGENTS
      ),
      updateAgents: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_UPDATE_AGENTS
      ),
      accessRegions: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_REGIONS
      ),
      accessGovernorates: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_GOVERNORATES
      ),
      accessDelegations: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_DELEGATIONS
      ),
      accessRegionsByUser: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_REGIONS_BY_USER
      ),
      accessGovernoratesByUser: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_GOVERNORATES_BY_USER
      ),
      accessDelegationsByUser: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_DELEGATIONS_BY_USER
      ),
      accessSupervisors: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_SUPERVISORS
      ),
    }),
    [effectivePermissions]
  );

  const toggleMobileControls = useCallback(() => {
    setShowMobileControls((prev) => !prev);
  }, []);

  // Sync routePointsRef with routePoints
  useEffect(() => {
    routePointsRef.current = routePoints;
  }, [routePoints]);



  useEffect(() => {
    if (isTimesheetModal) {
      setFilteredMarkers(allMarkers);
      setFilteredAgents(allMarkers);
    }
  }, [allMarkers, isTimesheetModal]);



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
    response: DirectionsResponse | null;
    path: google.maps.LatLngLiteral[];
    traffic: Array<{ path: google.maps.LatLngLiteral[]; color: string }>;
  }>({
    points: [], // Will be synced with routePoints state
    response: null,
    path: [],
    traffic: [],
  });

  // Sync routeData.current.points with routePoints state
  useEffect(() => {
    routeData.current.points = routePoints;
    console.log('Synced routeData.current.points:', routePoints.map(p => ({ id: p.id, type: p.type, agentId: p.agentId })));
  }, [routePoints]);

  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setMapStyle(e.matches ? 'standard' : 'platformDark');
    };
    handleThemeChange(darkModeMediaQuery);
    darkModeMediaQuery.addEventListener('change', handleThemeChange);
    return () => darkModeMediaQuery.removeEventListener('change', handleThemeChange);
  }, []);

  useEffect(() => {
    console.log('Rendered with classes:', {
      mapContainer: `map-container ${addingAgentMode ? 'adding-agent' : ''}`,
      mapControls: `map-controls ${showMobileControls ? 'visible-mobile' : ''}`,
    });
  });



  useEffect(() => {
    if (isTimesheetModal && visits.length > 0) {
      const newMarkers = visits.map((visit) => ({
        id: visit.visitID,
        lat: visit.latitude,
        lng: visit.longitude,
        name: visit.agentName.split(' ')[0] || 'Unknown',
        lastname: visit.agentName.split(' ')[1] || '',
        email: '',
        phone: '',
        address: visit.location,
        source: 'visit',
        time: visit.time, // Include visit time
        reasons: visit.reasons, // Include visit reasons
      }));
      setAllMarkers(newMarkers);
      setFilteredMarkers(newMarkers);
      setFilteredAgents(newMarkers);
    }
  }, [visits, isTimesheetModal]);


  const sortedMarkers = useMemo(() => {
    if (!userLocation) return filteredMarkers;
    return [...filteredMarkers].sort(
      (a, b) =>
        calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng) -
        calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng)
    );
  }, [filteredMarkers, userLocation]);

  const parsedSteps = useMemo(() => {
    if (!routeData.current.response?.steps) return [];
    return routeData.current.response.steps.map(step => ({
      ...step,
      instruction: cleanInstruction(step.instruction),
    }));
  }, [routeData.current.response?.steps]);

  const handleRefreshAgents = useCallback(
    debounce(async () => {
      if (!userPermissions.accessAgentMapLocations) {
        toast.error(t('map.noPermission'));
        return;
      }
      try {
        const agentLocationsData = await getAgentLocations();
        const updatedMarkers = await Promise.all(
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
        // Update only the necessary states
        setAllMarkers(updatedMarkers);
        setFilteredMarkers(updatedMarkers);
        setFilteredAgents(updatedMarkers);
        toast.success(t('map.agentsRefreshed'));
      } catch (err) {
        console.error('Refresh Agents Error:', err);
        toast.error(t('map.refreshFailed'));
      }
    }, 1000),
    [t, delegations, hasPermission]
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
          userPermissions.accessRegions
            ? getAllRegions()
            : userPermissions.accessRegionsByUser
              ? getRegionsByUser(user.userID)
              : [],
          userPermissions.accessGovernorates
            ? getAllGovernorates()
            : userPermissions.accessGovernoratesByUser
              ? getGovernoratesByUser(user.userID)
              : [],
          userPermissions.accessDelegations
            ? getAllDelegations()
            : userPermissions.accessDelegationsByUser
              ? getDelegationsByUser(user.userID)
              : [],
          userPermissions.accessAgentMapLocations ? getAgentLocations() : { locations: [] },
          userPermissions.accessSupervisors
            ? getUsersByRole(import.meta.env.VITE_ROLES_SUPERVISOR)
            : [],
        ]);

        setRegions(regionData);
        setGovernorates(governorateData);
        setDelegations(delegationData);
        setSupervisors(supervisorsData || []); // Ensure supervisors are set even if empty

        const initialMarkers = userPermissions.accessAgentMapLocations
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
                  ? { id: loc.delegation.id, name: loc.delegation.name, governorateID: loc.governorate?.id }
                  : undefined,
                governorate: loc.governorate ? { id: loc.governorate.id, name: loc.governorate.name } : undefined,
                region: loc.region ? { id: loc.region.id, name: loc.region.name } : undefined,
              };
            })
          )
          : [];
        setAllMarkers(initialMarkers);
        setFilteredMarkers(initialMarkers);
        setFilteredAgents(initialMarkers);

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
  }, [user?.userID, hasPermission, t]);

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
    async (points: RoutePoint[], mode: 'DRIVING' | 'WALKING', optimize: boolean = false, fitBounds: boolean = true) => {
      if (points.length < 2) {
        console.warn('Cannot calculate route: fewer than 2 points', points);
        toast.error(t('map.routePointsError'));
        return;
      }
      if (!points.every(p => p.location && typeof p.location === 'string' && p.location.includes(','))) {
        console.error('Invalid routePoints structure:', points);
        toast.error(t('map.invalidRoutePoints'));
        return;
      }
      try {
        console.log('Calculating route with points:', points.map(p => ({ id: p.id, type: p.type, agentId: p.agentId, location: p.location })), 'Mode:', mode, 'Optimize:', optimize);
        const origin = points[0].location;
        const destination = points[points.length - 1].location;
        const waypointsForApi = points
          .slice(1, points.length - 1)
          .map((point) => ({
            location: point.location,
            stopover: true,
          }));
        const directions = await getDirections(origin, destination, mode.toLowerCase(), waypointsForApi, optimize);
        const newPath = polyline.decode(directions.polyline).map(([lat, lng]) => ({ lat, lng }));
        const newTraffic = directions.trafficSegments?.flatMap((segment) =>
          segment.steps.map((step) => ({
            path: polyline.decode(step.polyline).map(([lat, lng]) => ({ lat, lng })),
            color: step.color,
          }))
        ) || [];

        let newPoints = [...points];
        if (optimize && directions.optimizedPoints && directions.optimizedPoints.length > 0) {
          const optimizedLocations = [origin, ...directions.optimizedPoints];
          newPoints = optimizedLocations.map((location, index) => {
            const originalPoint = points.find(p => p.location === location) || {
              id: `point-${index}`,
              location,
              address: location,
              type: 'waypoint',
            };
            return {
              ...originalPoint,
              type: index === 0 ? 'origin' : (index === optimizedLocations.length - 1 ? 'destination' : 'waypoint'),
            };
          });
        }

        routeData.current = {
          points: newPoints,
          response: directions,
          path: newPath,
          traffic: newTraffic,
        };

        setRoutePoints([...newPoints]);
        routePointsRef.current = [...newPoints];
        // Save to local storage
        localStorage.setItem('savedRoutePoints', JSON.stringify(newPoints));

        if (fitBounds && mapRef.current) {
          const bounds = new google.maps.LatLngBounds();
          newPath.forEach((point) => bounds.extend(new google.maps.LatLng(point.lat, point.lng)));
          mapRef.current.fitBounds(bounds);
        }
      } catch (err) {
        console.error('Calculate Route Error:', err);
        toast.error(t('map.calculateRouteFailed'));
      }
    },
    [t]
  );

  // Initialize route points in timesheet mode
  useEffect(() => {
    if (isTimesheetModal && visits.length > 0 && userLocation) {
      const sortedVisits = [...visits].sort((a, b) => a.time.localeCompare(b.time));
      const newRoutePoints: RoutePoint[] = [
        {
          id: 'origin',
          location: `${userLocation.lat},${userLocation.lng}`,
          address: t('map.myLocation'),
          type: 'origin' as 'origin',
        },
        ...sortedVisits.map((visit, index) => ({
          id: visit.visitID,
          location: `${visit.latitude},${visit.longitude}`,
          address: visit.location,
          type: (index === sortedVisits.length - 1 ? 'destination' : 'waypoint') as 'destination' | 'waypoint',
          agentId: visit.visitID,
        })),
      ];
      setRoutePoints(newRoutePoints);
      routePointsRef.current = newRoutePoints;
      handleCalculateRoute(newRoutePoints, routeMode);
    }
  }, [isTimesheetModal, visits, userLocation, t, routeMode, handleCalculateRoute]);

  useEffect(() => {
    const savedRoute = localStorage.getItem('savedRoutePoints');
    if (savedRoute && !isTimesheetModal) {
      try {
        const parsedPoints: RoutePoint[] = JSON.parse(savedRoute);
        if (parsedPoints.length >= 2 && parsedPoints.every(p => p.id && p.location && p.address && p.type)) {
          console.log('Loaded routePoints from local storage:', parsedPoints.map(p => ({ id: p.id, type: p.type, agentId: p.agentId })));
          setRoutePoints(parsedPoints);
          routePointsRef.current = parsedPoints;
          handleCalculateRoute(parsedPoints, routeMode).then(() => {
            setShowDirectionsPanel(true);
            setIsDirectionsPanelCollapsed(false);
          });
        } else {
          console.warn('Invalid route points in local storage, clearing:', parsedPoints);
          localStorage.removeItem('savedRoutePoints');
        }
      } catch (err) {
        console.error('Error parsing saved route points:', err);
        localStorage.removeItem('savedRoutePoints');
      }
    }
  }, [routeMode, handleCalculateRoute, isTimesheetModal]);

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

      try {
        await updateUserLocation('currentUser', newLocation);
        retryCount.current = 0;
      } catch (err) {
        console.error('Location Update Error:', err);
        toast.error(t('map.updateLocationFailed'));
      }

      if (routeData.current.points.length >= 2) {
        // Update route without fitting bounds to keep map centered on user
        await handleCalculateRoute(routeData.current.points, routeMode, false, false);
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
    if (!mapRef.current || !userLocation || !routePoints.length || !routeData.current.path.length) return;

    if (selectedStepIndex !== null && routeData.current.response?.steps[selectedStepIndex]) {
      const step = routeData.current.response.steps[selectedStepIndex];
      mapRef.current.setCenter(step.start_location);
      mapRef.current.setZoom(17);
      mapRef.current.setHeading(getStepHeading(step));
    }
  }, [userLocation, routePoints, selectedStepIndex]);

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


  useEffect(() => {
    const fetchGovernorates = async () => {
      try {
        let govs: Governorate[] = [];
        if (filterRegion) {
          govs = await getGovernoratesByRegion(filterRegion);
        } else {
          govs = await (userPermissions.accessGovernorates
            ? getAllGovernorates()
            : getGovernoratesByUser(user?.userID || ''));
        }
        setGovernorates(govs);
      } catch (err) {
        console.error('Fetch Governorates Error:', err);
        toast.error(t('map.fetchGovernoratesFailed'));
      }
    };

    fetchGovernorates();
  }, [filterRegion, hasPermission, user?.userID, t]);



  useEffect(() => {
    const fetchDelegations = async () => {
      try {
        let dels: Delegation[] = [];
        if (filterGovernorate) {
          dels = await getDelegationsByGovernorate(filterGovernorate);
        } else {
          dels = await (userPermissions.accessDelegations
            ? getAllDelegations()
            : getDelegationsByUser(user?.userID || ''));
        }
        setDelegations(dels);
        setAssignedDelegations(dels);
      } catch (err) {
        console.error('Fetch Delegations Error:', err);
        toast.error(t('map.fetchDelegationsFailed'));
      }
    };

    fetchDelegations();
  }, [filterGovernorate, hasPermission, user?.userID, t]);


  useEffect(() => {
    const fetchSupervisors = async () => {
      try {
        let sups: User[] = [];
        if (filterGovernorate || filterDelegation) {
          const promises = [];
          if (filterGovernorate) promises.push(getUsersByGovernorate(filterGovernorate));
          if (filterDelegation) promises.push(getUsersByDelegation(filterDelegation));
          if (promises.length) {
            const results = await Promise.all(promises);
            if (results.length > 1) {
              sups = results[0].filter((user) =>
                results.every((res, index) =>
                  index === 0 || res.some((u) => u.userID === user.userID)
                )
              );
            } else {
              sups = results[0];
            }
          }
        } else {
          sups = await getUsersByRole(import.meta.env.VITE_ROLES_SUPERVISOR);
        }
        setSupervisors(sups || []);
      } catch (err) {
        console.error('Fetch Supervisors Error:', err);
        toast.error(t('map.fetchSupervisorsFailed'));
      }
    };

    fetchSupervisors();
  }, [filterGovernorate, filterDelegation, t]);

  const handleAgentFilter = useCallback(async () => {
    try {
      let filtered: AgentMarker[] = allMarkers;

      // Apply supervisor and delegation filters together
      if (filterSupervisor && filterDelegation) {
        console.log('Applying both supervisor and delegation filters:', {
          supervisor: filterSupervisor,
          delegation: filterDelegation,
        });

        const [supervisorData, delegationData] = await Promise.all([
          getAgentsByUser(filterSupervisor).catch((err) => {
            console.error('getAgentsByUser error:', err);
            return { agents: [] };
          }),
          getAgentsByDelegation(filterDelegation).catch((err) => {
            console.error('getAgentsByDelegation error:', err);
            return { agents: [] };
          }),
        ]);

        // Get agent IDs from both supervisor and delegation
        const supervisorAgentIds = supervisorData.agents.map((agent) => agent.agentID);
        const delegationAgentIds = delegationData.agents.map((agent) => agent.agentID);

        console.log('Supervisor agent IDs:', supervisorAgentIds);
        console.log('Delegation agent IDs:', delegationAgentIds);

        // Find common agent IDs
        const commonAgentIds = supervisorAgentIds.filter((id) => delegationAgentIds.includes(id));

        console.log('Common agent IDs:', commonAgentIds);

        // Filter allMarkers to include only common agents, preserving all properties
        filtered = allMarkers.filter((m) => commonAgentIds.includes(m.id));

        console.log('Common agents after intersection:', filtered.map(a => ({ id: a.id, name: a.name, delegationID: a.delegation?.id, governorateID: a.governorate?.id, regionID: a.region?.id })));

        if (filtered.length === 0) {
          console.warn('No common agents found between supervisor and delegation.');
          toast.warn(t('map.noCommonAgents'));
        }
      } else if (filterSupervisor) {
        // Apply only supervisor filter
        console.log('Applying supervisor filter:', filterSupervisor);
        const agentData = await getAgentsByUser(filterSupervisor).catch((err) => {
          console.error('getAgentsByUser error:', err);
          return { agents: [] };
        });
        const supervisorAgentIds = agentData.agents.map((agent) => agent.agentID);
        console.log('Supervisor agent IDs (solo filter):', supervisorAgentIds);
        filtered = allMarkers.filter((m) => supervisorAgentIds.includes(m.id));
        if (filtered.length === 0) {
          console.warn('No agents found for supervisor:', filterSupervisor);
          toast.warn(t('map.noAgentsForSupervisor'));
        }
      } else if (filterDelegation) {
        // Apply only delegation filter
        console.log('Applying delegation filter:', filterDelegation);
        const agentData = await getAgentsByDelegation(filterDelegation).catch((err) => {
          console.error('getAgentsByDelegation error:', err);
          return { agents: [] };
        });
        const delegationAgentIds = agentData.agents.map((agent) => agent.agentID);
        console.log('Delegation agent IDs (solo filter):', delegationAgentIds);
        filtered = allMarkers.filter((m) => delegationAgentIds.includes(m.id));
        if (filtered.length === 0) {
          console.warn('No agents found for delegation:', filterDelegation);
          toast.warn(t('map.noAgentsForDelegation'));
        }
      }

      // Apply governorate filter
      if (filterGovernorate) {
        console.log('Applying governorate filter:', filterGovernorate);
        filtered = filtered.filter((m) => m.governorate?.id === filterGovernorate);
      }

      // Apply region filter
      if (filterRegion) {
        console.log('Applying region filter:', filterRegion);
        filtered = filtered.filter((m) => m.region?.id === filterRegion);
      }

      console.log('Final filtered agents:', filtered.map(a => ({ id: a.id, name: a.name, delegationID: a.delegation?.id, governorateID: a.governorate?.id, regionID: a.region?.id })));
      setFilteredAgents(filtered);
      setFilteredMarkers(filtered);

      if (filtered.length === 0 && (filterSupervisor || filterDelegation || filterGovernorate || filterRegion)) {
        toast.info(t('map.noAgentsMatchFilters'));
      }
    } catch (err) {
      console.error('Filter Agents Error:', err);
      toast.error(t('map.filterAgentsFailed'));
    }
  }, [filterRegion, filterGovernorate, filterDelegation, filterSupervisor, allMarkers, t]);

  useEffect(() => {
    handleAgentFilter();
  }, [filterRegion, filterGovernorate, filterDelegation, filterSupervisor, handleAgentFilter]);


  const closeAllPanels = useCallback(() => {
    setShowAddPanel(false);
    setShowEditPanel(false);
    setShowFilterPanel(false);
    setShowDirectionsPanel(false);
    setIsFilterPanelCollapsed(false);
    setIsDirectionsPanelCollapsed(false);
    setIsRoutesPanelCollapsed(false);
    setIsStepsPanelCollapsed(false); // Reset steps panel
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
            3851
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
            id: `destination-${marker.id}`,
            location: destCoords,
            address: destGeocode.formattedAddress || destCoords,
            type: 'destination',
            agentId: marker.id,
          },
        ];
        console.log('Setting initial routePoints:', newPoints.map(p => ({ id: p.id, type: p.type, agentId: p.agentId })));
        setRoutePoints([...newPoints]);
        routePointsRef.current = [...newPoints]; // Sync ref
        await handleCalculateRoute(newPoints, routeMode);
        setMapCenter({ lat: marker.lat, lng: marker.lng });
        setZoom(16);
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
        console.log('Current routePoints before adding stop:', routePointsRef.current.map(p => ({ id: p.id, type: p.type, agentId: p.agentId })));
        let newPoints = [...routePointsRef.current];

        if (newPoints.length === 0) {
          // No points exist, create origin and destination
          newPoints = [
            {
              id: 'origin',
              location: `${userLocation.lat},${userLocation.lng}`,
              address: t('map.myLocation'),
              type: 'origin',
            },
            {
              id: `destination-${marker.id}`,
              location: newStop,
              address: geocode.formattedAddress || newStop,
              type: 'destination',
              agentId: marker.id,
            },
          ];
        } else {
          // Convert current destination to waypoint and add new stop as destination
          const currentDestination = newPoints[newPoints.length - 1];
          if (currentDestination.type === 'destination') {
            currentDestination.type = 'waypoint';
          }
          newPoints.push({
            id: `destination-${marker.id}`,
            location: newStop,
            address: geocode.formattedAddress || newStop,
            type: 'destination',
            agentId: marker.id,
          });
          // Ensure types are correct
          newPoints[0].type = 'origin';
          for (let i = 1; i < newPoints.length - 1; i++) {
            newPoints[i].type = 'waypoint';
          }
          newPoints[newPoints.length - 1].type = 'destination';
        }

        console.log('New routePoints after adding stop:', newPoints.map(p => ({ id: p.id, type: p.type, agentId: p.agentId })));
        setRoutePoints([...newPoints]);
        routePointsRef.current = [...newPoints];
        // Save to local storage
        localStorage.setItem('savedRoutePoints', JSON.stringify(newPoints));
        await handleCalculateRoute(newPoints, routeMode);
        setMapCenter({ lat: marker.lat, lng: marker.lng });
        setZoom(16);
        setShowDirectionsPanel(true);
        setIsDirectionsPanelCollapsed(false);
      } catch (err) {
        console.error('Add Stop Error:', err);
        toast.error(t('map.addStopFailed'));
      }
    },
    [userLocation, routeMode, handleCalculateRoute, t]
  );

  // Update the handleOptimizeRoute function
  const handleOptimizeRoute = useCallback(async () => {
    if (isRouteProcessing || isOptimizing) {
      console.warn('Route processing or optimization in progress, ignoring optimize request');
      return;
    }
    const currentPoints = routePointsRef.current;
    if (currentPoints.length < 3) {
      console.warn('Optimize failed: fewer than 3 points', currentPoints);
      toast.error('At least 3 points are required to optimize the route.');
      return;
    }
    if (!currentPoints.every(p => p.location && typeof p.location === 'string' && p.location.includes(','))) {
      console.error('Invalid routePoints structure:', currentPoints);
      toast.error('Route points are invalid.');
      return;
    }
    setIsOptimizing(true); // Set loading state
    try {
      console.log('Optimizing route with points:', currentPoints);
      await handleCalculateRoute(currentPoints, routeMode, true); // `true` enables optimization
      const optimizedPoints = routeData.current.points;
      console.log('Optimized routePoints:', optimizedPoints);
      if (optimizedPoints !== currentPoints && optimizedPoints.length === currentPoints.length) {
        setRoutePoints([...optimizedPoints]);
        routePointsRef.current = [...optimizedPoints];
        // Save to local storage
        localStorage.setItem('savedRoutePoints', JSON.stringify(optimizedPoints));
        toast.success('Route optimized successfully.');
      } else {
        console.warn('No changes in routePoints after optimization or length mismatch', { optimizedPoints, currentPoints });
        toast.info('No changes were made to the route.');
      }
    } catch (err) {
      console.error('Optimize Route Error:', err);
      toast.error('Failed to optimize the route.');
    } finally {
      setIsOptimizing(false); // Reset loading state
    }
  }, [handleCalculateRoute, routeMode, isRouteProcessing, isOptimizing]);

  const handleCenterRoute = useCallback(() => {
    if (!mapRef.current || !routeData.current.path.length) return;

    const bounds = new google.maps.LatLngBounds();
    routeData.current.path.forEach(point => bounds.extend(new google.maps.LatLng(point.lat, point.lng)));
    mapRef.current.fitBounds(bounds, { top: 50, bottom: isRoutesPanelCollapsed ? 50 : 200, left: 50, right: 50 });
    setSelectedStepIndex(null); // Reset selected step to show full route
  }, [isRoutesPanelCollapsed]);

  const handleStartNavigation = useCallback(() => {
    if (!userLocation || !routePoints.length || !routeData.current.response?.polyline) {
      toast.error(t('map.directionsPanel.navigationError'));
      return;
    }
    const origin = routePoints[0].location;
    const destination = routePoints[routePoints.length - 1].location;
    const waypoints = routePoints.slice(1, -1).map(p => p.location).join('|');
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}&travelmode=${routeMode.toLowerCase()}&dir_action=navigate`;
    window.open(mapsUrl, '_blank');
  }, [userLocation, routePoints, routeMode, t]);

  const clearRoute = useCallback(() => {
    console.log('Clearing routePoints:', routePointsRef.current);
    setRoutePoints([]);
    routePointsRef.current = [];
    routeData.current = { points: [], response: null, path: [], traffic: [] };
    // Clear from local storage
    localStorage.removeItem('savedRoutePoints');
    setShowDirectionsPanel(false);
    setIsDirectionsPanelCollapsed(false);
  }, []);

  const removeAgentFromRoute = useCallback(
    async (agentId: string) => {
      try {
        console.log('Removing agent from route, agentId:', agentId, 'Current routePoints:', routePointsRef.current.map(p => ({ id: p.id, type: p.type, agentId: p.agentId })));
        const newPoints = routePointsRef.current.filter((point) => point.agentId !== agentId);

        if (newPoints.length >= 2) {
          // At least origin and another point remain
          console.log('New routePoints after agent removal:', newPoints.map(p => ({ id: p.id, type: p.type, agentId: p.agentId })));
          setRoutePoints([...newPoints]);
          routePointsRef.current = [...newPoints];
          // Ensure types are correct
          newPoints[0].type = 'origin';
          newPoints[newPoints.length - 1].type = 'destination';
          for (let i = 1; i < newPoints.length - 1; i++) {
            newPoints[i].type = 'waypoint';
          }
          await handleCalculateRoute(newPoints, routeMode);
        } else {
          // Fewer than 2 points, clear route
          console.log('Fewer than 2 points after agent removal, clearing route');
          clearRoute();
        }
      } catch (err) {
        console.error('Remove Agent Error:', err);
        toast.error(t('map.removeAgentFailed'));
      }
    },
    [routeMode, handleCalculateRoute, t, clearRoute]
  );

  const handleReturnToCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error(t('map.geolocationNotSupported'));
      return;
    }

    const maxRetries = 3;
    let retries = 0;

    const attemptGeolocation = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newLocation = { lat: latitude, lng: longitude };
          setUserLocation(newLocation);
          setMapCenter(newLocation); // Center on user location
          setZoom(15); // Zoom to level 15
          lastPosition.current = { ...newLocation, timestamp: Date.now() };
          retryCount.current = 0;
          toast.success(t('map.locationRetrieved'));
        },
        (error) => {
          console.error('Geolocation Error:', error);
          if (retries < maxRetries) {
            retries += 1;
            toast.warn(t('map.retryLocation', { count: retries, max: maxRetries }));
            setTimeout(attemptGeolocation, 1000 * retries); // Exponential backoff
          } else {
            toast.error(t('map.locationError'));
            if (lastPosition.current) {
              setMapCenter({ lat: lastPosition.current.lat, lng: lastPosition.current.lng });
              setZoom(15);
            }
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    };

    attemptGeolocation();
  }, [t]);

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

  // Import DropResult type at the top if not already imported:
  const handleDragEnd = useCallback(
    async (result: import('@hello-pangea/dnd').DropResult) => {
      if (isRouteProcessing) {
        console.warn('Route processing in progress, ignoring drag request');
        return;
      }
      if (!result.destination) {
        console.log('Drag cancelled, no destination');
        return;
      }
      setIsRouteProcessing(true);
      try {
        const currentPoints = routePointsRef.current;
        console.log(
          'Dragging from index:',
          result.source.index,
          'to:',
          result.destination.index,
          'routePoints:',
          currentPoints
        );
        if (currentPoints.length < 2) {
          console.warn('Cannot reorder: fewer than 2 points', currentPoints);
          toast.error('At least 2 points are required to reorder.');
          return;
        }
        if (
          result.source.index >= currentPoints.length ||
          result.destination.index >= currentPoints.length
        ) {
          console.error('Invalid drag indices', {
            source: result.source.index,
            destination: result.destination.index,
            length: currentPoints.length,
          });
          toast.error('Invalid reordering operation.');
          return;
        }
        const newPoints = [...currentPoints];
        const [moved] = newPoints.splice(result.source.index, 1);
        newPoints.splice(result.destination.index, 0, moved);
        // Update point types: first is origin, last is destination, others are waypoints
        newPoints[0].type = 'origin';
        newPoints[newPoints.length - 1].type = 'destination';
        for (let i = 1; i < newPoints.length - 1; i++) {
          newPoints[i].type = 'waypoint';
        }
        console.log('New routePoints after drag:', newPoints);
        setRoutePoints([...newPoints]);
        routePointsRef.current = [...newPoints];
        // Save to local storage
        localStorage.setItem('savedRoutePoints', JSON.stringify(newPoints));
        if (newPoints.length >= 2) {
          await handleCalculateRoute(newPoints, routeMode);
          console.log('Route recalculated after drag');
        }
      } catch (err) {
        console.error('Drag End Error:', err);
        toast.error('Failed to reorder the route.');
      } finally {
        setIsRouteProcessing(false);
      }
    },
    [routeMode, handleCalculateRoute]
  );

  const handleRemovePoint = useCallback(
    async (index: number) => {
      try {
        console.log('Removing point at index:', index, 'Current routePoints:', routePointsRef.current.map(p => ({ id: p.id, type: p.type, agentId: p.agentId })));
        const newPoints = [...routePointsRef.current];
        if (index < 0 || index >= newPoints.length) {
          console.warn('Invalid index for removal:', index);
          return;
        }
        newPoints.splice(index, 1);

        if (newPoints.length >= 2) {
          // At least origin and another point remain
          console.log('New routePoints after removal:', newPoints.map(p => ({ id: p.id, type: p.type, agentId: p.agentId })));
          setRoutePoints([...newPoints]);
          routePointsRef.current = [...newPoints];
          // Ensure types are correct
          newPoints[0].type = 'origin';
          newPoints[newPoints.length - 1].type = 'destination';
          for (let i = 1; i < newPoints.length - 1; i++) {
            newPoints[i].type = 'waypoint';
          }
          // Save to local storage
          localStorage.setItem('savedRoutePoints', JSON.stringify(newPoints));
          await handleCalculateRoute(newPoints, routeMode);
        } else {
          // Fewer than 2 points, clear route
          console.log('Fewer than 2 points after removal, clearing route');
          clearRoute();
        }
      } catch (err) {
        console.error('Remove Point Error:', err);
        toast.error(t('map.removePointFailed'));
      }
    },
    [routeMode, handleCalculateRoute, t, clearRoute]
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
      const { t } = useTranslation();
      const isInRoute = routeData.current.points.some((p) => p.agentId === marker.id);
      return (
        <div
          className={`agent-card ${selectedAgents.includes(marker.id) ? 'selected' : ''} ${selectedMarker?.id === marker.id ? 'info-active' : ''
            } ${isInRoute ? 'route-agent' : ''}`}
          onClick={() => {
            setSelectedAgents((prev) => {
              const newSelected = prev.includes(marker.id)
                ? prev.filter((id) => id !== marker.id)
                : [...prev, marker.id];
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
                {t('map.agentCard.remove')}
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  routeData.current.points.length >= 2 ? onAddStop(marker) : onGetDirections(marker);
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
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {routeData.current.points.length >= 2 ? t('map.agentCard.addStop') : t('map.agentCard.directions')}
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `tel:${marker.phone}`;
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
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              {t('map.agentCard.call')}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const now = new Date();
                const date = now.toISOString().split('T')[0];
                const time = now.toTimeString().slice(0, 5);
                window.location.href = `/timesheet-form?agentId=${marker.id}&date=${date}&time=${time}`;
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
              {t('map.infoWindow.addVisit')}
            </button>
          </div>
        </div>
      );
    }
  );

  const WaypointList = React.memo(() => (
    <div className="waypoint-list">
      <div className="waypoint-header">
        {routePoints.length > 2 && (
          <button
            onClick={() => {
              console.log('Optimize button clicked');
              handleOptimizeRoute();
            }}
            disabled={isOptimizing}
          >
            {isOptimizing ? (
              <span className="loading-spinner"></span>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 12h8M12 4v16M20 12h-8m-4 4h8m-8-8h8" />
              </svg>
            )}
            {t('map.routes.optimize')}
          </button>
        )}
      </div>
      {routeData.current.response && (
        <div className="route-info">
          <p>
            {t('map.routes.distance')}: {routeData.current.response.distance.toFixed(2)} km
          </p>
          <p>
            {t('map.routes.duration')}: {Math.floor(routeData.current.response.duration)}m{' '}
            {Math.round((routeData.current.response.duration % 1) * 60)}s
          </p>
        </div>
      )}
      {routePoints.length === 0 ? (
        <p>{t('map.routes.noStops')}</p>
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
          {/* Toggle Button for Mobile View */}
          <button
            className="mobile-toggle-btn"
            onClick={toggleMobileControls}
            title={showMobileControls ? t('map.hideControls') : t('map.showControls')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d={showMobileControls ? 'M18 6L6 18M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>

          {/* Map Controls - Conditionally rendered in mobile view */}
          <div className={`map-controls ${showMobileControls ? 'visible-mobile' : ''}`}>
            <Autocomplete onLoad={onAutocompleteLoad} onPlaceChanged={onPlaceChanged}>
              <input
                type="text"
                placeholder={t('map.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input search-input-99"
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </button>
              <button
                className={`control-btn ${carMode ? 'active' : ''}`}
                onClick={toggleCarMode}
                title={carMode ? t('map.carModeOff') : t('map.carModeOn')}
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

          {/* Filter Panel - Conditionally rendered in mobile view */}
          {showFilterPanel && (
            <div className={`panel filter-panel ${isFilterPanelCollapsed ? 'collapsed' : ''} ${showMobileControls ? 'visible-mobile' : ''}`}>
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
                <select
                  value={filterRegion}
                  onChange={(e) => {
                    setFilterRegion(e.target.value);
                    setFilterGovernorate('');
                    setFilterDelegation('');
                  }}
                >
                  <option value="">{t('map.filters.allRegions')}</option>
                  {regions.map((r) => (
                    <option key={r.regionID} value={r.regionID}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filterGovernorate}
                  onChange={(e) => {
                    setFilterGovernorate(e.target.value);
                    setFilterDelegation('');
                  }}
                >
                  <option value="">{t('map.filters.allGovernorates')}</option>
                  {governorates.map((g) => (
                    <option key={g.governorateID} value={g.governorateID}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filterDelegation}
                  onChange={(e) => setFilterDelegation(e.target.value)}
                >
                  <option value="">{t('map.filters.allDelegations')}</option>
                  {delegations.map((d) => (
                    <option key={d.delegationID} value={d.delegationID}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filterSupervisor}
                  onChange={(e) => setFilterSupervisor(e.target.value)}
                >
                  <option value="">{t('map.filters.allSupervisors')}</option>
                  {supervisors.map((sup) => (
                    <option key={sup.userID} value={sup.userID}>{`${sup.firstname} ${sup.lastname}`}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Directions Panel - Conditionally rendered in mobile view */}
          {showDirectionsPanel && (
            <div className={`panel directions-panel ${showMobileControls ? 'visible-mobile' : ''}`}>
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
                  <select value={routeMode} onChange={(e) => setRouteMode(e.target.value as 'DRIVING' | 'WALKING')}>
                    <option value="DRIVING">{t('map.directionsPanel.modes.driving')}</option>
                    <option value="WALKING">{t('map.directionsPanel.modes.walking')}</option>
                  </select>
                  <div className="directions-buttons">
                    <div className='route-actions'>
                      <button onClick={() => handleCalculateRoute(routePoints, routeMode)}>
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
                      {routePoints.length >= 2 && (
                        <button onClick={handleCenterRoute}>
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
                          {t('map.directionsPanel.centerRoute')}
                        </button>
                      )}
                    </div>
                    {routePoints.length >= 2 && (
                      <button onClick={handleStartNavigation} style={{ backgroundColor: 'white', color: '#333' }}>
                        {/* Google Maps SVG */}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          aria-label="Google Maps"
                          role="img"
                          viewBox="0 0 512 512"
                          width="24"
                          height="24"
                        >
                          <clipPath id="a">
                            <path d="M375 136a133 133 0 00-79-66 136 136 0 00-40-6 133 133 0 00-103 48 133 133 0 00-31 86c0 38 13 64 13 64 15 32 42 61 61 86a399 399 0 0130 45 222 222 0 0117 42c3 10 6 13 13 13s11-5 13-13a228 228 0 0116-41 472 472 0 0145-63c5-6 32-39 45-64 0 0 15-29 15-68 0-37-15-63-15-63z" />
                          </clipPath>
                          <g strokeWidth="130" clipPath="url(#a)">
                            <path stroke="#fbbc04" d="M104 379l152-181" />
                            <path stroke="#4285f4" d="M256 198L378 53" />
                            <path stroke="#34a853" d="M189 459l243-290" />
                            <path stroke="#1a73e8" d="M255 120l-79-67" />
                            <path stroke="#ea4335" d="M76 232l91-109" />
                          </g>
                        </svg>
                        {t('map.directionsPanel.startNavigation')}
                      </button>
                    )}


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
              {routeData.current.response && (
                <div className={`sub-panel steps-sub-panel ${isStepsPanelCollapsed ? 'collapsed' : ''}`}>
                  <div className="panel-header" onClick={() => setIsStepsPanelCollapsed(!isStepsPanelCollapsed)}>
                    <h2>{t('map.routes.steps')}</h2>
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
                        <path d={isStepsPanelCollapsed ? 'M4 12h16M12 4v16' : 'M4 12h16'} />
                      </svg>
                    </button>
                  </div>
                  <div className="panel-content">
                    <div>
                      {parsedSteps.map((step, index) => (
                        <div
                          key={index}
                          className={`step-item ${selectedStepIndex === index ? 'step-selected' : ''}`}
                          onClick={() => setSelectedStepIndex(index)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && setSelectedStepIndex(index)}
                        >
                          <h4 className="step-title">{t('map.routes.step', { number: index + 1 })}</h4>
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
              )}
            </div>
          )}

          {/* Rest of the GoogleMap content (Markers, Polylines, etc.)  */}
          {carMode && routeData.current.traffic.length > 0 ? (
            routeData.current.traffic.map((segment, index) => (
              <>
                <Polyline
                  key={`traffic-shadow-${index}`}
                  path={segment.path}
                  options={{
                    strokeColor: mapStyle === 'satellite' ? '#000000' : document.body.classList.contains('dark') ? '#1a1a1a' : '#333333',
                    strokeOpacity: 0.5,
                    strokeWeight: 10,
                    zIndex: 1,
                  }}
                />
                <Polyline
                  key={`traffic-segment-${index}`}
                  path={segment.path}
                  options={{
                    strokeColor: segment.color,
                    strokeOpacity: 0.9,
                    strokeWeight: 6,
                    zIndex: 2,
                  }}
                />
              </>
            ))
          ) : (
            routeData.current.path.length > 0 && (
              <>
                <Polyline
                  key="main-route-shadow"
                  path={routeData.current.path}
                  options={{
                    strokeColor: mapStyle === 'satellite' ? '#000000' : document.body.classList.contains('dark') ? '#1a1a1a' : '#333333',
                    strokeOpacity: 0.5,
                    strokeWeight: 10,
                    zIndex: 1,
                  }}
                />
                <Polyline
                  key="main-route"
                  path={routeData.current.path}
                  options={{
                    strokeColor: mapStyle === 'satellite' ? '#8000' : document.body.classList.contains('dark') ? '#63b3ed' : '#4cb1c7',
                    strokeOpacity: 0.9,
                    strokeWeight: 6,
                    zIndex: 2,
                  }}
                />
              </>
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
                    draggable={userPermissions.updateAgents}
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
                {selectedStepIndex !== null && routeData.current.response?.steps[selectedStepIndex] && (
                  <Marker
                    position={routeData.current.response.steps[selectedStepIndex].start_location}
                    title={`Step ${selectedStepIndex + 1}`}
                    icon={{
                      url: 'https://maps.gstatic.com/mapfiles/ms2/micons/blue.png',
                      scaledSize: new google.maps.Size(32, 32),
                    }}
                    zIndex={1000}
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
                {isTimesheetModal ? (
                  <>
                    <h3>{selectedMarker.name} {selectedMarker.lastname}</h3>
                    <p><strong>{t('map.infoWindow.location')}:</strong> {selectedMarker.address}</p>
                    <p><strong>{t('map.infoWindow.time')}:</strong> {selectedMarker.time || 'N/A'}</p>
                    <p><strong>{t('map.infoWindow.reasons')}:</strong> {selectedMarker.reasons || 'N/A'}</p>
                    <div className="info-buttons">
                      <button
                        onClick={() => {
                          window.location.href = `tel:${selectedMarker.phone}`;
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
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        {t('map.agentCard.call')}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3>{`${selectedMarker.name} ${selectedMarker.lastname}`}</h3>
                    <p>{selectedMarker.address}</p>
                    <p>{t('map.infoWindow.phone')}: {selectedMarker.phone}</p>
                    <div className="info-buttons">
                      {userPermissions.updateAgents && (
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
                      {routeData.current.points.some((p) => p.agentId === selectedMarker.id) ? (
                        <button
                          onClick={() => removeAgentFromRoute(selectedMarker.id)}
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
                          {t('map.agentCard.remove')}
                        </button>
                      ) : (
                        <button
                          onClick={() => routeData.current.points.length >= 2 ? handleAddStop(selectedMarker) : handleGetDirections(selectedMarker)}
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
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          {routeData.current.points.length >= 2 ? t('map.agentCard.addStop') : t('map.infoWindow.directions')}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const now = new Date();
                          const date = now.toISOString().split('T')[0];
                          const time = now.toTimeString().slice(0, 5);
                          window.location.href = `/timesheet-form?agentId=${selectedMarker.id}&date=${date}&time=${time}`;
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
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        {t('map.infoWindow.addVisit')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>

        <button
          className={`locate-btn ${showMobileControls ? 'visible-mobile' : ''}`}
          onClick={handleReturnToCurrentLocation}
          disabled={!userLocation}
          title={t('map.returnToMyLocation')}
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

        {!isTimesheetModal && userPermissions.createAgents && (
          <button
            className={`add-agent-btn ${showMobileControls ? 'visible-mobile' : ''}`}
            onClick={() => {
              setAddingAgentMode(true);
              toast.info(t('map.addAgentPrompt'));
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
            {t('map.addAgent')}
          </button>
        )}

        {!isTimesheetModal && userPermissions.accessAgentMapLocations && (
          <button
            className={`refresh-agents-btn ${showMobileControls ? 'visible-mobile' : ''}`}
            onClick={handleRefreshAgents}
            title={t('map.refreshAgents')}
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
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        )}
        <ConfirmationModal
          isOpen={showConfirmModal}
          message={confirmMessage}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />

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
              <div className="panel-actions">
                <button onClick={handleCreateAgent}>
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
                  {t('map.addAgentPanel.save')}
                </button>
                <button
                  onClick={() => {
                    setShowAddPanel(false);
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
                    width="16"
                    height="16"
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
                value={editAgent.delegationID || ''}
                onChange={(e) => setEditAgent({ ...editAgent, delegationID: e.target.value })}
              >
                <option value="">{t('map.editAgentPanel.delegation')}</option>
                {delegations.map((del) => (
                  <option key={del.delegationID} value={del.delegationID}>
                    {del.name}
                  </option>
                ))}
              </select>
              <div className="panel-actions">
                <button onClick={handleEditAgent}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
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
                    width="16"
                    height="16"
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

        <div className={`agent-list ${showMobileControls ? 'visible-mobile' : ''}`}>
          {sortedMarkers.length === 0 ? (
            <p>{t('map.noAgents')}</p>
          ) : (
            <div className="agent-scroll">
              {/* Render route agents first, in order of routePoints */}
              {routePoints
                .filter((point) => point.agentId && point.type !== 'origin')
                .map((point) => {
                  const marker = allMarkers.find((m) => m.id === point.agentId);
                  return marker ? (
                    <AgentCard
                      key={marker.id}
                      marker={marker}
                      onSelect={handleMarkerClick}
                      onGetDirections={handleGetDirections}
                      onAddStop={handleAddStop}
                    />
                  ) : null;
                })}
              {/* Render remaining non-route agents */}
              {sortedMarkers
                .filter((marker) => !routePoints.some((point) => point.agentId === marker.id))
                .map((marker) => (
                  <AgentCard
                    key={marker.id}
                    marker={marker}
                    onSelect={handleMarkerClick}
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