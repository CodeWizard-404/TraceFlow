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
} from '@react-google-maps/api';
import { toast } from 'react-toastify';
import polyline from '@mapbox/polyline';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { getGeocode, getDirections } from '../../apis/locationApi';
import './Map.css';
import { mapStyles } from './mapStyles';
import { useTranslation } from 'react-i18next';

const containerStyle = { width: '100%', height: '70vh' };
const defaultCenter = { lat: 36.8065, lng: 10.1815 };
// Use string[] directly since Library type is not exported
const libraries: string[] = ['places', 'geometry'];
interface Visit {
    visitID: string;
    date: string;
    time: string;
    location: string;
    latitude?: number;
    longitude?: number;
    reasons?: { item: string }[];
    Agent?: { name: string; lastname: string };
}

interface VisitMarker {
    id: string;
    lat: number;
    lng: number;
    time: string;
    location: string;
    reasons?: { item: string }[];
    agent?: { name: string; lastname: string };
}

interface RoutePoint {
    id: string;
    location: string;
    address: string;
    type: 'origin' | 'waypoint' | 'destination';
    visitId?: string;
}

interface DirectionsResponse {
    polyline: string;
    distance: number;
    duration: number;
    steps: Array<{
        instruction: string;
        polyline: string;
        distance: string;
        duration: string;
        start_location: { lat: number; lng: number };
    }>;
    trafficSegments?: Array<{
        steps: Array<{ polyline: string; color: string }>;
    }>;
    optimizedPoints?: string[];
}

interface RouteData {
    points: RoutePoint[];
    response: DirectionsResponse | null;
    path: Array<{ lat: number; lng: number }>;
    traffic: Array<{ path: Array<{ lat: number; lng: number }>; color: string }>;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const deg2rad = (deg: number): number => deg * (Math.PI / 180);

const cleanInstruction = (instruction: string): string => {
    const div = document.createElement('div');
    div.innerHTML = instruction;
    let text = div.textContent || div.innerText || '';
    text = text.replace(/\s+/g, ' ').trim();
    text = text.replace(/Go through \d+ roundabout/, 'Pass through roundabout');
    return text;
};

interface VisitMapModalProps {
    visits: Visit[];
    onClose: () => void;
}

const VisitMapModal: React.FC<VisitMapModalProps> = ({ visits, onClose }) => {
    const { t } = useTranslation();
    const [allMarkers, setAllMarkers] = useState<VisitMarker[]>([]);
    const [filteredMarkers, setFilteredMarkers] = useState<VisitMarker[]>([]);
    const [selectedMarker, setSelectedMarker] = useState<VisitMarker | null>(null);
    const [selectedVisits, setSelectedVisits] = useState<string[]>([]);
    const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(defaultCenter);
    const [zoom, setZoom] = useState<number>(7);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [routeMode, setRouteMode] = useState<string>('DRIVING');
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [mapStyle, setMapStyle] = useState<string>('standard');
    const [showFilterPanel, setShowFilterPanel] = useState<boolean>(false);
    const [showDirectionsPanel, setShowDirectionsPanel] = useState<boolean>(false);
    const [isFilterPanelCollapsed, setIsFilterPanelCollapsed] = useState<boolean>(false);
    const [isDirectionsPanelCollapsed, setIsDirectionsPanelCollapsed] = useState<boolean>(true);
    const [isRoutesPanelCollapsed, setIsRoutesPanelCollapsed] = useState<boolean>(true);
    const [isStepsPanelCollapsed, setIsStepsPanelCollapsed] = useState<boolean>(true);
    const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
    const [isRouteProcessing, setIsRouteProcessing] = useState<boolean>(false);
    const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
    const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
    const [showMobileControls, setShowMobileControls] = useState<boolean>(false);
    const mapRef = useRef<google.maps.Map | null>(null);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
    const routePointsRef = useRef<RoutePoint[]>(routePoints);

    const routeData = useRef<RouteData>({
        points: [],
        response: null,
        path: [],
        traffic: [],
    });

    const isCoordinates = (str: string): boolean => /^\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+\s*$/.test(str);

    const formatTime = (timeStr: string): string => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 || 12;
        return `${formattedHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    useEffect(() => {
        routePointsRef.current = routePoints;
        routeData.current.points = routePoints;
    }, [routePoints]);

    useEffect(() => {
        const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleThemeChange = (e: MediaQueryListEvent) => {
            setMapStyle(e.matches ? 'standard' : 'platformDark');
        };
        handleThemeChange(darkModeMediaQuery as any); // TypeScript workaround for initial call
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

    const parsedSteps = useMemo(() => {
        if (!routeData.current.response?.steps) return [];
        return routeData.current.response.steps.map((step) => ({
            ...step,
            instruction: cleanInstruction(step.instruction),
        }));
    }, [routeData.current.response]);

    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            try {
                const visitMarkers = await Promise.all(
                    visits.map(async (visit: Visit): Promise<VisitMarker> => {
                        let lat: number, lng: number, address: string;
                        if (visit.latitude && visit.longitude) {
                            lat = visit.latitude;
                            lng = visit.longitude;
                            address = visit.location;
                        } else if (isCoordinates(visit.location)) {
                            [lat, lng] = visit.location.split(',').map(Number);
                            address = visit.location;
                        } else {
                            try {
                                const geocode = await getGeocode(`${visit.location}, Tunisia`);
                                lat = geocode.latitude;
                                lng = geocode.longitude;
                                address = geocode.formattedAddress || visit.location;
                            } catch (err) {
                                console.error(`Geocode error for visit ${visit.visitID}:`, err);
                                lat = defaultCenter.lat;
                                lng = defaultCenter.lng;
                                address = visit.location;
                            }
                        }
                        return {
                            id: visit.visitID,
                            lat,
                            lng,
                            time: visit.time,
                            location: address,
                            reasons: visit.reasons,
                            agent: visit.Agent ? { name: visit.Agent.name, lastname: visit.Agent.lastname } : undefined,
                        };
                    })
                );
                setAllMarkers(visitMarkers);
                setFilteredMarkers(visitMarkers);

                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const { latitude, longitude } = position.coords;
                            const newLocation = { lat: latitude, lng: longitude };
                            setUserLocation(newLocation);
                            setMapCenter(newLocation);
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
    }, [visits, t]);

    const handleCalculateRoute = useCallback(
        async (points: RoutePoint[], mode: string, optimize: boolean = false, fitBounds: boolean = true) => {
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
                        const originalPoint = points.find((p) => p.location === location) || {
                            id: `point-${index}`,
                            location,
                            address: location,
                            type: 'waypoint' as const,
                        };
                        return {
                            ...originalPoint,
                            type: index === 0 ? 'origin' : index === optimizedLocations.length - 1 ? 'destination' : 'waypoint',
                        };
                    });
                }

                routeData.current = {
                    points: newPoints,
                    response: directions,
                    path: newPath,
                    traffic: newTraffic,
                };

                setRoutePoints(newPoints);
                routePointsRef.current = newPoints;

                if (fitBounds && mapRef.current) {
                    const bounds = new window.google.maps.LatLngBounds();
                    newPath.forEach((point) => bounds.extend(new window.google.maps.LatLng(point.lat, point.lng)));
                    mapRef.current.fitBounds(bounds);
                }
            } catch (err) {
                console.error('Calculate Route Error:', err);
                toast.error(t('map.calculateRouteFailed'));
            }
        },
        [t]
    );

    useEffect(() => {
        if (!userLocation || filteredMarkers.length === 0) return;
        const sortedMarkers = [...filteredMarkers].sort((a, b) => a.time.localeCompare(b.time));
        const points: RoutePoint[] = [
            {
                id: 'user',
                location: `${userLocation.lat},${userLocation.lng}`,
                address: 'Your Location',
                type: 'origin' as const,
            },
            ...sortedMarkers.map((marker, index) => ({
                id: marker.id,
                location: `${marker.lat},${marker.lng}`,
                address: marker.location,
                type: (index === sortedMarkers.length - 1 ? 'destination' : 'waypoint') as 'destination' | 'waypoint',
                visitId: marker.id,
            })),
        ];
        setRoutePoints(points);
        handleCalculateRoute(points, 'DRIVING');
    }, [userLocation, filteredMarkers, handleCalculateRoute]);

    const handleSearch = useCallback(async () => {
        if (!searchQuery) {
            setFilteredMarkers(allMarkers);
            return;
        }
        try {
            const matchingVisits = allMarkers.filter((m) =>
                m.location.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredMarkers(matchingVisits);
            if (matchingVisits.length === 1) {
                setMapCenter({ lat: matchingVisits[0].lat, lng: matchingVisits[0].lng });
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

    const handleOptimizeRoute = useCallback(async () => {
        if (isRouteProcessing || isOptimizing) return;
        const currentPoints = routePointsRef.current;
        if (currentPoints.length < 3) {
            toast.error(t('map.optimizeRouteError'));
            return;
        }
        setIsOptimizing(true);
        try {
            await handleCalculateRoute(currentPoints, routeMode, true);
            toast.success(t('map.routeOptimized'));
        } catch (err) {
            console.error('Optimize Route Error:', err);
            toast.error(t('map.optimizeRouteFailed'));
        } finally {
            setIsOptimizing(false);
        }
    }, [handleCalculateRoute, routeMode, isRouteProcessing, isOptimizing, t]);

    const handleCenterRoute = useCallback(() => {
        if (!mapRef.current || !routeData.current.path.length) return;
        const bounds = new window.google.maps.LatLngBounds();
        routeData.current.path.forEach((point) => bounds.extend(new window.google.maps.LatLng(point.lat, point.lng)));
        mapRef.current.fitBounds(bounds, { top: 50, bottom: isRoutesPanelCollapsed ? 50 : 200, left: 50, right: 50 });
        setSelectedStepIndex(null);
    }, [isRoutesPanelCollapsed]);

    const handleStartNavigation = useCallback(() => {
        if (!userLocation || !routePoints.length || !routeData.current.response?.polyline) {
            toast.error(t('map.directionsPanel.navigationError'));
            return;
        }
        const origin = routePoints[0].location;
        const destination = routePoints[routePoints.length - 1].location;
        const waypoints = routePoints.slice(1, -1).map((p) => p.location).join('|');
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}&travelmode=${routeMode.toLowerCase()}&dir_action=navigate`;
        window.open(mapsUrl, '_blank');
    }, [userLocation, routePoints, routeMode, t]);

    const clearRoute = useCallback(() => {
        setRoutePoints([]);
        routePointsRef.current = [];
        routeData.current = { points: [], response: null, path: [], traffic: [] };
        setShowDirectionsPanel(false);
        setIsDirectionsPanelCollapsed(false);
    }, []);

    const removeVisitFromRoute = useCallback(
        async (visitId: string) => {
            try {
                const newPoints = routePointsRef.current.filter((point) => point.visitId !== visitId);
                if (newPoints.length >= 2) {
                    setRoutePoints(newPoints);
                    routePointsRef.current = newPoints;
                    newPoints[0].type = 'origin';
                    newPoints[newPoints.length - 1].type = 'destination';
                    for (let i = 1; i < newPoints.length - 1; i++) {
                        newPoints[i].type = 'waypoint';
                    }
                    await handleCalculateRoute(newPoints, routeMode);
                } else {
                    clearRoute();
                }
            } catch (err) {
                console.error('Remove Visit Error:', err);
                toast.error(t('map.removePointFailed'));
            }
        },
        [routeMode, handleCalculateRoute, t, clearRoute]
    );

    const handleReturnToCurrentLocation = useCallback(() => {
        if (!navigator.geolocation) {
            toast.error(t('map.geolocationNotSupported'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const newLocation = { lat: latitude, lng: longitude };
                setUserLocation(newLocation);
                setMapCenter(newLocation);
                setZoom(15);
                toast.success(t('map.locationRetrieved'));
            },
            (error) => {
                console.error('Geolocation Error:', error);
                toast.error(t('map.locationError'));
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }, [t]);

    const handleAddStop = useCallback(
        async (marker: VisitMarker) => {
            if (!userLocation) {
                toast.error(t('map.noUserLocation'));
                return;
            }
            const newPoint: RoutePoint = {
                id: marker.id,
                location: `${marker.lat},${marker.lng}`,
                address: marker.location,
                type: 'waypoint',
                visitId: marker.id,
            };
            const newPoints = [...routePoints, newPoint];
            newPoints[newPoints.length - 1].type = 'destination';
            setRoutePoints(newPoints);
            routePointsRef.current = newPoints;
            await handleCalculateRoute(newPoints, routeMode);
        },
        [userLocation, routePoints, routeMode, handleCalculateRoute, t]
    );

    const handleGetDirections = useCallback(
        async (marker: VisitMarker) => {
            if (!userLocation) {
                toast.error(t('map.noUserLocation'));
                return;
            }
            const points: RoutePoint[] = [
                {
                    id: 'user',
                    location: `${userLocation.lat},${userLocation.lng}`,
                    address: 'Your Location',
                    type: 'origin',
                },
                {
                    id: marker.id,
                    location: `${marker.lat},${marker.lng}`,
                    address: marker.location,
                    type: 'destination',
                    visitId: marker.id,
                },
            ];
            setRoutePoints(points);
            routePointsRef.current = points;
            await handleCalculateRoute(points, routeMode);
            setShowDirectionsPanel(true);
        },
        [userLocation, routeMode, handleCalculateRoute, t]
    );

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
        async (result: any) => {
            if (isRouteProcessing) return;
            if (!result.destination) return;
            setIsRouteProcessing(true);
            try {
                const newPoints = [...routePointsRef.current];
                const [moved] = newPoints.splice(result.source.index, 1);
                newPoints.splice(result.destination.index, 0, moved);
                newPoints[0].type = 'origin';
                newPoints[newPoints.length - 1].type = 'destination';
                for (let i = 1; i < newPoints.length - 1; i++) {
                    newPoints[i].type = 'waypoint';
                }
                setRoutePoints(newPoints);
                routePointsRef.current = newPoints;
                if (newPoints.length >= 2) {
                    await handleCalculateRoute(newPoints, routeMode);
                }
            } catch (err) {
                console.error('Drag End Error:', err);
                toast.error(t('map.reorderRouteFailed'));
            } finally {
                setIsRouteProcessing(false);
            }
        },
        [routeMode, handleCalculateRoute, isRouteProcessing, t]
    );

    const handleRemovePoint = useCallback(
        async (index: number) => {
            try {
                const newPoints = [...routePointsRef.current];
                newPoints.splice(index, 1);
                if (newPoints.length >= 2) {
                    setRoutePoints(newPoints);
                    routePointsRef.current = newPoints;
                    newPoints[0].type = 'origin';
                    newPoints[newPoints.length - 1].type = 'destination';
                    for (let i = 1; i < newPoints.length - 1; i++) {
                        newPoints[i].type = 'waypoint';
                    }
                    await handleCalculateRoute(newPoints, routeMode);
                } else {
                    clearRoute();
                }
            } catch (err) {
                console.error('Remove Point Error:', err);
                toast.error(t('map.removePointFailed'));
            }
        },
        [routeMode, handleCalculateRoute, t, clearRoute]
    );

    const VisitCard: React.FC<{
        marker: VisitMarker;
        onSelect: (m: VisitMarker) => void;
        onGetDirections: (m: VisitMarker) => void;
        onAddStop: (m: VisitMarker) => void;
    }> = React.memo(({ marker, onSelect, onGetDirections, onAddStop }) => {
        const { t } = useTranslation();
        const isInRoute = routeData.current.points.some((p) => p.visitId === marker.id);
        return (
            <div
                className={`agent-card ${selectedVisits.includes(marker.id) ? 'selected' : ''} ${selectedMarker?.id === marker.id ? 'info-active' : ''}`}
                onClick={() => {
                    setSelectedVisits((prev) => {
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
                <h4>{`Visit at ${formatTime(marker.time)}`}</h4>
                <p>{marker.location}</p>
                <div className="agent-actions">
                    {isInRoute ? (
                        <button onClick={(e) => { e.stopPropagation(); removeVisitFromRoute(marker.id); }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                            {t('map.agentCard.remove')}
                        </button>
                    ) : routeData.current.response ? (
                        <button onClick={(e) => { e.stopPropagation(); onAddStop(marker); }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                            {t('map.agentCard.addStop')}
                        </button>
                    ) : (
                        <button onClick={(e) => { e.stopPropagation(); onGetDirections(marker); }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                            {t('map.agentCard.directions')}
                        </button>
                    )}
                </div>
            </div>
        );
    });

    const WaypointList: React.FC = React.memo(() => (
        <div className="waypoint-list">
            <div className="waypoint-header">
                {routePoints.length > 2 && (
                    <button onClick={handleOptimizeRoute} disabled={isOptimizing}>
                        {isOptimizing ? (
                            <span className="loading-spinner"></span>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4 12h8M12 4v16M20 12h-8m-4 4h8m-8-8h8" />
                            </svg>
                        )}
                        {t('map.routes.optimize')}
                    </button>
                )}
            </div>
            {routeData.current.response && (
                <div className="route-info">
                    <p>{t('map.routes.distance')}: {routeData.current.response.distance.toFixed(2)} km</p>
                    <p>{t('map.routes.duration')}: {Math.floor(routeData.current.response.duration)}m {Math.round((routeData.current.response.duration % 1) * 60)}s</p>
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

    if (loading) return <div className="loading">{t('map.loading')}</div>;

    return (
        <div className="map-modal" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 1000 }}>
            <div style={{ position: 'absolute', top: 10, right: 10 }}>
                <button onClick={onClose} style={{ padding: '10px', background: '#fff', border: 'none', cursor: 'pointer' }}>
                    Close
                </button>
            </div>
            <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY} libraries={libraries}>
                <GoogleMap
                    mapContainerStyle={containerStyle}
                    center={mapCenter}
                    zoom={zoom}
                    onLoad={onMapLoad}
                    onClick={() => setSelectedMarker(null)}
                    options={{
                        styles: mapStyles[mapStyle as keyof typeof mapStyles],
                        mapTypeId: mapStyle === 'satellite' ? 'hybrid' : 'roadmap',
                        mapTypeControl: false,
                        streetViewControl: false,
                        fullscreenControl: false,
                    }}
                >
                    <button
                        className="mobile-toggle-btn"
                        onClick={() => setShowMobileControls((prev) => !prev)}
                        title={showMobileControls ? t('map.hideControls') : t('map.showControls')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d={showMobileControls ? 'M18 6L6 18M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
                        </svg>
                    </button>
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
                                    setShowFilterPanel(true);
                                    setShowDirectionsPanel(false);
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
                                    setShowDirectionsPanel(true);
                                    setShowFilterPanel(false);
                                    setIsDirectionsPanelCollapsed(false);
                                }}
                                title={t('map.directions')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                            </button>
                            <select
                                value={mapStyle}
                                onChange={(e) => setMapStyle(e.target.value)}
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
                        <div className={`panel filter-panel ${isFilterPanelCollapsed ? 'collapsed' : ''} ${showMobileControls ? 'visible-mobile' : ''}`}>
                            <div className="panel-header" onClick={() => setIsFilterPanelCollapsed(!isFilterPanelCollapsed)}>
                                <h2>{t('map.filters.title')}</h2>
                                <button className="toggle-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d={isFilterPanelCollapsed ? 'M4 12h16M12 4v16' : 'M4 12h16'} />
                                    </svg>
                                </button>
                            </div>
                            <div className="panel-content">
                                <input
                                    type="text"
                                    placeholder={t('map.filters.time')}
                                    onChange={(e) => {
                                        const filtered = allMarkers.filter((m) =>
                                            formatTime(m.time).toLowerCase().includes(e.target.value.toLowerCase())
                                        );
                                        setFilteredMarkers(filtered);
                                    }}
                                />
                            </div>
                        </div>
                    )}
                    {showDirectionsPanel && (
                        <div className={`panel directions-panel ${showMobileControls ? 'visible-mobile' : ''}`}>
                            <div className={`sub-panel directions-sub-panel ${isDirectionsPanelCollapsed ? 'collapsed' : ''}`}>
                                <div className="panel-header" onClick={() => setIsDirectionsPanelCollapsed(!isDirectionsPanelCollapsed)}>
                                    <h2>{t('map.directionsPanel.title')}</h2>
                                    <button className="toggle-btn">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d={isDirectionsPanelCollapsed ? 'M4 12h16M12 4v16' : 'M4 12h16'} />
                                        </svg>
                                    </button>
                                </div>
                                <div className="panel-content">
                                    <select value={routeMode} onChange={(e) => setRouteMode(e.target.value)}>
                                        <option value="DRIVING">{t('map.directionsPanel.modes.driving')}</option>
                                        <option value="WALKING">{t('map.directionsPanel.modes.walking')}</option>
                                    </select>
                                    <div className="directions-buttons">
                                        <div className="route-actions">
                                            <button onClick={() => handleCalculateRoute(routePoints, routeMode)}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                                </svg>
                                                {t('map.directionsPanel.go')}
                                            </button>
                                            <button onClick={clearRoute}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M18 6L6 18M6 6l12 12" />
                                                </svg>
                                                {t('map.directionsPanel.clear')}
                                            </button>
                                            {routePoints.length >= 2 && (
                                                <button onClick={handleCenterRoute}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                                                        <path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
                                                    </svg>
                                                    {t('map.directionsPanel.centerRoute')}
                                                </button>
                                            )}
                                        </div>
                                        {routePoints.length >= 2 && (
                                            <button onClick={handleStartNavigation} style={{ backgroundColor: 'white', color: '#333' }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" aria-label="Google Maps" role="img" viewBox="0 0 512 512" width="24" height="24">
                                                    <clipPath id="a"><path d="M375 136a133 133 0 00-79-66 136 136 0 00-40-6 133 133 0 00-103 48 133 133 0 00-31 86c0 38 13 64 13 64 15 32 42 61 61 86a399 399 0 0130 45 222 222 0 0117 42c3 10 6 13 13 13s11-5 13-13a228 228 0 0116-41 472 472 0 0145-63c5-6 32-39 45-64 0 0 15-29 15-68 0-37-15-63-15-63z" /></clipPath>
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
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                    {routeData.current.path.length > 0 && (
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
                    )}
                    <MarkerClusterer>
                        {(clusterer) => (
                            <>
                                {filteredMarkers.map((marker) => (
                                    <Marker
                                        key={marker.id}
                                        position={{ lat: marker.lat, lng: marker.lng }}
                                        title={`Visit at ${formatTime(marker.time)}`}
                                        onClick={() => setSelectedMarker(marker)}
                                        icon={{
                                            url: 'https://maps.gstatic.com/mapfiles/ms2/micons/lightblue.png',
                                        }}
                                        clusterer={clusterer}
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
                                        clusterer={clusterer}
                                    />
                                )}
                                {selectedStepIndex !== null && routeData.current.response?.steps[selectedStepIndex] && (
                                    <Marker
                                        position={routeData.current.response.steps[selectedStepIndex].start_location}
                                        title={`Step ${selectedStepIndex + 1}`}
                                        icon={{
                                            url: 'https://maps.gstatic.com/mapfiles/ms2/micons/blue.png',
                                            scaledSize: new window.google.maps.Size(32, 32),
                                        }}
                                        zIndex={1000}
                                        clusterer={clusterer}
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
                                <h3>{`Visit at ${formatTime(selectedMarker.time)}`}</h3>
                                <p>{selectedMarker.location}</p>
                                <p><strong>Reasons:</strong> {selectedMarker.reasons?.map((r) => r.item).join(', ') || 'N/A'}</p>
                                <p><strong>Agent:</strong> {selectedMarker.agent ? `${selectedMarker.agent.name} ${selectedMarker.agent.lastname}` : 'no agent'}</p>
                                <div className="info-buttons">
                                    {routeData.current.points.some((p) => p.visitId === selectedMarker.id) ? (
                                        <button onClick={() => removeVisitFromRoute(selectedMarker.id)}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M18 6L6 18M6 6l12 12" />
                                            </svg>
                                            {t('map.agentCard.remove')}
                                        </button>
                                    ) : routeData.current.response ? (
                                        <button onClick={() => handleAddStop(selectedMarker)}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                <circle cx="12" cy="10" r="3" />
                                            </svg>
                                            {t('map.infoWindow.addStop')}
                                        </button>
                                    ) : (
                                        <button onClick={() => handleGetDirections(selectedMarker)}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                    className={`locate-btn ${showMobileControls ? 'visible-mobile' : ''}`}
                    onClick={handleReturnToCurrentLocation}
                    disabled={!userLocation}
                    title={t('map.returnToMyLocation')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                        <path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
                    </svg>
                </button>
                <div className={`agent-list ${showMobileControls ? 'visible-mobile' : ''}`}>
                    {sortedMarkers.length === 0 ? (
                        <p>{t('map.noAgents')}</p>
                    ) : (
                        <div className="agent-scroll">
                            {sortedMarkers.map((marker) => (
                                <VisitCard
                                    key={marker.id}
                                    marker={marker}
                                    onSelect={(m) => setSelectedMarker(m)}
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

export default VisitMapModal;