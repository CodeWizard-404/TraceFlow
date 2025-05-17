const { User, Role, Region, Governorate, Delegation } = require('../models');

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


    static async getLocationById(id) {
        const validation = this.validateInput({ ids: [id] });
        if (!validation.isValid) {
            return { success: false, message: validation.errors.join(' ') };
        }

        try {
            // If ID is Delegation
            const delegation = await Delegation.findOne({
                where: { delegationID: id },
                attributes: ['delegationID', 'name'],
                include: [{
                    model: Governorate,
                    attributes: ['governorateID', 'name'],
                    include: [{
                        model: Region,
                        attributes: ['regionID', 'name']
                    }]
                }]
            });

            if (delegation) {
                const regionName = delegation.Governorate?.Region?.name || '-';
                const governorateName = delegation.Governorate?.name || '-';
                const delegationName = delegation.name;
                return {
                    success: true,
                    address: `Address: ${regionName}, ${governorateName}, ${delegationName}`,
                    idInfo: `ID: Delegation : ${delegationName}`
                };
            }

            // If ID is Governorate
            const governorate = await Governorate.findOne({
                where: { governorateID: id },
                attributes: ['governorateID', 'name'],
                include: [{
                    model: Region,
                    attributes: ['regionID', 'name']
                }],
            });

            if (governorate) {
                const regionName = governorate.Region?.name || '-';
                const governorateName = governorate.name;

                // Get one delegation under this governorate to complete the full address
                const delegation = await Delegation.findOne({
                    where: { governorateID: governorate.governorateID },
                    attributes: ['name']
                });

                const delegationName = delegation?.name || '-';

                return {
                    success: true,
                    address: `Address: ${regionName}, ${governorateName}, ${delegationName}`,
                    idInfo: `ID: Governorate : ${governorateName}`
                };
            }

            // If ID is Region
            const region = await Region.findOne({
                where: { regionID: id },
                attributes: ['regionID', 'name']
            });

            if (region) {
                // Get one governorate and delegation under this region
                const governorate = await Governorate.findOne({
                    where: { regionID: region.regionID },
                    attributes: ['governorateID', 'name']
                });

                const governorateName = governorate?.name || '-';

                let delegationName = '-';
                if (governorate) {
                    const delegation = await Delegation.findOne({
                        where: { governorateID: governorate.governorateID },
                        attributes: ['name']
                    });
                    delegationName = delegation?.name || '-';
                }

                return {
                    success: true,
                    address: `Address: ${region.name}, ${governorateName}, ${delegationName}`,
                    idInfo: `ID: Region : ${region.name}`
                };
            }

            return { success: false, message: 'Location not found.' };

        } catch (error) {
            console.error(error);
            return { success: false, message: 'Error fetching location.' };
        }
    }


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
            return [];
        }

        try {
            const governorate = await Governorate.findByPk(governorateID, {
                include: [{ model: Region, attributes: ['regionID', 'name', 'nameAr', 'nameFr'] }],
            });
            return governorate?.Region ? [governorate.Region] : [];
        } catch (error) {
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
            return [];
        }

        try {
            const delegation = await Delegation.findByPk(delegationID, {
                include: [{ model: Governorate, attributes: ['governorateID', 'name', 'nameAr', 'nameFr'] }],
            });
            return delegation?.Governorate ? [delegation.Governorate] : [];
        } catch (error) {
            return [];
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
            return [];
        }
    }
}

module.exports = LocationService;