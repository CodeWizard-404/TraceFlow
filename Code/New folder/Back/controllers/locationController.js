const LocationService = require('../services/locationsService');
const logger = require('../utils/logger');

/**
 * Controller for managing location-related operations.
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
     * Get Regions by user.
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
     * Get Governorates by user.
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
     * Get Delegations by user.
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
}

module.exports = LocationController;