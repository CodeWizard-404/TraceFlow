const { error } = require('winston');
const { route } = require('../routes/agentRoutes');
const GoogleMapsService = require('../services/googleMapsService');
const LocationService = require('../services/locationsService');
const logger = require('../utils/logger');

/**
 * Controller for managing location-related operations, including Google Maps APIs.
 */
class LocationController {
    /**
     * Get full address and location info by ID.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with location data and address.
     */
    static async getLocationDetailsById(req, res) {
        const actorID = req.user?.userID || 'unknown';
        const id = req.query.id; // Remove parseInt, keep as string

        try {
            const result = await LocationService.getLocationById(id);

            const statusCode = result.success ? 200 : 404;

            logger.info('Fetched location details by ID', {
                route: 'locations/location-details',
                method: req.method,
                url: req.originalUrl,
                status: statusCode,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { requestedId: id, ...result }
            });

            return res.status(statusCode).json(result);
        } catch (error) {
            logger.error('Failed to fetch location details by ID', {
                route: 'locations/location-details',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { requestedId: id, error: error.message }
            });

            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }



    /**
     * Get all regions.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with all regions.
     */
    static async getAllRegions(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const regions = await LocationService.getAllRegions();
            logger.info('Successfully fetched all regions', {
                route: 'locations/regions',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { regionCount: regions.length }
            });
            return res.status(200).json(regions);
        } catch (error) {
            logger.error('Failed to fetch all regions', {
                route: 'locations/regions',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get all governorates.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with all governorates.
     */
    static async getAllGovernorates(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const governorates = await LocationService.getAllGovernorates();
            logger.info('Successfully fetched all governorates', {
                route: 'locations/governorates',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { governorateCount: governorates.length }
            });
            return res.status(200).json(governorates);
        } catch (error) {
            logger.error('Failed to fetch all governorates', {
                route: 'locations/governorates',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get all delegations.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with all delegations.
     */
    static async getAllDelegations(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const delegations = await LocationService.getAllDelegations();
            logger.info('Successfully fetched all delegations', {
                route: 'locations/delegations',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { delegationCount: delegations.length }
            });
            return res.status(200).json(delegations);
        } catch (error) {
            logger.error('Failed to fetch all delegations', {
                route: 'locations/delegations',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get delegations by governorate.
     * @param {Object} req - Express request object with governorateID in query.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with delegations.
     */
    static async getDelegationsByGovernorate(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { governorateID } = req.query;
            if (!governorateID) {
                logger.warn('Failed to fetch delegations: Missing governorateID', {
                    route: 'locations/delegations/governorate',
                    method: req.method,
                    url: req.originalUrl,
                    status: 200,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(200).json([]);
            }
            const delegations = await LocationService.getDelegationsByGovernorate(governorateID);
            logger.info('Successfully fetched delegations for governorate', {
                route: 'locations/delegations/governorate',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { governorateID, delegationCount: delegations.length }
            });
            return res.status(200).json(delegations);
        } catch (error) {
            logger.error('Failed to fetch delegations by governorate', {
                route: 'locations/delegations/governorate',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get governorates by region.
     * @param {Object} req - Express request object with regionID in query.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with governorates.
     */
    static async getGovernorateByRegion(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { regionID } = req.query;
            if (!regionID) {
                logger.warn('Failed to fetch governorates: Missing regionID', {
                    route: 'locations/governorates/region',
                    method: req.method,
                    url: req.originalUrl,
                    status: 200,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(200).json([]);
            }
            const governorates = await LocationService.getGovernorateByRegion(regionID);
            logger.info('Successfully fetched governorates for region', {
                route: 'locations/governorates/region',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { regionID, governorateCount: governorates.length }
            });
            return res.status(200).json(governorates);
        } catch (error) {
            logger.error('Failed to fetch governorates by region', {
                route: 'locations/governorates/region',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get regions by governorate.
     * @param {Object} req - Express request object with governorateID in query.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with regions.
     */
    static async getRegionsByGovernorate(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { governorateID } = req.query;
            if (!governorateID) {
                logger.warn('Failed to fetch regions: Missing governorateID', {
                    route: 'locations/regions/governorate',
                    method: req.method,
                    url: req.originalUrl,
                    status: 200,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(200).json([]);
            }
            const regions = await LocationService.getRegionsByGovernorate(governorateID);
            logger.info('Successfully fetched regions for governorate', {
                route: 'locations/regions/governorate',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { governorateID, regionCount: regions.length }
            });
            return res.status(200).json(regions);
        } catch (error) {
            logger.error('Failed to fetch regions by governorate', {
                route: 'locations/regions/governorate',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get governorates by delegation.
     * @param {Object} req - Express request object with delegationID in query.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with governorates.
     */
    static async getGovernoratesByDelegation(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { delegationID } = req.query;
            if (!delegationID) {
                logger.warn('Failed to fetch governorates: Missing delegationID', {
                    route: 'locations/governorates/delegation',
                    method: req.method,
                    url: req.originalUrl,
                    status: 200,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(200).json([]);
            }
            const governorates = await LocationService.getGovernoratesByDelegation(delegationID);
            logger.info('Successfully fetched governorates for delegation', {
                route: 'locations/governorates/delegation',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { delegationID, governorateCount: governorates.length }
            });
            return res.status(200).json(governorates);
        } catch (error) {
            logger.error('Failed to fetch governorates by delegation', {
                route: 'locations/governorates/delegation',
                method: req.method,
                url: req.originalUrl,
                status: 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get regions assigned to a user.
     * @param {Object} req - Express request object with userID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with regions or error.
     */
    static async getRegionsByUser(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn('Failed to fetch regions: Missing userID', {
                    route: 'locations/regions/user',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'User ID is required' });
            }
            const regions = await LocationService.getRegionsByUser(userID);
            logger.info('Successfully fetched regions for user', {
                route: 'locations/regions/user',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID, regionCount: regions.length }
            });
            return res.status(200).json(regions);
        } catch (error) {
            logger.error('Failed to fetch regions for user', {
                route: 'locations/regions/user',
                method: req.method,
                url: req.originalUrl,
                status: 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(404).json({ error: error.message || 'Regions not found' });
        }
    }

    /**
     * Get governorates assigned to a user.
     * @param {Object} req - Express request object with userID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with governorates or error.
     */
    static async getGovernoratesByUser(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn('Failed to fetch governorates: Missing userID', {
                    route: 'locations/governorates/user',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'User ID is required' });
            }
            const governorates = await LocationService.getGovernoratesByUser(userID);
            logger.info('Successfully fetched governorates for user', {
                route: 'locations/governorates/user',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID, governorateCount: governorates.length }
            });
            return res.status(200).json(governorates);
        } catch (error) {
            logger.error('Failed to fetch governorates for user', {
                route: 'locations/governorates/user',
                method: req.method,
                url: req.originalUrl,
                status: 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(404).json({ error: error.message || 'Governorates not found' });
        }
    }

    /**
     * Get delegations assigned to a user.
     * @param {Object} req - Express request object with userID in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with delegations or error.
     */
    static async getDelegationsByUser(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn('Failed to fetch delegations: Missing userID', {
                    route: 'locations/delegations/user',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'User ID is required' });
            }
            const delegations = await LocationService.getDelegationsByUser(userID);
            logger.info('Successfully fetched delegations for user', {
                route: 'locations/delegations/user',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { userID, delegationCount: delegations.length }
            });
            return res.status(200).json(delegations);
        } catch (error) {
            logger.error('Failed to fetch delegations for user', {
                route: 'locations/delegations/user',
                method: req.method,
                url: req.originalUrl,
                status: 404,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(404).json({ error: error.message || 'Delegations not found' });
        }
    }

    /**
     * Geocode an address using Google Maps API.
     * @param {Object} req - Express request object with address in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with geocoded location.
     */
    static async geocodeAddress(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { address } = req.body;
            if (!address) {
                logger.warn('Failed to geocode address: Missing address', {
                    route: 'locations/geocode',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Address is required' });
            }
            const result = await GoogleMapsService.geocodeAddress(address);
            logger.info('Successfully geocoded address', {
                route: 'locations/geocode',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { address }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to geocode address', {
                route: 'locations/geocode',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to geocode address' });
        }
    }

    /**
     * Get directions between two points using Google Maps API.
     * @param {Object} req - Express request object with origin and destination in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with directions.
     */
    static async getDirections(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { origin, destination, mode } = req.body;
            if (!origin || !destination) {
                logger.warn('Failed to fetch directions: Missing origin or destination', {
                    route: 'locations/directions',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Origin and destination are required' });
            }
            const result = await GoogleMapsService.getDirections(origin, destination, mode);
            logger.info('Successfully fetched directions', {
                route: 'locations/directions',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { origin, destination }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to fetch directions', {
                route: 'locations/directions',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to get directions' });
        }
    }

    /**
     * Search for places using Google Maps Places API.
     * @param {Object} req - Express request object with query and location in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with place results.
     */
    static async searchPlaces(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { query, location, radius } = req.body;
            if (!query) {
                logger.warn('Failed to search places: Missing query', {
                    route: 'locations/places',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Query is required' });
            }
            const result = await GoogleMapsService.searchPlaces(query, location, radius);
            logger.info('Successfully searched places', {
                route: 'locations/places',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { query }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to search places', {
                route: 'locations/places',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to search places' });
        }
    }

    /**
     * Get distance matrix using Google Maps Distance Matrix API.
     * @param {Object} req - Express request object with origins and destinations in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with distance matrix.
     */
    static async getDistanceMatrix(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { origins, destinations, mode } = req.body;
            if (!origins || !destinations) {
                logger.warn('Failed to fetch distance matrix: Missing origins or destinations', {
                    route: 'locations/distance-matrix',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: {}
                });
                return res.status(400).json({ error: 'Origins and destinations are required' });
            }
            const result = await GoogleMapsService.getDistanceMatrix(origins, destinations, mode);
            logger.info('Successfully fetched distance matrix', {
                route: 'locations/distance-matrix',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { originCount: Array.isArray(origins) ? origins.length : 1, destinationCount: Array.isArray(destinations) ? destinations.length : 1 }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to fetch distance matrix', {
                route: 'locations/distance-matrix',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to get distance matrix' });
        }
    }


























    static async getPlaceDetails(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { placeId } = req.body;
            if (!placeId) {
                logger.warn('Failed to fetch place details: Missing placeId', {
                    route: 'locations/place-details',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { error: 'Place ID is required' }
                });
                return res.status(400).json({ error: 'Place ID is required' });
            }
            const result = await GoogleMapsService.getPlaceDetails(placeId);
            logger.info('Successfully fetched place details', {
                route: 'locations/place-details',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { placeId }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to fetch place details', {
                route: 'locations/place-details',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to get place details' });
        }
    }

    static async getNearbyPlaces(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { lat, lng, radius, type } = req.body;
            if (!lat || !lng) {
                logger.warn('Failed to fetch nearby places: Missing coordinates', {
                    route: 'locations/nearby-places',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { error: 'Latitude and longitude are required' }
                });
                return res.status(400).json({ error: 'Latitude and longitude are required' });
            }
            const location = { lat: parseFloat(lat), lng: parseFloat(lng) };
            const result = await GoogleMapsService.getNearbyPlaces(location, parseFloat(radius) || 5000, type);
            logger.info('Successfully fetched nearby places', {
                route: 'locations/nearby-places',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { location, radius, type }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to fetch nearby places', {
                route: 'locations/nearby-places',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to get nearby places' });
        }
    }

    static async getCurrentUserLocation(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { lat, lng } = req.body;
            if (!lat || !lng) {
                logger.warn('Failed to get current user location: Missing coordinates', {
                    route: 'locations/current-location',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { error: 'Latitude and longitude are required' }
                });
                return res.status(400).json({ error: 'Latitude and longitude are required' });
            }
            const result = await GoogleMapsService.getCurrentUserLocation(actorID, { lat: parseFloat(lat), lng: parseFloat(lng) });
            logger.info('Successfully fetched current user location', {
                route: 'locations/current-location',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { lat, lng }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to get current user location', {
                route: 'locations/current-location',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to get current user location' });
        }
    }

    static async getSpecificUserLocation(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { userId } = req.params;
            if (!userId) {
                logger.warn('Failed to get specific user location: Missing userId', {
                    route: 'locations/user-location',
                    method: req.method,
                    url: req.originalUrl,
                    status: 400,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    metadata: { error: 'User ID is required' }
                });
                return res.status(400).json({ error: 'User ID is required' });
            }
            const result = await GoogleMapsService.getSpecificUserLocation(userId);
            logger.info('Successfully fetched specific user location', {
                route: 'locations/user-location',
                method: req.method,
                url: req.originalUrl,
                status: 200,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { result }
            });
            return res.status(200).json(result);
        } catch (error) {
            logger.error('Failed to get specific user location', {
                route: 'locations/user-location',
                method: req.method,
                url: req.originalUrl,
                status: error.status || 500,
                ip: req.ip,
                traceId: req.traceId,
                userId: actorID,
                metadata: { error: error.message }
            });
            return res.status(error.status || 500).json({ error: error.message || 'Failed to get specific user location' });
        }
    }
}

module.exports = LocationController;