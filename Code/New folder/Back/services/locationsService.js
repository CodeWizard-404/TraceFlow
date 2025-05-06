const { User, Role, Region, Governorate, Delegation } = require('../models');
const logger = require('../utils/logger');

// Centralized error messages
const ERROR_MESSAGES = {
    MISSING_FIELDS: 'Missing required fields.',
    USER_NOT_FOUND: 'User not found.',
    REGION_NOT_FOUND: 'One or more regions not found.',
    INVALID_REGION_ASSIGNMENT: 'Invalid region assignment.',
    GOVERNORATE_NOT_FOUND: 'One or more governorates not found.',
    INVALID_GOVERNORATE_ASSIGNMENT: 'Invalid governorate assignment.',
    DELEGATION_NOT_FOUND: 'One or more delegations not found.',
    INVALID_DELEGATION_ASSIGNMENT: 'Invalid delegation assignment.',
    DB_UPDATE_FAILED: 'Database update failed.',
    REGION_NOT_ASSIGNED: 'Governorate or Delegation not in assigned Regions.',
    INVALID_ROLE_ASSIGNMENT: 'User does not have the required role.',
};

class LocationService {
    /**
     * Validate input data for location-related operations.
     * @param {Object} data - Input data to validate.
     * @returns {Object} - Validation result with errors array
     */
    static validateInput({ userID, ids }) {
        const errors = [];

        if (userID !== undefined && !userID) {
            errors.push('Invalid user ID.');
        }

        if (ids !== undefined && (!Array.isArray(ids) || ids.some(id => !id))) {
            errors.push('IDs must be a valid array of non-empty values.');
        }

        return { isValid: errors.length === 0, errors };
    }

    /**
     * Get all regions.
     * @returns {Promise<Array>} List of all regions.
     */
    static async getAllRegions() {
        try {
            const regions = await Region.findAll({
                attributes: ['regionID', 'name', 'nameAr', 'nameFr'],
            });
            return regions || [];
        } catch (error) {
            logger.error(`Get all regions error: ${error.message}`);
            return [];
        }
    }

    /**
     * Get all governorates.
     * @returns {Promise<Array>} List of all governorates.
     */
    static async getAllGovernorates() {
        try {
            const governorates = await Governorate.findAll({
                attributes: ['governorateID', 'name', 'nameAr', 'nameFr', 'regionID'],
                include: [{ model: Region, attributes: ['regionID', 'name'] }],
            });
            return governorates || [];
        } catch (error) {
            logger.error(`Get all governorates error: ${error.message}`);
            return [];
        }
    }

    /**
     * Get all delegations.
     * @returns {Promise<Array>} List of all delegations.
     */
    static async getAllDelegations() {
        try {
            const delegations = await Delegation.findAll({
                attributes: ['delegationID', 'name', 'nameAr', 'nameFr'],
                include: [{ model: Governorate, attributes: ['governorateID', 'name'] }],
            });
            return delegations || [];
        } catch (error) {
            logger.error(`Get all delegations error: ${error.message}`);
            return [];
        }
    }

    /**
     * Get delegations by governorate.
     * @param {string} governorateID - Governorate ID.
     * @returns {Promise<Array>} List of delegations.
     */
    static async getDelegationsByGovernorate(governorateID) {
        const validation = this.validateInput({ ids: [governorateID] });
        if (!validation.isValid) {
            logger.warn(`Invalid governorateID: ${governorateID}`);
            return [];
        }

        try {
            const governorate = await Governorate.findByPk(governorateID);
            if (!governorate) {
                return [];
            }

            const delegations = await Delegation.findAll({
                where: { governorateID },
                attributes: ['delegationID', 'name', 'nameAr', 'nameFr'],
            });
            return delegations || [];
        } catch (error) {
            logger.error(`Get delegations by governorate error: ${error.message}`);
            return [];
        }
    }

    /**
     * Get governorate by region.
     * @param {string} regionID - Region ID.
     * @returns {Promise<Array>} List of governorates.
     */
    static async getGovernorateByRegion(regionID) {
        const validation = this.validateInput({ ids: [regionID] });
        if (!validation.isValid) {
            logger.warn(`Invalid regionID: ${regionID}`);
            return [];
        }

        try {
            const region = await Region.findByPk(regionID);
            if (!region) {
                return [];
            }

            const governorates = await Governorate.findAll({
                where: { regionID },
                attributes: ['governorateID', 'name', 'nameAr', 'nameFr'],
            });
            return governorates || [];
        } catch (error) {
            logger.error(`Get governorates by region error: ${error.message}`);
            return [];
        }
    }

    /**
     * Get regions by governorate.
     * @param {string} governorateID - Governorate ID.
     * @returns {Promise<Array>} List containing the region.
     */
    static async getRegionsByGovernorate(governorateID) {
        const validation = this.validateInput({ ids: [governorateID] });
        if (!validation.isValid) {
            logger.warn(`Invalid governorateID: ${governorateID}`);
            return [];
        }

        try {
            const governorate = await Governorate.findByPk(governorateID, {
                include: [{ model: Region, attributes: ['regionID', 'name', 'nameAr', 'nameFr'] }],
            });
            return governorate?.Region ? [governorate.Region] : [];
        } catch (error) {
            logger.error(`Get regions by governorate error: ${error.message}`);
            return [];
        }
    }

    /**
     * Get governorates by delegation.
     * @param {string} delegationID - Delegation ID.
     * @returns {Promise<Array>} List containing the governorate.
     */
    static async getGovernoratesByDelegation(delegationID) {
        const validation = this.validateInput({ ids: [delegationID] });
        if (!validation.isValid) {
            logger.warn(`Invalid delegationID: ${delegationID}`);
            return [];
        }

        try {
            const delegation = await Delegation.findByPk(delegationID, {
                include: [{ model: Governorate, attributes: ['governorateID', 'name', 'nameAr', 'nameFr'] }],
            });
            return delegation?.Governorate ? [delegation.Governorate] : [];
        } catch (error) {
            logger.error(`Get governorates by delegation error: ${error.message}`);
            return [];
        }
    }

    /**
     * Assign regions to a regional manager.
     * @param {string} regionalManagerID - Regional Manager ID.
     * @param {string[]} regionIDs - Array of Region IDs.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Assignment details.
     */
    static async assignRegionsToRegionalManager(regionalManagerID, regionIDs, actorID) {
        const validation = this.validateInput({ userID: regionalManagerID, ids: regionIDs });
        if (!validation.isValid || !regionalManagerID || !regionIDs) {
            return { success: false, message: ERROR_MESSAGES.MISSING_FIELDS, errors: validation.errors };
        }

        try {
            const regionalManager = await User.findByPk(regionalManagerID, {
                include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
            });
            if (!regionalManager) {
                return { success: false, message: ERROR_MESSAGES.USER_NOT_FOUND };
            }
            if (!regionalManager.Roles.some(role => role.name === process.env.ROLE_REGIONAL_MANAGER)) {
                return { success: false, message: ERROR_MESSAGES.INVALID_ROLE_ASSIGNMENT };
            }

            const regions = await Region.findAll({ where: { regionID: regionIDs } });
            if (regions.length !== regionIDs.length) {
                return { success: false, message: ERROR_MESSAGES.REGION_NOT_FOUND };
            }

            await regionalManager.setRegions(regions);
            return {
                success: true,
                regionalManagerID,
                regionIDs,
                message: 'Regions assigned successfully.',
            };
        } catch (error) {
            logger.error(`Assign regions error: ${error.message}, user: ${actorID}`);
            return { success: false, message: ERROR_MESSAGES.DB_UPDATE_FAILED };
        }
    }

    /**
     * Revoke regions from a regional manager.
     * @param {string} regionalManagerID - Regional Manager ID.
     * @param {string[]} regionIDs - Array of Region IDs.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Revocation details.
     */
    static async revokeRegionsFromRegionalManager(regionalManagerID, regionIDs, actorID) {
        const validation = this.validateInput({ userID: regionalManagerID, ids: regionIDs });
        if (!validation.isValid || !regionalManagerID || !regionIDs) {
            return { success: false, message: ERROR_MESSAGES.MISSING_FIELDS, errors: validation.errors };
        }

        try {
            const regionalManager = await User.findByPk(regionalManagerID);
            if (!regionalManager) {
                return { success: false, message: ERROR_MESSAGES.USER_NOT_FOUND };
            }

            const regions = await Region.findAll({ where: { regionID: regionIDs } });
            if (regions.length !== regionIDs.length) {
                return { success: false, message: ERROR_MESSAGES.REGION_NOT_FOUND };
            }

            await regionalManager.removeRegions(regions);
            return {
                success: true,
                regionalManagerID,
                regionIDs,
                message: 'Regions revoked successfully.',
            };
        } catch (error) {
            logger.error(`Revoke regions error: ${error.message}, user: ${actorID}`);
            return { success: false, message: ERROR_MESSAGES.DB_UPDATE_FAILED };
        }
    }

    /**
     * Assign governorates to a supervisor.
     * @param {string} supervisorID - Supervisor ID.
     * @param {string[]} governorateIDs - Array of Governorate IDs.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Assignment details.
     */
    static async assignGovernoratesToSupervisor(supervisorID, governorateIDs, actorID) {
        const validation = this.validateInput({ userID: supervisorID, ids: governorateIDs });
        if (!validation.isValid || !supervisorID || !governorateIDs) {
            return { success: false, message: ERROR_MESSAGES.MISSING_FIELDS, errors: validation.errors };
        }

        try {
            const supervisor = await User.findByPk(supervisorID, {
                include: [
                    { model: Role, through: { attributes: [] }, attributes: ['name'] },
                    { model: User, as: 'RegionalManager', include: [{ model: Region }] },
                ],
            });
            if (!supervisor) {
                return { success: false, message: ERROR_MESSAGES.USER_NOT_FOUND };
            }
            if (!supervisor.Roles.some(role => role.name === process.env.ROLE_SUPERVISOR)) {
                return { success: false, message: ERROR_MESSAGES.INVALID_ROLE_ASSIGNMENT };
            }

            const governorates = await Governorate.findAll({
                where: { governorateID: governorateIDs },
                include: [{ model: Region }],
            });
            if (governorates.length !== governorateIDs.length) {
                return { success: false, message: ERROR_MESSAGES.GOVERNORATE_NOT_FOUND };
            }

            if (supervisor.RegionalManager) {
                const assignedRegions = supervisor.RegionalManager.Regions.map(region => region.regionID);
                const invalidGovernorates = governorates.filter(gov => !assignedRegions.includes(gov.regionID));
                if (invalidGovernorates.length > 0) {
                    return { success: false, message: ERROR_MESSAGES.REGION_NOT_ASSIGNED };
                }
            }

            await supervisor.setGovernorates(governorates);
            return {
                success: true,
                supervisorID,
                governorateIDs,
                message: 'Governorates assigned successfully.',
            };
        } catch (error) {
            logger.error(`Assign governorates error: ${error.message}, user: ${actorID}`);
            return { success: false, message: ERROR_MESSAGES.DB_UPDATE_FAILED };
        }
    }

    /**
     * Revoke governorates from a supervisor.
     * @param {string} supervisorID - Supervisor ID.
     * @param {string[]} governorateIDs - Array of Governorate IDs.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Revocation details.
     */
    static async revokeGovernoratesFromSupervisor(supervisorID, governorateIDs, actorID) {
        const validation = this.validateInput({ userID: supervisorID, ids: governorateIDs });
        if (!validation.isValid || !supervisorID || !governorateIDs) {
            return { success: false, message: ERROR_MESSAGES.MISSING_FIELDS, errors: validation.errors };
        }

        try {
            const supervisor = await User.findByPk(supervisorID);
            if (!supervisor) {
                return { success: false, message: ERROR_MESSAGES.USER_NOT_FOUND };
            }

            const governorates = await Governorate.findAll({ where: { governorateID: governorateIDs } });
            if (governorates.length !== governorateIDs.length) {
                return { success: false, message: ERROR_MESSAGES.GOVERNORATE_NOT_FOUND };
            }

            await supervisor.removeGovernorates(governorates);
            return {
                success: true,
                supervisorID,
                governorateIDs,
                message: 'Governorates revoked successfully.',
            };
        } catch (error) {
            logger.error(`Revoke governorates error: ${error.message}, user: ${actorID}`);
            return { success: false, message: ERROR_MESSAGES.DB_UPDATE_FAILED };
        }
    }

    /**
     * Assign delegations to a supervisor.
     * @param {string} supervisorID - Supervisor ID.
     * @param {string[]} delegationIDs - Array of Delegation IDs.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Assignment details.
     */
    static async assignDelegationsToSupervisor(supervisorID, delegationIDs, actorID) {
        const validation = this.validateInput({ userID: supervisorID, ids: delegationIDs });
        if (!validation.isValid || !supervisorID || !delegationIDs) {
            return { success: false, message: ERROR_MESSAGES.MISSING_FIELDS, errors: validation.errors };
        }

        try {
            const supervisor = await User.findByPk(supervisorID, {
                include: [
                    { model: Role, through: { attributes: [] }, attributes: ['name'] },
                    { model: User, as: 'RegionalManager', include: [{ model: Region }] },
                    { model: Governorate },
                ],
            });
            if (!supervisor) {
                return { success: false, message: ERROR_MESSAGES.USER_NOT_FOUND };
            }
            if (!supervisor.Roles.some(role => role.name === process.env.ROLE_SUPERVISOR)) {
                return { success: false, message: ERROR_MESSAGES.INVALID_ROLE_ASSIGNMENT };
            }

            const delegations = await Delegation.findAll({
                where: { delegationID: delegationIDs },
                include: [{ model: Governorate, include: [{ model: Region }] }],
            });
            if (delegations.length !== delegationIDs.length) {
                return { success: false, message: ERROR_MESSAGES.DELEGATION_NOT_FOUND };
            }

            const assignedGovernorates = supervisor.Governorates.map(gov => gov.governorateID);
            const invalidDelegations = delegations.filter(del => !assignedGovernorates.includes(del.governorateID));
            if (invalidDelegations.length > 0) {
                return { success: false, message: ERROR_MESSAGES.INVALID_DELEGATION_ASSIGNMENT };
            }

            if (supervisor.RegionalManager) {
                const assignedRegions = supervisor.RegionalManager.Regions.map(region => region.regionID);
                const invalidDelegations = delegations.filter(
                    del => !assignedRegions.includes(del.Governorate.regionID)
                );
                if (invalidDelegations.length > 0) {
                    return { success: false, message: ERROR_MESSAGES.REGION_NOT_ASSIGNED };
                }
            }

            await supervisor.setDelegations(delegations);
            return {
                success: true,
                supervisorID,
                delegationIDs,
                message: 'Delegations assigned successfully.',
            };
        } catch (error) {
            logger.error(`Assign delegations error: ${error.message}, user: ${actorID}`);
            return { success: false, message: ERROR_MESSAGES.DB_UPDATE_FAILED };
        }
    }

    /**
     * Revoke delegations from a supervisor.
     * @param {string} supervisorID - Supervisor ID.
     * @param {string[]} delegationIDs - Array of Delegation IDs.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Revocation details.
     */
    static async revokeDelegationsFromSupervisor(supervisorID, delegationIDs, actorID) {
        const validation = this.validateInput({ userID: supervisorID, ids: delegationIDs });
        if (!validation.isValid || !supervisorID || !delegationIDs) {
            return { success: false, message: ERROR_MESSAGES.MISSING_FIELDS, errors: validation.errors };
        }

        try {
            const supervisor = await User.findByPk(supervisorID);
            if (!supervisor) {
                return { success: false, message: ERROR_MESSAGES.USER_NOT_FOUND };
            }

            const delegations = await Delegation.findAll({ where: { delegationID: delegationIDs } });
            if (delegations.length !== delegationIDs.length) {
                return { success: false, message: ERROR_MESSAGES.DELEGATION_NOT_FOUND };
            }

            await supervisor.removeDelegations(delegations);
            return {
                success: true,
                supervisorID,
                delegationIDs,
                message: 'Delegations revoked successfully.',
            };
        } catch (error) {
            logger.error(`Revoke delegations error: ${error.message}, user: ${actorID}`);
            return { success: false, message: ERROR_MESSAGES.DB_UPDATE_FAILED };
        }
    }

    /**
     * Get Regions by userID.
     * @param {string} userID - User ID.
     * @returns {Promise<Array>} List of Regions.
     */
    static async getRegionsByUser(userID) {
        try {
            const user = await User.findByPk(userID, {
                include: [{ model: Region }],
            });
            return user?.Regions || [];
        } catch (error) {
            logger.error(`Get regions by user error: ${error.message}`);
            return [];
        }
    }

    /**
     * Get Governorates by userID.
     * @param {string} userID - User ID.
     * @returns {Promise<Array>} List of Governorates.
     */
    static async getGovernoratesByUser(userID) {
        try {
            const user = await User.findByPk(userID, {
                include: [{ model: Governorate }],
            });
            return user?.Governorates || [];
        } catch (error) {
            logger.error(`Get governorates by user error: ${error.message}`);
            return [];
        }
    }

    /**
     * Get Delegations by userID.
     * @param {string} userID - User ID.
     * @returns {Promise<Array>} List of Delegations.
     */
    static async getDelegationsByUser(userID) {
        try {
            const user = await User.findByPk(userID, {
                include: [{ model: Delegation }],
            });
            return user?.Delegations || [];
        } catch (error) {
            logger.error(`Get delegations by user error: ${error.message}`);
            return [];
        }
    }
}

module.exports = LocationService;