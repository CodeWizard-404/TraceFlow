const { error } = require('winston');
const { route } = require('../routes/agentRoutes');
const GoogleMapsService = require('../services/googleMapsService');
const LocationService = require('../services/locationsService');
const { logRequest } = require('../utils/controllerUtils');

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

            logRequest({
                req,
                res: result,
                status: statusCode,
                message: 'Fetched location details by ID',
                level: 'info',
                metadata: {
                    route: 'locations/location-details',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    requestedId: id,
                    ...result
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(statusCode).json(result);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: 'Failed to fetch location details by ID',
                level: 'error',
                metadata: {
                    route: 'locations/location-details',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    requestedId: id,
                    error: error.message
                },
                service: 'location',
                defaultRoute: 'locations',
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

            logRequest({
                req,
                res: regions,
                status: 200,
                message: 'Successfully fetched all regions',
                level: 'info',
                metadata: {
                    route: 'locations/regions',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    regionCount: regions.length
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(200).json(regions);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: 'Failed to fetch all regions',
                level: 'error',
                metadata: {
                    route: 'locations/regions',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    error: error.message
                },
                service: 'location',
                defaultRoute: 'locations',
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

            logRequest({
                req,
                res: governorates,
                status: 200,
                message: 'Successfully fetched all governorates',
                level: 'info',
                metadata: {
                    route: 'locations/governorates',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    governorateCount: governorates.length
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(200).json(governorates);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: 'Failed to fetch all governorates',
                level: 'error',
                metadata: {
                    route: 'locations/governorates',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    error: error.message
                },
                service: 'location',
                defaultRoute: 'locations',
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

            logRequest({
                req,
                res: delegations,
                status: 200,
                message: 'Successfully fetched all delegations',
                level: 'info',
                metadata: {
                    route: 'locations/delegations',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    delegationCount: delegations.length
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(200).json(delegations);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: 'Failed to fetch all delegations',
                level: 'error',
                metadata: {
                    route: 'locations/delegations',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    error: error.message
                },
                service: 'location',
                defaultRoute: 'locations',
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
                logRequest({
                    req,
                    res: [],
                    status: 200,
                    message: 'Failed to fetch delegations: Missing governorateID',
                    level: 'warn',
                    metadata: {
                        route: 'locations/delegations/governorate',
                        method: req.method,
                        url: req.originalUrl,
                        ip: req.ip,
                        traceId: req.traceId,
                        userId: actorID
                    },
                    service: 'location',
                    defaultRoute: 'locations',
                });

                return res.status(200).json([]);
            }

            const delegations = await LocationService.getDelegationsByGovernorate(governorateID);

            logRequest({
                req,
                res: delegations,
                status: 200,
                message: 'Successfully fetched delegations for governorate',
                level: 'info',
                metadata: {
                    route: 'locations/delegations/governorate',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    governorateID,
                    delegationCount: delegations.length
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(200).json(delegations);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: 'Failed to fetch delegations by governorate',
                level: 'error',
                metadata: {
                    route: 'locations/delegations/governorate',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    error: error.message
                },
                service: 'location',
                defaultRoute: 'locations',
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
                logRequest({
                    req,
                    res: [],
                    status: 200,
                    message: 'Failed to fetch governorates: Missing regionID',
                    level: 'warn',
                    metadata: {
                        route: 'locations/governorates/region',
                        method: req.method,
                        url: req.originalUrl,
                        ip: req.ip,
                        traceId: req.traceId,
                        userId: actorID
                    },
                    service: 'location',
                    defaultRoute: 'locations',
                });

                return res.status(200).json([]);
            }

            const governorates = await LocationService.getGovernorateByRegion(regionID);

            logRequest({
                req,
                res: governorates,
                status: 200,
                message: 'Successfully fetched governorates for region',
                level: 'info',
                metadata: {
                    route: 'locations/governorates/region',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    regionID,
                    governorateCount: governorates.length
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(200).json(governorates);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: 'Failed to fetch governorates by region',
                level: 'error',
                metadata: {
                    route: 'locations/governorates/region',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    error: error.message
                },
                service: 'location',
                defaultRoute: 'locations',
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
                logRequest({
                    req,
                    res: [],
                    status: 200,
                    message: 'Failed to fetch regions: Missing governorateID',
                    level: 'warn',
                    metadata: {
                        route: 'locations/regions/governorate',
                        method: req.method,
                        url: req.originalUrl,
                        ip: req.ip,
                        traceId: req.traceId,
                        userId: actorID
                    },
                    service: 'location',
                    defaultRoute: 'locations',
                });

                return res.status(200).json([]);
            }

            const regions = await LocationService.getRegionsByGovernorate(governorateID);

            logRequest({
                req,
                res: regions,
                status: 200,
                message: 'Successfully fetched regions for governorate',
                level: 'info',
                metadata: {
                    route: 'locations/regions/governorate',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    governorateID,
                    regionCount: regions.length
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(200).json(regions);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: 'Failed to fetch regions by governorate',
                level: 'error',
                metadata: {
                    route: 'locations/regions/governorate',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    error: error.message
                },
                service: 'location',
                defaultRoute: 'locations',
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
                logRequest({
                    req,
                    res: [],
                    status: 200,
                    message: 'Failed to fetch governorates: Missing delegationID',
                    level: 'warn',
                    metadata: {
                        route: 'locations/governorates/delegation',
                        method: req.method,
                        url: req.originalUrl,
                        ip: req.ip,
                        traceId: req.traceId,
                        userId: actorID
                    },
                    service: 'location',
                    defaultRoute: 'locations',
                });

                return res.status(200).json([]);
            }

            const governorates = await LocationService.getGovernoratesByDelegation(delegationID);

            logRequest({
                req,
                res: governorates,
                status: 200,
                message: 'Successfully fetched governorates for delegation',
                level: 'info',
                metadata: {
                    route: 'locations/governorates/delegation',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    delegationID,
                    governorateCount: governorates.length
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(200).json(governorates);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 500,
                message: 'Failed to fetch governorates by delegation',
                level: 'error',
                metadata: {
                    route: 'locations/governorates/delegation',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    error: error.message
                },
                service: 'location',
                defaultRoute: 'locations',
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
                logRequest({
                    req,
                    res: { error: 'User ID is required' },
                    status: 400,
                    message: 'Failed to fetch regions: Missing userID',
                    level: 'warn',
                    metadata: {
                        route: 'locations/regions/user',
                        method: req.method,
                        url: req.originalUrl,
                        ip: req.ip,
                        traceId: req.traceId,
                        userId: actorID
                    },
                    service: 'location',
                    defaultRoute: 'locations',
                });

                return res.status(400).json({ error: 'User ID is required' });
            }

            const regions = await LocationService.getRegionsByUser(userID);

            logRequest({
                req,
                res: regions,
                status: 200,
                message: 'Successfully fetched regions for user',
                level: 'info',
                metadata: {
                    route: 'locations/regions/user',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    userID,
                    regionCount: regions.length
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(200).json(regions);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 404,
                message: 'Failed to fetch regions for user',
                level: 'error',
                metadata: {
                    route: 'locations/regions/user',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    error: error.message
                },
                service: 'location',
                defaultRoute: 'locations',
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
                logRequest({
                    req,
                    res: { error: 'User ID is required' },
                    status: 400,
                    message: 'Failed to fetch governorates: Missing userID',
                    level: 'warn',
                    metadata: {
                        route: 'locations/governorates/user',
                        method: req.method,
                        url: req.originalUrl,
                        ip: req.ip,
                        traceId: req.traceId,
                        userId: actorID
                    },
                    service: 'location',
                    defaultRoute: 'locations',
                });

                return res.status(400).json({ error: 'User ID is required' });
            }

            const governorates = await LocationService.getGovernoratesByUser(userID);

            logRequest({
                req,
                res: governorates,
                status: 200,
                message: 'Successfully fetched governorates for user',
                level: 'info',
                metadata: {
                    route: 'locations/governorates/user',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    userID,
                    governorateCount: governorates.length
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(200).json(governorates);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 404,
                message: 'Failed to fetch governorates for user',
                level: 'error',
                metadata: {
                    route: 'locations/governorates/user',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    error: error.message
                },
                service: 'location',
                defaultRoute: 'locations',
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
                logRequest({
                    req,
                    res: { error: 'User ID is required' },
                    status: 400,
                    message: 'Failed to fetch delegations: Missing userID',
                    level: 'warn',
                    metadata: {
                        route: 'locations/delegations/user',
                        method: req.method,
                        url: req.originalUrl,
                        ip: req.ip,
                        traceId: req.traceId,
                        userId: actorID
                    },
                    service: 'location',
                    defaultRoute: 'locations',
                });

                return res.status(400).json({ error: 'User ID is required' });
            }

            const delegations = await LocationService.getDelegationsByUser(userID);

            logRequest({
                req,
                res: delegations,
                status: 200,
                message: 'Successfully fetched delegations for user',
                level: 'info',
                metadata: {
                    route: 'locations/delegations/user',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    userID,
                    delegationCount: delegations.length
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(200).json(delegations);
        } catch (error) {
            logRequest({
                req,
                error,
                status: 404,
                message: 'Failed to fetch delegations for user',
                level: 'error',
                metadata: {
                    route: 'locations/delegations/user',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    error: error.message
                },
                service: 'location',
                defaultRoute: 'locations',
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
                logRequest({
                    req,
                    res: { error: 'Address is required' },
                    status: 400,
                    message: 'Failed to geocode address: Missing address',
                    level: 'warn',
                    metadata: {
                        route: 'locations/geocode',
                        method: req.method,
                        url: req.originalUrl,
                        ip: req.ip,
                        traceId: req.traceId,
                        userId: actorID
                    },
                    service: 'location',
                    defaultRoute: 'locations',
                });

                return res.status(400).json({ error: 'Address is required' });
            }

            const result = await GoogleMapsService.geocodeAddress(address);

            logRequest({
                req,
                res: result,
                status: 200,
                message: 'Successfully geocoded address',
                level: 'info',
                metadata: {
                    route: 'locations/geocode',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    address
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(200).json(result);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: 'Failed to geocode address',
                level: 'error',
                metadata: {
                    route: 'locations/geocode',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    error: error.message
                },
                service: 'location',
                defaultRoute: 'locations',
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
            const { origin, destination, mode, waypoints, optimizeWaypoints } = req.body;
            if (!origin || !destination) {
                logRequest({
                    req,
                    res: { error: 'Origin and destination are required' },
                    status: 400,
                    message: 'Failed to fetch directions: Missing origin or destination',
                    level: 'warn',
                    metadata: {
                        route: 'locations/directions',
                        method: req.method,
                        url: req.originalUrl,
                        ip: req.ip,
                        traceId: req.traceId,
                        userId: actorID,
                        origin,
                        destination,
                        mode,
                        waypoints,
                        optimizeWaypoints
                    },
                    service: 'location',
                    defaultRoute: 'locations',
                });

                return res.status(400).json({ error: 'Origin and destination are required' });
            }

            const result = await GoogleMapsService.getDirections(origin, destination, mode, waypoints || [], 'best_guess', optimizeWaypoints);

            logRequest({
                req,
                res: result,
                status: 200,
                message: 'Successfully fetched directions',
                level: 'info',
                metadata: {
                    route: 'locations/directions',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    origin,
                    destination,
                    mode,
                    waypoints: waypoints || [],
                    optimizeWaypoints
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(200).json(result);
        } catch (error) {
            const errorMessage = error.message || 'Failed to get directions';

            logRequest({
                req,
                error,
                status: error.status || 500,
                message: 'Failed to fetch directions',
                level: 'error',
                metadata: {
                    route: 'locations/directions',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    error: errorMessage,
                    requestBody: req.body
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(error.status || 500).json({ error: errorMessage });
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
                logRequest({
                    req,
                    res: { error: 'Query is required' },
                    status: 400,
                    message: 'Failed to search places: Missing query',
                    level: 'warn',
                    metadata: {
                        route: 'locations/places',
                        method: req.method,
                        url: req.originalUrl,
                        ip: req.ip,
                        traceId: req.traceId,
                        userId: actorID
                    },
                    service: 'location',
                    defaultRoute: 'locations',
                });

                return res.status(400).json({ error: 'Query is required' });
            }

            const result = await GoogleMapsService.searchPlaces(query, location, radius);

            logRequest({
                req,
                res: result,
                status: 200,
                message: 'Successfully searched places',
                level: 'info',
                metadata: {
                    route: 'locations/places',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    query
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(200).json(result);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: 'Failed to search places',
                level: 'error',
                metadata: {
                    route: 'locations/places',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    error: error.message
                },
                service: 'location',
                defaultRoute: 'locations',
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
                logRequest({
                    req,
                    res: { error: 'Origins and destinations are required' },
                    status: 400,
                    message: 'Failed to fetch distance matrix: Missing origins or destinations',
                    level: 'warn',
                    metadata: {
                        route: 'locations/distance-matrix',
                        method: req.method,
                        url: req.originalUrl,
                        ip: req.ip,
                        traceId: req.traceId,
                        userId: actorID
                    },
                    service: 'location',
                    defaultRoute: 'locations',
                });

                return res.status(400).json({ error: 'Origins and destinations are required' });
            }

            const result = await GoogleMapsService.getDistanceMatrix(origins, destinations, mode);

            logRequest({
                req,
                res: result,
                status: 200,
                message: 'Successfully fetched distance matrix',
                level: 'info',
                metadata: {
                    route: 'locations/distance-matrix',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    originCount: Array.isArray(origins) ? origins.length : 1,
                    destinationCount: Array.isArray(destinations) ? destinations.length : 1
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(200).json(result);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: 'Failed to fetch distance matrix',
                level: 'error',
                metadata: {
                    route: 'locations/distance-matrix',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    error: error.message
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(error.status || 500).json({ error: error.message || 'Failed to get distance matrix' });
        }
    }

    /**
     * Update user location using Google Maps API.
     * @param {Object} req - Express request object with userId, lat, lng in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with updated location.
     */
    static async updateUserLocation(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { userId, lat, lng } = req.body;
            if (!userId || !lat || !lng) {
                logRequest({
                    req,
                    res: { error: 'User ID, latitude, and longitude are required' },
                    status: 400,
                    message: 'Failed to update user location: Missing parameters',
                    level: 'warn',
                    metadata: {
                        route: 'locations/update-location',
                        method: req.method,
                        url: req.originalUrl,
                        ip: req.ip,
                        traceId: req.traceId,
                        userId: actorID,
                        userId,
                        lat,
                        lng
                    },
                    service: 'location',
                    defaultRoute: 'locations',
                });

                return res.status(400).json({ error: 'User ID, latitude, and longitude are required' });
            }

            const result = await GoogleMapsService.updateUserLocation(userId, { lat: parseFloat(lat), lng: parseFloat(lng) });

            logRequest({
                req,
                res: result,
                status: 200,
                message: 'Successfully updated user location',
                level: 'info',
                metadata: {
                    route: 'locations/update-location',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    userId,
                    lat,
                    lng
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(200).json(result);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: 'Failed to update user location',
                level: 'error',
                metadata: {
                    route: 'locations/update-location',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    error: error.message
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(error.status || 500).json({ error: error.message || 'Failed to update user location' });
        }
    }

    /**
     * Get place details using Google Maps Places API.
     * @param {Object} req - Express request object with placeId in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with place details.
     */
    static async getPlaceDetails(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { placeId } = req.body;
            if (!placeId) {
                logRequest({
                    req,
                    res: { error: 'Place ID is required' },
                    status: 400,
                    message: 'Failed to fetch place details: Missing placeId',
                    level: 'warn',
                    metadata: {
                        route: 'locations/place-details',
                        method: req.method,
                        url: req.originalUrl,
                        ip: req.ip,
                        traceId: req.traceId,
                        userId: actorID,
                        error: 'Place ID is required'
                    },
                    service: 'location',
                    defaultRoute: 'locations',
                });

                return res.status(400).json({ error: 'Place ID is required' });
            }

            const result = await GoogleMapsService.getPlaceDetails(placeId);

            logRequest({
                req,
                res: result,
                status: 200,
                message: 'Successfully fetched place details',
                level: 'info',
                metadata: {
                    route: 'locations/place-details',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    placeId
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(200).json(result);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: 'Failed to fetch place details',
                level: 'error',
                metadata: {
                    route: 'locations/place-details',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    error: error.message
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(error.status || 500).json({ error: error.message || 'Failed to get place details' });
        }
    }

    /**
     * Get nearby places using Google Maps Places API.
     * @param {Object} req - Express request object with lat, lng, radius, type in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with nearby places.
     */
    static async getNearbyPlaces(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { lat, lng, radius, type } = req.body;
            if (!lat || !lng) {
                logRequest({
                    req,
                    res: { error: 'Latitude and longitude are required' },
                    status: 400,
                    message: 'Failed to fetch nearby places: Missing coordinates',
                    level: 'warn',
                    metadata: {
                        route: 'locations/nearby-places',
                        method: req.method,
                        url: req.originalUrl,
                        ip: req.ip,
                        traceId: req.traceId,
                        userId: actorID,
                        error: 'Latitude and longitude are required'
                    },
                    service: 'location',
                    defaultRoute: 'locations',
                });

                return res.status(400).json({ error: 'Latitude and longitude are required' });
            }

            const location = { lat: parseFloat(lat), lng: parseFloat(lng) };
            const result = await GoogleMapsService.getNearbyPlaces(location, parseFloat(radius) || 5000, type);

            logRequest({
                req,
                res: result,
                status: 200,
                message: 'Successfully fetched nearby places',
                level: 'info',
                metadata: {
                    route: 'locations/nearby-places',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    location,
                    radius,
                    type
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(200).json(result);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: 'Failed to fetch nearby places',
                level: 'error',
                metadata: {
                    route: 'locations/nearby-places',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    error: error.message
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(error.status || 500).json({ error: error.message || 'Failed to get nearby places' });
        }
    }

    /**
     * Get current user location using Google Maps API.
     * @param {Object} req - Express request object with lat, lng in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with current user location.
     */
    static async getCurrentUserLocation(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { lat, lng } = req.body;
            if (!lat || !lng) {
                logRequest({
                    req,
                    res: { error: 'Latitude and longitude are required' },
                    status: 400,
                    message: 'Failed to get current user location: Missing coordinates',
                    level: 'warn',
                    metadata: {
                        route: 'locations/current-location',
                        method: req.method,
                        url: req.originalUrl,
                        ip: req.ip,
                        traceId: req.traceId,
                        userId: actorID,
                        error: 'Latitude and longitude are required'
                    },
                    service: 'location',
                    defaultRoute: 'locations',
                });

                return res.status(400).json({ error: 'Latitude and longitude are required' });
            }

            const result = await GoogleMapsService.getCurrentUserLocation(actorID, { lat: parseFloat(lat), lng: parseFloat(lng) });

            logRequest({
                req,
                res: result,
                status: 200,
                message: 'Successfully fetched current user location',
                level: 'info',
                metadata: {
                    route: 'locations/current-location',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    lat,
                    lng
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(200).json(result);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: 'Failed to get current user location',
                level: 'error',
                metadata: {
                    route: 'locations/current-location',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    error: error.message
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(error.status || 500).json({ error: error.message || 'Failed to get current user location' });
        }
    }

    /**
     * Get specific user location using Google Maps API.
     * @param {Object} req - Express request object with userId in params.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with specific user location.
     */
    static async getSpecificUserLocation(req, res) {
        const actorID = req.user?.userID || 'unknown';
        try {
            const { userId } = req.params;
            if (!userId) {
                logRequest({
                    req,
                    res: { error: 'User ID is required' },
                    status: 400,
                    message: 'Failed to get specific user location: Missing userId',
                    level: 'warn',
                    metadata: {
                        route: 'locations/user-location',
                        method: req.method,
                        url: req.originalUrl,
                        ip: req.ip,
                        traceId: req.traceId,
                        userId: actorID,
                        error: 'User ID is required'
                    },
                    service: 'location',
                    defaultRoute: 'locations',
                });

                return res.status(400).json({ error: 'User ID is required' });
            }

            const result = await GoogleMapsService.getSpecificUserLocation(userId);

            logRequest({
                req,
                res: result,
                status: 200,
                message: 'Successfully fetched specific user location',
                level: 'info',
                metadata: {
                    route: 'locations/user-location',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    result
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(200).json(result);
        } catch (error) {
            logRequest({
                req,
                error,
                status: error.status || 500,
                message: 'Failed to get specific user location',
                level: 'error',
                metadata: {
                    route: 'locations/user-location',
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    traceId: req.traceId,
                    userId: actorID,
                    error: error.message
                },
                service: 'location',
                defaultRoute: 'locations',
            });

            return res.status(error.status || 500).json({ error: error.message || 'Failed to get specific user location' });
        }
    }
}

module.exports = LocationController;