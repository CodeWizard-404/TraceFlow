const GoogleMapsService = require('../services/googleMapsService');
const LocationService = require('../services/locationsService');
const logger = require('../utils/logger');

/**
 * Controller for managing location-related operations, including Google Maps APIs.
 */
class LocationController {
    /**
     * Get all regions.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with all regions.
     */
    static async getAllRegions(req, res) {
        try {
            const regions = await LocationService.getAllRegions();
            logger.info(`Fetched all regions by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(regions);
        } catch (error) {
            logger.error(`Get all regions error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const governorates = await LocationService.getAllGovernorates();
            logger.info(`Fetched all governorates by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(governorates);
        } catch (error) {
            logger.error(`Get all governorates error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const delegations = await LocationService.getAllDelegations();
            logger.info(`Fetched all delegations by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(delegations);
        } catch (error) {
            logger.error(`Get all delegations error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { governorateID } = req.query;
            if (!governorateID) {
                logger.warn(`Missing governorateID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(200).json([]);
            }
            const delegations = await LocationService.getDelegationsByGovernorate(governorateID);
            logger.info(`Fetched delegations for governorate ${governorateID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(delegations);
        } catch (error) {
            logger.error(`Get delegations by governorate error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { regionID } = req.query;
            if (!regionID) {
                logger.warn(`Missing regionID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(200).json([]);
            }
            const governorates = await LocationService.getGovernorateByRegion(regionID);
            logger.info(`Fetched governorates for region ${regionID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(governorates);
        } catch (error) {
            logger.error(`Get governorates by region error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { governorateID } = req.query;
            if (!governorateID) {
                logger.warn(`Missing governorateID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(200).json([]);
            }
            const regions = await LocationService.getRegionsByGovernorate(governorateID);
            logger.info(`Fetched regions for governorate ${governorateID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(regions);
        } catch (error) {
            logger.error(`Get regions by governorate error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { delegationID } = req.query;
            if (!delegationID) {
                logger.warn(`Missing delegationID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(200).json([]);
            }
            const governorates = await LocationService.getGovernoratesByDelegation(delegationID);
            logger.info(`Fetched governorates for delegation ${delegationID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(governorates);
        } catch (error) {
            logger.error(`Get governorates by delegation error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get regions by user.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with regions.
     */
    static async getRegionsByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Missing userID, IP: ${req.ip}`);
                return res.status(200).json([]);
            }
            const regions = await LocationService.getRegionsByUser(userID);
            logger.info(`Fetched regions for user ${userID}, IP: ${req.ip}`);
            return res.status(200).json(regions);
        } catch (error) {
            logger.error(`Get regions by user error: ${error.message}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get governorates by user.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with governorates.
     */
    static async getGovernoratesByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Missing userID, IP: ${req.ip}`);
                return res.status(200).json([]);
            }
            const governorates = await LocationService.getGovernoratesByUser(userID);
            logger.info(`Fetched governorates for user ${userID}, IP: ${req.ip}`);
            return res.status(200).json(governorates);
        } catch (error) {
            logger.error(`Get governorates by user error: ${error.message}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get delegations by user.
     * @param {Object} req - Express request object.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with delegations.
     */
    static async getDelegationsByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Missing userID, IP: ${req.ip}`);
                return res.status(200).json([]);
            }
            const delegations = await LocationService.getDelegationsByUser(userID);
            logger.info(`Fetched delegations for user ${userID}, IP: ${req.ip}`);
            return res.status(200).json(delegations);
        } catch (error) {
            logger.error(`Get delegations by user error: ${error.message}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Geocode an address using Google Maps API.
     * @param {Object} req - Express request object with address in body.
     * @param {Object} res - Express response object.
     * @returns {Promise<void>} JSON response with geocoded location.
     */
    static async geocodeAddress(req, res) {
        try {
            const { address } = req.body;
            if (!address) {
                logger.warn(`Missing address for geocoding, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Address is required' });
            }
            const result = await GoogleMapsService.geocodeAddress(address);
            logger.info(`Geocoded address ${address} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Geocode address error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { origin, destination, mode } = req.body;
            if (!origin || !destination) {
                logger.warn(`Missing origin or destination for directions, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Origin and destination are required' });
            }
            const result = await GoogleMapsService.getDirections(origin, destination, mode);
            logger.info(`Fetched directions from ${origin} to ${destination} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Get directions error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { query, location, radius } = req.body;
            if (!query) {
                logger.warn(`Missing query for place search, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Query is required' });
            }
            const result = await GoogleMapsService.searchPlaces(query, location, radius);
            logger.info(`Searched places for query ${query} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Search places error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
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
        try {
            const { origins, destinations, mode } = req.body;
            if (!origins || !destinations) {
                logger.warn(`Missing origins or destinations for distance matrix, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Origins and destinations are required' });
            }
            const result = await GoogleMapsService.getDistanceMatrix(origins, destinations, mode);
            logger.info(`Fetched distance matrix by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Get distance matrix error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to get distance matrix' });
        }
    }
}

module.exports = LocationController;