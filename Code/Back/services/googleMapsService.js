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
            logger.error(`Redis initialization failed: ${error.message}`);
            this.redisClient = null;
            this.client = new Client({});
        }
    }






























    // Get directions

    static async getDirections(origin, destination, mode = 'driving', waypoints = [], trafficModel = 'best_guess', optimizeWaypoints = false) {
        let params; // Declare params in the outer scope
        try {
            // Validate inputs
            if (!origin || !destination) {
                throw new Error('Origin and destination are required');
            }

            // Format and validate waypoints
            let formattedWaypoints = [];
            try {
                formattedWaypoints = waypoints.map((wp, index) => {
                    let location;
                    if (typeof wp === 'string') {
                        location = wp;
                    } else if (wp && typeof wp === 'object' && wp.location) {
                        location = wp.location;
                    } else {
                        throw new Error(`Invalid waypoint format at index ${index}`);
                    }

                    if (!/^-?\d+\.\d{1,15},-?\d+\.\d{1,15}$/.test(location)) {
                        throw new Error(`Invalid waypoint location format at index ${index}: ${location}`);
                    }

                    return wp.stopover === true ? `via:${location}` : location;
                });
            } catch (waypointError) {
                logger.error(`Waypoint processing failed: ${waypointError.message}`, {
                    waypoints,
                    index: waypointError.message.match(/index (\d+)/)?.[1],
                    location: waypointError.message.match(/: (.+)$/)?.[1],
                });
                throw new Error(`Waypoint processing failed: ${waypointError.message}`);
            }

            // Create cache key
            const cacheKey = `directions:${origin}:${destination}:${mode}:${waypoints
                .map((wp) => (typeof wp === 'string' ? wp : wp.location))
                .join('|')}:${trafficModel}:${optimizeWaypoints}`;
            let cachedResult = await this.redisClient?.get(cacheKey);
            if (cachedResult) {
                return JSON.parse(cachedResult);
            }

            // Direct API call
            const url = 'https://maps.googleapis.com/maps/api/directions/json';
            params = {
                origin,
                destination,
                mode,
                key: process.env.GOOGLE_MAPS_API_KEY,
                departure_time: 'now',
                traffic_model: trafficModel,
                optimizeWaypoints, // Add optimizeWaypoints parameter
                ...(formattedWaypoints.length && { waypoints: formattedWaypoints.join('|') }),
            };

            logger.debug('Directions API params', { params });

            const response = await axios.get(url, { params });
            if (response.data.status !== 'OK') {
                throw new Error(`Directions API error: ${response.data.status}`);
            }

            const route = response.data.routes[0];
            if (!route) {
                throw new Error('No directions found');
            }

            const data = {
                distance: route.legs.reduce((sum, leg) => sum + leg.distance.value, 0) / 1000, // km
                duration: route.legs.reduce((sum, leg) => sum + leg.duration.value, 0) / 60, // minutes
                steps: route.legs.flatMap((leg) =>
                    leg.steps.map((step) => ({
                        instruction: step.html_instructions,
                        distance: step.distance.text,
                        duration: step.duration.text,
                    }))
                ),
                polyline: route.overview_polyline.points,
                waypointOrder: route.waypoint_order || [],
            };

            await this.redisClient?.set(cacheKey, JSON.stringify(data), 'EX', 3600);
            return data;
        } catch (error) {
            logger.error(`Failed to get directions: ${error.message}`, {
                origin,
                destination,
                mode,
                waypoints,
                trafficModel,
                optimizeWaypoints,
                params: params || 'undefined',
            });
            throw new Error(`Failed to get directions: ${error.message}`);
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
            logger.error(`Failed to geocode address: ${error.message}`);
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
            logger.error(`Failed to reverse geocode: ${error.message}`);
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
            logger.error(`Failed to get distance matrix: ${error.message}`);
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
            logger.error(`Failed to search places: ${error.message}`);
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
            logger.error(`Failed to get place details: ${error.message}`);
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
            logger.error(`Failed to get nearby agents: ${error.message}`);
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
            logger.error(`Failed to notify nearby agents: ${error.message}`);
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
            logger.error(`Failed to add agent location: ${error.message}`);
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
            logger.error(`Failed to update agent location: ${error.message}`);
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
            logger.error(`Failed to delete agent location: ${error.message}`);
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

                    // Since all agent lat/lng are null or incorrect, skip directly to delegation
                    const delegation = agent.Delegation;
                    const governorate = delegation?.Governorate;
                    const region = governorate?.Region;

                    // Fallback logic: Delegation -> Governorate -> Tunisia center
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
                                // Improved geocoding query with context
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
                                logger.warn(`Failed to geocode delegation ${delegation.name}: ${error.message}`);
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
                                logger.warn(`Failed to geocode governorate ${governorate.name}: ${error.message}`);
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
            logger.error(`Failed to get agent locations: ${error.message}`);
            throw new Error(`Failed to get agent locations: ${error.message}`);
        }
    }

    // Get map link for a location
    static async getMapLink(address) {
        try {
            const geocode = await this.geocodeAddress(address);
            return `https://www.google.com/maps?q=${geocode.latitude},${geocode.longitude}`;
        } catch (error) {
            logger.error(`Failed to generate map link: ${error.message}`);
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
            logger.error(`Failed to get current user location: ${error.message}`);
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
            logger.error(`Failed to get specific user location: ${error.message}`);
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
            logger.error(`Failed to get nearby places: ${error.message}`);
            throw new Error(`Failed to get nearby places: ${error.message}`);
        }
    }

}

GoogleMapsService.initialize().catch(error => {
    logger.error(`Google Maps Service initialization failed: ${error.message}`);
});

module.exports = GoogleMapsService;