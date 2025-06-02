const { Client } = require('@googlemaps/google-maps-services-js');
const { Agent, User, Region, Delegation, Governorate } = require('../models');
const { initializeRedis } = require('../config/redis');
const logger = require('../utils/logger');
const RedisUtils = require('../utils/redisUtils');
const { Op } = require('sequelize');
require('dotenv').config();
const axios = require('axios');

class GoogleMapsService {
    static async initialize() {
        if (!process.env.GOOGLE_MAPS_API_KEY) {
            this.client = null;
            return;
        }
        try {
            this.client = new Client({});
            this.redisClient = (await initializeRedis()).redisClient;
        } catch (error) {
            this.redisClient = null;
            this.client = new Client({});
        }
    }

    // Get directions
    static async getDirections(origin, destination, mode = 'driving', waypoints = [], trafficModel = 'best_guess', optimizeWaypoints = false) {
        try {
            if (!origin) {
                throw new Error('Origin is required');
            }

            // Validate mode for traffic data
            if (mode !== 'driving' && trafficModel) {
                throw new Error('Traffic data is only available for driving mode');
            }

            // Extract waypoint locations
            const waypointLocations = waypoints.map((wp, index) => {
                const location = typeof wp === 'string' ? wp : wp.location;
                if (!/^-?\d+\.\d{1,15},-?\d+\.\d{1,15}$/.test(location)) {
                    throw new Error(`Invalid waypoint location format at index ${index}: ${location}`);
                }
                return location;
            });

            // Combine waypoints and destination (if provided) for optimization
            const allPoints = destination ? [...waypointLocations, destination] : waypointLocations;

            const formattedWaypoints = waypoints.map(wp => {
                const location = typeof wp === 'string' ? wp : wp.location;
                return wp.stopover === true ? `via:${location}` : location;
            });

            const cacheKey = `directions:${origin}:${destination || 'none'}:${mode}:${waypointLocations.join('|')}:${trafficModel}:${optimizeWaypoints}`;
            let cachedResult = await this.redisClient?.get(cacheKey);
            if (cachedResult) {
                return JSON.parse(cachedResult);
            }

            let waypointOrder = [];
            let optimizedPoints = [];
            let params;

            let AIService;
            if (optimizeWaypoints && allPoints.length > 0) {
                const allLocations = [origin, ...allPoints];
                const distanceMatrix = await this.getDistanceMatrix(allLocations, allLocations, mode);
                if (!AIService) AIService = require('./aiService');
                const aiOptimization = await AIService.optimizeRoute(origin, allPoints, mode, trafficModel, distanceMatrix);
                waypointOrder = aiOptimization.waypointOrder;

                optimizedPoints = waypointOrder.map(index => allPoints[index]);
                const optimizedWaypoints = optimizedPoints.slice(0, -1); // All but last point as waypoints
                const finalDestination = optimizedPoints[optimizedPoints.length - 1]; // Last point as destination

                params = {
                    origin,
                    destination: finalDestination,
                    mode,
                    key: process.env.GOOGLE_MAPS_API_KEY,
                    departure_time: 'now',
                    traffic_model: trafficModel,
                    waypoints: optimizedWaypoints.length > 0 ? `optimize:false|${optimizedWaypoints.join('|')}` : undefined,
                };
            } else {
                params = {
                    origin,
                    destination: destination || waypointLocations[waypointLocations.length - 1] || origin,
                    mode,
                    key: process.env.GOOGLE_MAPS_API_KEY,
                    departure_time: 'now',
                    traffic_model: trafficModel,
                    waypoints: formattedWaypoints.length ? formattedWaypoints.join('|') : undefined,
                };
            }


            const url = 'https://maps.googleapis.com/maps/api/directions/json';
            const response = await axios.get(url, { params });
            if (response.data.status !== 'OK') {
                throw new Error(`Directions API error: ${response.data.status}`);
            }

            const route = response.data.routes[0];
            if (!route) {
                throw new Error('No directions found');
            }

            const trafficSegments = route.legs.map((leg, legIndex) => {
                // Check leg-level traffic data
                const legTrafficRatio = leg.duration_in_traffic && leg.duration
                    ? leg.duration_in_traffic.value / leg.duration.value
                    : null;


                const steps = leg.steps.map((step) => {
                    let trafficCondition = 'clear';
                    let color = '#008000'; // Green
                    let trafficRatio = null;

                    // Try step-level traffic data first
                    if (step.duration_in_traffic && step.duration) {
                        trafficRatio = step.duration_in_traffic.value / step.duration.value;
                    } else if (legTrafficRatio !== null) {
                        // Fallback to leg-level traffic data
                        trafficRatio = legTrafficRatio;
                    } else {
                        trafficCondition = 'unknown';
                        color = '#808080'; // Gray for unavailable data
                    }

                    // Apply traffic condition based on trafficRatio
                    if (trafficRatio !== null) {
                        if (trafficRatio > 1.5) {
                            trafficCondition = 'heavy';
                            color = '#9B1313'; // Red
                        } else if (trafficRatio > 1.2) {
                            trafficCondition = 'moderate';
                            color = '#FFA500'; // Orange
                        }
                    }

                    return {
                        polyline: step.polyline.points,
                        trafficCondition,
                        color,
                        distance: step.distance.text,
                        duration: step.duration.text,
                        instruction: step.html_instructions,
                    };
                });

                return {
                    legIndex,
                    steps,
                    distance: leg.distance.value / 1000,
                    duration: leg.duration.value / 60,
                };
            });

            const data = {
                distance: route.legs.reduce((sum, leg) => sum + leg.distance.value, 0) / 1000,
                duration: route.legs.reduce((sum, leg) => sum + leg.duration.value, 0) / 60,
                steps: route.legs.flatMap((leg) =>
                    leg.steps.map((step) => ({
                        instruction: step.html_instructions,
                        distance: step.distance.text,
                        duration: step.duration.text,
                        start_location: {
                            lat: step.start_location.lat,
                            lng: step.start_location.lng,
                        },
                        polyline: step.polyline.points,
                    }))
                ),
                polyline: route.overview_polyline.points,
                waypointOrder: optimizeWaypoints ? waypointOrder : undefined,
                trafficSegments,
                optimizedPoints: optimizeWaypoints ? optimizedPoints : undefined,
            };

            await this.redisClient?.set(cacheKey, JSON.stringify(data), 'EX', 3600);
            return data;
        } catch (error) {
            throw new Error(`Failed to get directions: ${error.message}`);
        }
    }

    static async updateUserLocation(userId, coordinates) {
        try {
            const { lat, lng } = coordinates;
            if (!lat || !lng) {
                throw new Error('Latitude and longitude are required');
            }
            const address = await this.reverseGeocode(lat, lng);
            const cacheKey = `userLocation:${userId}`;
            const locationData = {
                userId,
                latitude: lat,
                longitude: lng,
                address: address.formattedAddress,
                timestamp: new Date().toISOString(),
            };
            await this.redisClient?.set(cacheKey, JSON.stringify(locationData), 'EX', 3600);
            await RedisUtils.publishEvent('userLocationUpdate', locationData);
            return locationData;
        } catch (error) {
            throw new Error(`Failed to update user location: ${error.message}`);
        }
    }



    // Geocode an address
    static async geocodeAddress(address, region = null) {
        if (!this.client) {
            return { mock: true, address };
        }

        try {
            const cacheKey = `geocode:${address}:${region || ''}`;
            let cachedResult = await this.redisClient?.get(cacheKey);
            if (cachedResult) {
                return JSON.parse(cachedResult);
            }

            const params = {
                address,
                key: process.env.GOOGLE_MAPS_API_KEY,
                ...(region && { region }),
            };

            const response = await this.client.geocode({ params });
            const result = response.data.results[0];
            if (!result) {
                throw new Error('No geocoding results found');
            }

            const data = {
                latitude: result.geometry.location.lat,
                longitude: result.geometry.location.lng,
                formattedAddress: result.formatted_address,
            };

            await this.redisClient?.set(cacheKey, JSON.stringify(data), 'EX', 3600);
            return data;
        } catch (error) {
            throw new Error(`Failed to geocode address: ${error.message}`);
        }
    }

    // Reverse geocode coordinates
    static async reverseGeocode(lat, lng) {
        if (!this.client) {
            return { mock: true, lat, lng };
        }

        try {
            const cacheKey = `reverseGeocode:${lat}:${lng}`;
            let cachedResult = await this.redisClient?.get(cacheKey);
            if (cachedResult) {
                return JSON.parse(cachedResult);
            }

            const response = await this.client.reverseGeocode({
                params: {
                    latlng: `${lat},${lng}`,
                    key: process.env.GOOGLE_MAPS_API_KEY,
                },
            });

            const result = response.data.results[0];
            if (!result) {
                throw new Error('No reverse geocoding results found');
            }

            const data = {
                formattedAddress: result.formatted_address,
                placeId: result.place_id,
            };

            await this.redisClient?.set(cacheKey, JSON.stringify(data), 'EX', 3600);
            return data;
        } catch (error) {
            throw new Error(`Failed to reverse geocode: ${error.message}`);
        }
    }


    // Get distance matrix
    static async getDistanceMatrix(origins, destinations, mode = 'driving') {
        if (!this.client) {
            return { mock: true, origins, destinations };
        }

        try {
            const cacheKey = `distanceMatrix:${origins.join('|')}:${destinations.join('|')}:${mode}`;
            let cachedResult = await this.redisClient?.get(cacheKey);
            if (cachedResult) {
                return JSON.parse(cachedResult);
            }

            const response = await this.client.distancematrix({
                params: {
                    origins,
                    destinations,
                    mode,
                    key: process.env.GOOGLE_MAPS_API_KEY,
                    departure_time: 'now',
                },
            });

            const rows = response.data.rows;
            if (!rows.length) {
                throw new Error('No distance matrix results found');
            }

            const data = rows.map(row =>
                row.elements.map(element => ({
                    distance: element.distance?.value / 1000 || null, // km
                    duration: element.duration?.value / 60 || null, // minutes
                    status: element.status,
                }))
            );

            await this.redisClient?.set(cacheKey, JSON.stringify(data), 'EX', 3600);
            return data;
        } catch (error) {
            throw new Error(`Failed to get distance matrix: ${error.message}`);
        }
    }

    // Search places with autocomplete
    static async searchPlaces(query, location = null, radius = 5000) {
        if (!this.client) {
            return { mock: true, query };
        }

        try {
            const cacheKey = `places:${query}:${location?.lat || ''}:${location?.lng || ''}:${radius}`;
            let cachedResult = await this.redisClient?.get(cacheKey);
            if (cachedResult) {
                return JSON.parse(cachedResult);
            }

            const response = await this.client.placeAutocomplete({
                params: {
                    input: query,
                    location: location ? `${location.lat},${location.lng}` : undefined,
                    radius,
                    key: process.env.GOOGLE_MAPS_API_KEY,
                },
            });

            const results = response.data.predictions.map(prediction => ({
                description: prediction.description,
                placeId: prediction.place_id,
                structuredFormatting: prediction.structured_formatting,
            }));

            await this.redisClient?.set(cacheKey, JSON.stringify(results), 'EX', 3600);
            return results;
        } catch (error) {
            throw new Error(`Failed to search places: ${error.message}`);
        }
    }

    // Get place details
    static async getPlaceDetails(placeId) {
        if (!this.client) {
            return { mock: true, placeId };
        }

        try {
            const cacheKey = `placeDetails:${placeId}`;
            let cachedResult = await this.redisClient?.get(cacheKey);
            if (cachedResult) {
                return JSON.parse(cachedResult);
            }

            const response = await this.client.placeDetails({
                params: {
                    place_id: placeId,
                    key: process.env.GOOGLE_MAPS_API_KEY,
                },
            });

            const result = response.data.result;
            const data = {
                name: result.name,
                address: result.formatted_address,
                latitude: result.geometry.location.lat,
                longitude: result.geometry.location.lng,
            };

            await this.redisClient?.set(cacheKey, JSON.stringify(data), 'EX', 3600);
            return data;
        } catch (error) {
            throw new Error(`Failed to get place details: ${error.message}`);
        }
    }

    // Get nearby agents
    static async getNearbyAgents(userLocation, radius = 5000) {
        try {
            const agents = await Agent.findAll();
            const nearbyAgents = await Promise.all(
                agents.map(async agent => {
                    if (!agent.location) return null;
                    const [lat, lng] = agent.location.split(',').map(Number);
                    const distance = this.calculateDistance(userLocation.lat, userLocation.lng, lat, lng);
                    if (distance <= radius / 1000) { // Convert radius to km
                        return { ...agent.toJSON(), distance };
                    }
                    return null;
                })
            );

            return nearbyAgents.filter(agent => agent).sort((a, b) => a.distance - b.distance);
        } catch (error) {
            throw new Error(`Failed to get nearby agents: ${error.message}`);
        }
    }

    // Notify nearby agents
    static async notifyNearbyAgents(userId, userLocation, radius = 5000) {
        try {
            const nearbyAgents = await this.getNearbyAgents(userLocation, radius);
            const notifications = nearbyAgents.map(agent => ({
                userId,
                message: `Agent ${agent.name} is nearby (${agent.distance.toFixed(2)} km) at ${agent.location}`,
                type: 'nearby_agent',
                data: { agentId: agent.agentID, location: agent.location },
            }));

            // Publish notifications via Redis
            for (const notification of notifications) {
                await RedisUtils.publishEvent('notifications', notification);
            }

            return notifications;
        } catch (error) {
            throw new Error(`Failed to notify nearby agents: ${error.message}`);
        }
    }

    // Calculate distance between two points (Haversine formula)
    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth radius in km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    }

    // Manage agent locations (CRUD)
    static async addAgentLocation(agentId, address) {
        try {
            const geocode = await this.geocodeAddress(address);
            const agent = await Agent.findByPk(agentId);
            if (!agent) {
                throw new Error('Agent not found');
            }

            agent.location = `${geocode.latitude},${geocode.longitude}`;
            await agent.save();
            return { agentId, location: agent.location, address: geocode.formattedAddress };
        } catch (error) {
            throw new Error(`Failed to add agent location: ${error.message}`);
        }
    }

    static async updateAgentLocation(agentId, lat, lng, address) {
        try {
            const agent = await Agent.findByPk(agentId, { include: [Delegation] });
            if (!agent) {
                throw new Error('Agent not found');
            }

            agent.latitude = lat;
            agent.longitude = lng;
            agent.location = `${lat},${lng}`;
            agent.address = address; // Store the provided address
            await agent.save();

            return {
                agentId,
                latitude: lat,
                longitude: lng,
                address,
                delegation: agent.Delegation ? { id: agent.Delegation.delegationID, name: agent.Delegation.name } : null,
            };
        } catch (error) {
            throw new Error(`Failed to update agent location: ${error.message}`);
        }
    }

    static async deleteAgentLocation(agentId) {
        try {
            const agent = await Agent.findByPk(agentId);
            if (!agent) {
                throw new Error('Agent not found');
            }

            agent.location = null;
            await agent.save();
            return { agentId, message: 'Agent location deleted' };
        } catch (error) {
            throw new Error(`Failed to delete agent location: ${error.message}`);
        }
    }

    // Get all agent locations for map display
    static async getAgentLocations() {
        try {
            const agents = await Agent.findAll({
                include: [{
                    model: Delegation,
                    attributes: ['delegationID', 'name'],
                    include: [{
                        model: Governorate,
                        attributes: ['governorateID', 'name'],
                        include: [{
                            model: Region,
                            attributes: ['regionID', 'name']
                        }]
                    }]
                }],
            });

            const locations = await Promise.all(
                agents.map(async agent => {
                    let lat, lng, address, source = 'agent';

                    // Check agent's database coordinates first
                    if (
                        agent.latitude != null &&
                        agent.longitude != null &&
                        !isNaN(agent.latitude) &&
                        !isNaN(agent.longitude) &&
                        agent.latitude >= -90 &&
                        agent.latitude <= 90 &&
                        agent.longitude >= -180 &&
                        agent.longitude <= 180
                    ) {
                        lat = agent.latitude;
                        lng = agent.longitude;
                        source = 'agent';
                        // Attempt to reverse geocode for address
                        try {
                            const reverseGeocode = await this.reverseGeocode(lat, lng);
                            address = { formattedAddress: reverseGeocode.formattedAddress };
                        } catch (error) {
                            address = { formattedAddress: agent.location || 'Unknown Address' };
                        }
                    } else {
                        // Fallback to delegation geocoding
                        const delegation = agent.Delegation;
                        const governorate = delegation?.Governorate;
                        const region = governorate?.Region;

                        if (delegation?.name) {
                            const cacheKey = `geocode:${delegation.name}:tn`;
                            let cachedResult = await this.redisClient?.get(cacheKey);
                            if (cachedResult) {
                                const data = JSON.parse(cachedResult);
                                lat = data.latitude;
                                lng = data.longitude;
                                address = { formattedAddress: delegation.name };
                                source = 'delegation';
                            } else {
                                try {
                                    const geocode = await this.geocodeAddress(
                                        `${delegation.name}, ${governorate?.name || ''}, Tunisia`,
                                        'tn'
                                    );
                                    lat = geocode.latitude;
                                    lng = geocode.longitude;
                                    address = { formattedAddress: geocode.formattedAddress };
                                    await this.redisClient?.set(cacheKey, JSON.stringify(geocode), 'EX', 3600);
                                    source = 'delegation';
                                } catch (error) {
                                    throw new Error(`Failed to geocode delegation ${delegation.name}: ${error.message}`);
                                }
                            }
                        }

                        // Fallback to governorate if delegation geocoding fails
                        if ((!lat || !lng) && governorate?.name) {
                            const cacheKey = `geocode:${governorate.name}:tn`;
                            let cachedResult = await this.redisClient?.get(cacheKey);
                            if (cachedResult) {
                                const data = JSON.parse(cachedResult);
                                lat = data.latitude;
                                lng = data.longitude;
                                address = { formattedAddress: governorate.name };
                                source = 'governorate';
                            } else {
                                try {
                                    const geocode = await this.geocodeAddress(
                                        `${governorate.name}, Tunisia`,
                                        'tn'
                                    );
                                    lat = geocode.latitude;
                                    lng = geocode.longitude;
                                    address = { formattedAddress: geocode.formattedAddress };
                                    await this.redisClient?.set(cacheKey, JSON.stringify(geocode), 'EX', 3600);
                                    source = 'governorate';
                                } catch (error) {
                                    throw new Error(`Failed to geocode governorate ${governorate.name}: ${error.message}`);
                                }
                            }
                        }

                        // Final fallback: Center of Tunisia
                        if (!lat || !lng) {
                            lat = 36.8065; // Center of Tunisia
                            lng = 10.1815;
                            address = { formattedAddress: 'Center of Tunisia' };
                            source = 'default';
                        }
                    }

                    // Extract delegation, governorate, and region from agent object
                    const delegation = agent.Delegation;
                    const governorate = delegation?.Governorate;
                    const region = governorate?.Region;

                    return {
                        agentId: agent.agentID,
                        name: agent.name,
                        lastname: agent.lastname,
                        email: agent.email,
                        phone: agent.phone,
                        latitude: lat,
                        longitude: lng,
                        address: address.formattedAddress,
                        source,
                        delegation: delegation ? {
                            id: delegation.delegationID,
                            name: delegation.name
                        } : null,
                        governorate: governorate ? {
                            id: governorate.governorateID,
                            name: governorate.name
                        } : null,
                        region: region ? {
                            id: region.regionID,
                            name: region.name
                        } : null,
                    };
                })
            );

            const center = locations.length
                ? {
                    lat: locations.reduce((sum, loc) => sum + loc.latitude, 0) / locations.length,
                    lng: locations.reduce((sum, loc) => sum + loc.longitude, 0) / locations.length,
                }
                : { lat: 36.8065, lng: 10.1815 };

            return { locations, center };
        } catch (error) {
            throw new Error(`Failed to get agent locations: ${error.message}`);
        }
    }
    // Get map link for a location
    static async getMapLink(address) {
        try {
            const geocode = await this.geocodeAddress(address);
            return `https://www.google.com/maps?q=${geocode.latitude},${geocode.longitude}`;
        } catch (error) {
            return address;
        }
    }

    // Get current user location (assumes frontend sends coordinates)
    static async getCurrentUserLocation(userId, coordinates) {
        try {
            const user = await User.findByPk(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const { lat, lng } = coordinates;
            const address = await this.reverseGeocode(lat, lng);
            return { userId, latitude: lat, longitude: lng, address: address.formattedAddress };
        } catch (error) {
            throw new Error(`Failed to get current user location: ${error.message}`);
        }
    }

    // Get specific user location
    static async getSpecificUserLocation(userId) {
        try {
            const user = await User.findByPk(userId, { include: [{ model: Agent }] });
            if (!user) {
                throw new Error('User not found');
            }

            if (user.Agents?.length) {
                const agent = user.Agents[0];
                if (agent.location) {
                    const [lat, lng] = agent.location.split(',').map(Number);
                    const address = await this.reverseGeocode(lat, lng);
                    return { userId, latitude: lat, longitude: lng, address: address.formattedAddress };
                }
            }

            throw new Error('No location found for user');
        } catch (error) {
            throw new Error(`Failed to get specific user location: ${error.message}`);
        }
    }


    static async getNearbyPlaces(location, radius = 5000, type = null) {
        if (!this.client) return { mock: true, location };
        try {
            const cacheKey = `nearbyPlaces:${location.lat}:${location.lng}:${radius}:${type || ''}`;
            let cachedResult = await this.redisClient?.get(cacheKey);
            if (cachedResult) return JSON.parse(cachedResult);

            const response = await this.client.placesNearby({
                params: {
                    location: `${location.lat},${location.lng}`,
                    radius,
                    type,
                    key: process.env.GOOGLE_MAPS_API_KEY,
                },
            });

            const results = response.data.results.map(place => ({
                name: place.name,
                placeId: place.place_id,
                latitude: place.geometry.location.lat,
                longitude: place.geometry.location.lng,
                types: place.types,
            }));

            await this.redisClient?.set(cacheKey, JSON.stringify(results), 'EX', 3600);
            return results;
        } catch (error) {
            throw new Error(`Failed to get nearby places: ${error.message}`);
        }
    }

}

GoogleMapsService.initialize().catch(error => {
    logger.error(`Google Maps Service initialization failed: ${error.message}`);
});

module.exports = GoogleMapsService;