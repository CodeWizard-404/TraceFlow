const axios = require('axios');
const { User, Role, Region, Governorate, Delegation, Agent } = require('../models');
const { Op } = require('sequelize');
require('dotenv').config();
const { nanoid } = require('nanoid');

// Keycloak configuration
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';

// Centralized error messages
const ERROR_MESSAGES = {
    MISSING_FIELDS: 'Please fill in all required fields.',
    INVALID_EMAIL: 'Please enter a valid email address.',
    INVALID_PHONE: 'Phone number must be 8–12 digits.',
    INVALID_PASSWORD: 'Password must be at least 6 characters.',
    INVALID_NAME: 'Names must be 2–50 characters and contain only letters.',
    INVALID_ID: 'Invalid user ID.',
    INVALID_REGION_ID: 'Invalid region ID.',
    INVALID_GOVERNORATE_ID: 'Invalid governorate ID.',
    INVALID_DELEGATION_ID: 'Invalid delegation ID.',
    INVALID_AGENT_ID: 'Invalid agent ID.',
    DUPLICATE_EMAIL: 'This email is already in use.',
    DUPLICATE_PHONE: 'This phone number is already in use.',
    USER_NOT_FOUND: 'User not found.',
    ROLE_NOT_FOUND: 'Role not found.',
    REGION_NOT_FOUND: 'Region not found.',
    GOVERNORATE_NOT_FOUND: 'Governorate not found.',
    DELEGATION_NOT_FOUND: 'Delegation not found.',
    AGENT_NOT_FOUND: 'Agent not found.',
    NO_USERS_FOUND: 'No users found.',
    NO_SUPERVISORS_FOUND: 'No supervisors found.',
    NO_REGIONAL_MANAGERS_FOUND: 'No regional managers found.',
    NO_DIRECTOR_FOUND: 'No director found.',
    AUTH_SERVICE_DOWN: 'Unable to connect to authentication service.',
    KEYCLOAK_CREATE_FAILED: 'Unable to create user account.',
    KEYCLOAK_UPDATE_FAILED: 'Unable to update user account.',
    KEYCLOAK_DELETE_FAILED: 'Unable to delete user account.',
    KEYCLOAK_PASSWORD_FAILED: 'Unable to update password.',
    DB_CREATE_FAILED: 'Unable to save user to database.',
    DB_UPDATE_FAILED: 'Unable to update user in database.',
    DB_DELETE_FAILED: 'Unable to delete user from database.',
    INVALID_IMAGE: 'Please upload a valid image.',
    USER_NOT_AUTHENTICATED: 'Please log in to continue.',
    USER_NOT_SYNCED: 'User account is not properly set up.',
    INVALID_ROLE: 'Please provide a valid role.',
    INVALID_IDS: 'IDs must be a valid array.',
    INVALID_GOOGLE_EMAIL: 'Please enter a valid Google email address.',
    GOOGLE_EMAIL_ALREADY_LINKED: 'This Google email is already linked to another user.',
    INVALID_ROLE_ASSIGNMENT: 'User does not have the required role.',
    REGION_NOT_ASSIGNED: 'Governorate or Delegation not in assigned Regions.',
    CASCADE_CONFIRMATION_REQUIRED: 'Confirmation required for cascading revocation.',
    CASCADE_CONFIRMATION_GOVERNORATES: 'Confirmation required for revoking associated governorates.',
    CASCADE_CONFIRMATION_DELEGATIONS: 'Confirmation required for revoking associated delegations.',
    CASCADE_CONFIRMATION_AGENTS: 'Confirmation required for revoking associated agents.',
};

class UserService {
    /**
     * Get Keycloak admin access token.
     * @returns {Promise<string>} Admin access token.
     * @throws {Error} If token retrieval fails.
     */
    static async getAdminToken() {
        try {
            const response = await axios.post(
                `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: 'password',
                    client_id: 'admin-cli',
                    username: process.env.KEYCLOAK_ADMIN_USER,
                    password: process.env.KEYCLOAK_ADMIN_PASSWORD,
                })
            );
            return response.data.access_token;
        } catch (error) {
            throw new Error(ERROR_MESSAGES.AUTH_SERVICE_DOWN);
        }
    }

    /**
     * Validate input data for user-related operations.
     * @param {Object} data - Input data to validate.
     * @throws {Error} If validation fails.
     */
    static validateInput({ email, phone, password, firstname, lastname, userID, role, ids, googleEmail, regionID, governorateID, delegationID, agentID }) {
        const errors = [];

        if (email !== undefined && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
            errors.push(ERROR_MESSAGES.INVALID_EMAIL);
        }

        if (phone !== undefined && (!phone || !/^\d{8,11}$/.test(phone))) {
            errors.push(ERROR_MESSAGES.INVALID_PHONE);
        }

        if (password !== undefined && (!password || password.length < 6)) {
            errors.push(ERROR_MESSAGES.INVALID_PASSWORD);
        }

        if (firstname !== undefined && (!firstname || !/^[a-zA-Z]{2,50}$/.test(firstname))) {
            errors.push(ERROR_MESSAGES.INVALID_NAME);
        }

        if (lastname !== undefined && (!lastname || !/^[a-zA-Z]{2,50}$/.test(lastname))) {
            errors.push(ERROR_MESSAGES.INVALID_NAME);
        }

        if (userID !== undefined && !userID) {
            errors.push(ERROR_MESSAGES.INVALID_ID);
        }

        if (role !== undefined && (!role || typeof role !== 'string')) {
            errors.push(ERROR_MESSAGES.INVALID_ROLE);
        }

        if (ids !== undefined && (!Array.isArray(ids) || ids.length === 0)) {
            errors.push(ERROR_MESSAGES.INVALID_IDS);
        }

        if (googleEmail !== undefined && (!googleEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(googleEmail))) {
            errors.push(ERROR_MESSAGES.INVALID_GOOGLE_EMAIL);
        }

        if (regionID !== undefined && !regionID) {
            errors.push(ERROR_MESSAGES.INVALID_REGION_ID);
        }

        if (governorateID !== undefined && !governorateID) {
            errors.push(ERROR_MESSAGES.INVALID_GOVERNORATE_ID);
        }

        if (delegationID !== undefined && !delegationID) {
            errors.push(ERROR_MESSAGES.INVALID_DELEGATION_ID);
        }

        if (agentID !== undefined && !agentID) {
            errors.push(ERROR_MESSAGES.INVALID_AGENT_ID);
        }

        if (errors.length > 0) {
            throw new Error(errors.join(' '));
        }
    }

    /**
     * Create a new user.
     * @param {string} email - User's email.
     * @param {string} password - User's password.
     * @param {string} firstname - User's first name.
     * @param {string} lastname - User's last name.
     * @param {string} phone - User's phone number.
     * @returns {Promise<Object>} Created user.
     */
    static async createUser(email, password, firstname, lastname, phone) {
        if (!email || !password || !firstname || !lastname || !phone) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ email, phone, password, firstname, lastname });

        const token = await this.getAdminToken();

        // Check for duplicates in Keycloak
        try {
            const existingUser = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users?username=${encodeURIComponent(email)}&exact=true`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (existingUser.data.length > 0) {
                throw new Error(ERROR_MESSAGES.DUPLICATE_EMAIL);
            }
        } catch (error) {
            if (error.response?.status !== 404) {
                throw new Error(ERROR_MESSAGES.AUTH_SERVICE_DOWN);
            }
        }

        // Create user in Keycloak
        let keycloakUserId;
        try {
            const keycloakResponse = await axios.post(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users`,
                {
                    username: email,
                    email,
                    firstName: firstname,
                    lastName: lastname,
                    enabled: true,
                    credentials: [{ type: 'password', value: password, temporary: false }],
                    attributes: { phone },
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            keycloakUserId = keycloakResponse.headers.location.split('/').pop();
        } catch (error) {
            throw new Error(ERROR_MESSAGES.KEYCLOAK_CREATE_FAILED);
        }



        // Check for duplicates in local DB
        const existingUser = await User.findOne({
            where: { [Op.or]: [{ email }, { phone }] },
        });
        if (existingUser) {
            const errors = [];
            if (existingUser.email === email) errors.push(ERROR_MESSAGES.DUPLICATE_EMAIL);
            if (existingUser.phone === phone) errors.push(ERROR_MESSAGES.DUPLICATE_PHONE);
            await axios.delete(`${KEYCLOAK_URL}/admin/realms/${REALM}/users/${keycloakUserId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            throw new Error(errors.join(' '));
        }

        // Create user in local DB
        try {
            const user = await User.create({
                userID: `usr_${nanoid()}`,
                keycloakId: keycloakUserId,
                email,
                firstname,
                lastname,
                phone,
                password: 'KEYCLOAK_MANAGED',
                googleEmail: null,
            });
            return user;
        } catch (error) {
            await axios.delete(`${KEYCLOAK_URL}/admin/realms/${REALM}/users/${keycloakUserId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            throw new Error(ERROR_MESSAGES.DB_CREATE_FAILED);
        }
    }

    /**
     * Update an existing user.
     * @param {string} userID - User ID.
     * @param {Object} userData - User data to update.
     * @returns {Promise<Object>} Updated user.
     */
    static async updateUser(userID, userData) {
        if (!userID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({
            userID,
            email: userData.email,
            phone: userData.phone,
            password: userData.password,
            firstname: userData.firstname,
            lastname: userData.lastname,
        });

        const user = await User.findByPk(userID);
        if (!user) {
            throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        }
        if (!user.keycloakId) {
            throw new Error(ERROR_MESSAGES.USER_NOT_SYNCED);
        }

        // Check for duplicates in local DB
        if (userData.email || userData.phone) {
            const existingUser = await User.findOne({
                where: {
                    [Op.or]: [
                        userData.email ? { email: userData.email } : null,
                        userData.email ? { googleEmail: userData.email } : null,
                        userData.phone ? { phone: userData.phone } : null,
                    ].filter(Boolean),
                    userID: { [Op.ne]: userID },
                },
            });
            if (existingUser) {
                const errors = [];
                if (userData.email && existingUser.email === userData.email) {
                    errors.push(ERROR_MESSAGES.DUPLICATE_EMAIL);
                }
                if (userData.email && existingUser.googleEmail === userData.email) {
                    errors.push(ERROR_MESSAGES.GOOGLE_EMAIL_ALREADY_LINKED);
                }
                if (userData.phone && existingUser.phone === userData.phone) {
                    errors.push(ERROR_MESSAGES.DUPLICATE_PHONE);
                }
                throw new Error(errors.join(' '));
            }
        }

        const token = await this.getAdminToken();

        // Update Keycloak user
        try {
            const updateData = {
                username: userData.email || user.email,
                email: userData.email || user.email,
                firstName: userData.firstname || user.firstname,
                lastName: userData.lastname || user.lastname,
                attributes: { phone: userData.phone || user.phone },
            };
            await axios.put(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.keycloakId}`,
                updateData,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (userData.email && userData.email !== user.email) {
                await axios.delete(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.keycloakId}/federated-identity/google`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                await axios.post(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.keycloakId}/federated-identity/google`,
                    {
                        identityProvider: 'google',
                        userId: user.keycloakId,
                        userName: userData.email,
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
        } catch (error) {
            throw new Error(ERROR_MESSAGES.KEYCLOAK_UPDATE_FAILED);
        }

        // Update password in Keycloak
        if (userData.password) {
            try {
                await axios.put(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.keycloakId}/reset-password`,
                    { type: 'password', value: userData.password, temporary: false },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            } catch (error) {
                throw new Error(ERROR_MESSAGES.KEYCLOAK_PASSWORD_FAILED);
            }
        }

        // Update local DB
        try {
            await user.update({
                email: userData.email || user.email,
                firstname: userData.firstname || user.firstname,
                lastname: userData.lastname || user.lastname,
                phone: userData.phone || user.phone,
                googleEmail: userData.email || user.googleEmail || user.email,
                PFP: userData.PFP === null ? null : (userData.PFP !== undefined ? userData.PFP : user.PFP),
            });
            return user;
        } catch (error) {
            throw new Error(ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    /**
     * Delete a user.
     * @param {string} userID - User ID.
     * @returns {Promise<Object>} Success message.
     */
    static async deleteUser(userID) {
        if (!userID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID });

        const user = await User.findByPk(userID);
        if (!user) {
            throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        const token = await this.getAdminToken();

        if (user.keycloakId) {
            try {
                await axios.delete(`${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.keycloakId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
            } catch (error) {
                throw new Error(ERROR_MESSAGES.KEYCLOAK_DELETE_FAILED);
            }
        }

        try {
            await user.destroy();
            return { message: 'User deleted successfully.' };
        } catch (error) {
            throw new Error(ERROR_MESSAGES.DB_DELETE_FAILED);
        }
    }

    /**
     * Get all users.
     * @returns {Promise<Array>} List of all users.
     */
    static async getAllUsers() {
        try {
            const users = await User.findAll({
                include: [
                    { model: Role, through: { attributes: [] }, attributes: ['name'] },
                    { model: Region, through: { attributes: [] }, attributes: ['regionID', 'name'] },
                    { model: Governorate, through: { attributes: [] }, attributes: ['governorateID', 'name'] },
                    { model: Delegation, through: { attributes: [] }, attributes: ['delegationID', 'name'] },
                ],
                attributes: ['userID', 'email', 'firstname', 'lastname', 'phone', 'googleEmail', 'regionalManagerID', 'directorID', 'createdAt', 'updatedAt'],
            });
            if (!users.length) {
                return [];
            }
            return users;
        } catch (error) {
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    /**
     * Get a user by phone number.
     * @param {string} phone - User's phone number.
     * @returns {Promise<Object|null>} User data or null if not found.
     */
    static async getUserByPhoneNumber(phone) {
        if (!phone) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ phone });

        try {
            const user = await User.findOne({
                where: { phone },
                include: [
                    { model: Role, through: { attributes: [] }, attributes: ['name'] },
                    { model: Region, through: { attributes: [] }, attributes: ['regionID', 'name'] },
                    { model: Governorate, through: { attributes: [] }, attributes: ['governorateID', 'name'] },
                    { model: Delegation, through: { attributes: [] }, attributes: ['delegationID', 'name'] },
                ],
            });
            if (!user) {
                return null;
            }
            return user;
        } catch (error) {
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    /**
     * Get a user by ID.
     * @param {string} userID - User ID.
     * @returns {Promise<Object|null>} User data or null if not found.
     */
    static async getUserById(userID) {
        if (!userID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID });

        try {
            let user = await User.findByPk(userID, {
                include: [
                    { model: Role, through: { attributes: [] }, attributes: ['name'] },
                    { model: Region, through: { attributes: [] }, attributes: ['regionID', 'name'] },
                    { model: Governorate, through: { attributes: [] }, attributes: ['governorateID', 'name'] },
                    { model: Delegation, through: { attributes: [] }, attributes: ['delegationID', 'name'] },
                    { model: User, as: 'RegionalManager', attributes: ['userID', 'firstname', 'lastname', 'email'] },
                    { model: User, as: 'Director', attributes: ['userID', 'firstname', 'lastname', 'email'] },
                    { model: Agent, as: 'Agents', attributes: ['agentID', 'name', 'lastname', 'email'] },
                ],
            });

            if (!user) {
                user = await User.findOne({
                    where: { keycloakId: userID },
                    include: [
                        { model: Role, through: { attributes: [] }, attributes: ['name'] },
                        { model: Region, through: { attributes: [] }, attributes: ['regionID', 'name'] },
                        { model: Governorate, through: { attributes: [] }, attributes: ['governorateID', 'name'] },
                        { model: Delegation, through: { attributes: [] }, attributes: ['delegationID', 'name'] },
                        { model: User, as: 'RegionalManager', attributes: ['userID', 'firstname', 'lastname', 'email'] },
                        { model: User, as: 'Director', attributes: ['userID', 'firstname', 'lastname', 'email'] },
                        { model: Agent, as: 'Agents', attributes: ['agentID', 'name', 'lastname', 'email'] },
                    ],
                });
            }

            if (!user) {
                return null;
            }

            return user;
        } catch (error) {
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    /**
     * Get users by role.
     * @param {string} roleName - Role name.
     * @returns {Promise<Array>} List of users with the specified role.
     */
    static async getUsersByRole(roleName) {
        if (!roleName) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ role: roleName });

        try {
            const role = await Role.findOne({ where: { name: roleName } });
            if (!role) {
                return [];
            }
            const users = await User.findAll({
                include: [
                    {
                        model: Role,
                        through: { attributes: [] },
                        where: { roleID: role.roleID },
                        attributes: [],
                    },
                    { model: Region, through: { attributes: [] }, attributes: ['regionID', 'name'] },
                    { model: Governorate, through: { attributes: [] }, attributes: ['governorateID', 'name'] },
                    { model: Delegation, through: { attributes: [] }, attributes: ['delegationID', 'name'] },
                ],
            });
            if (!users.length) {
                return [];
            }
            return users;
        } catch (error) {
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }






















    /**
     * Get supervisors assigned to a user.
     * @param {string} userID - User ID.
     * @returns {Promise<Array>} List of supervisors.
     */
    static async getSupervisorsByUser(userID) {
        if (!userID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID });

        try {
            const user = await User.findByPk(userID, {
                include: [
                    {
                        model: User,
                        as: 'Supervisors',
                        attributes: ['userID', 'firstname', 'lastname', 'email', 'phone'],
                        include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
                    },
                ],
            });
            if (!user) {
                return [];
            }
            return user.Supervisors || [];
        } catch (error) {
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    /**
     * Get regional managers assigned to a user.
     * @param {string} userID - User ID.
     * @returns {Promise<Array>} List of regional managers.
     */
    static async getRegionalManagersByUser(userID) {
        if (!userID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID });

        try {
            const user = await User.findByPk(userID, {
                include: [
                    {
                        model: User,
                        as: 'RegionalManager',
                        attributes: ['userID', 'firstname', 'lastname', 'email', 'phone'],
                        include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
                    },
                ],
            });
            if (!user) {
                return [];
            }
            return user.RegionalManager ? [user.RegionalManager] : [];
        } catch (error) {
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    /**
     * Get director assigned to a user.
     * @param {string} userID - User ID.
     * @returns {Promise<Array>} List containing the director.
     */
    static async getDirectorByUser(userID) {
        if (!userID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID });

        try {
            const user = await User.findByPk(userID, {
                include: [
                    {
                        model: User,
                        as: 'Director',
                        attributes: ['userID', 'firstname', 'lastname', 'email', 'phone'],
                        include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
                    },
                ],
            });
            if (!user) {
                return [];
            }
            return user.Director ? [user.Director] : [];
        } catch (error) {
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }





    /**
     * Get users by region.
     * @param {string} regionID - Region ID.
     * @returns {Promise<Array>} List of users.
     */
    static async getUsersByRegion(regionID) {
        if (!regionID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ regionID });

        try {
            const region = await Region.findByPk(regionID);
            if (!region) {
                return [];
            }
            const users = await User.findAll({
                include: [
                    {
                        model: Region,
                        through: { attributes: [] },
                        where: { regionID },
                        attributes: [],
                    },
                    { model: Role, through: { attributes: [] }, attributes: ['name'] },
                ],
            });
            if (!users.length) {
                return [];
            }
            return users;
        } catch (error) {
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    /**
     * Get users by governorate.
     * @param {string} governorateID - Governorate ID.
     * @returns {Promise<Array>} List of users.
     */
    static async getUsersByGovernorate(governorateID) {
        if (!governorateID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ governorateID });

        try {
            const governorate = await Governorate.findByPk(governorateID);
            if (!governorate) {
                return [];
            }
            const users = await User.findAll({
                include: [
                    {
                        model: Governorate,
                        through: { attributes: [] },
                        where: { governorateID },
                        attributes: [],
                    },
                    { model: Role, through: { attributes: [] }, attributes: ['name'] },
                ],
            });
            if (!users.length) {
                return [];
            }
            return users;
        } catch (error) {
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    /**
     * Get users by delegation.
     * @param {string} delegationID - Delegation ID.
     * @returns {Promise<Array>} List of users.
     */
    static async getUsersByDelegation(delegationID) {
        if (!delegationID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ delegationID });

        try {
            const delegation = await Delegation.findByPk(delegationID);
            if (!delegation) {
                return [];
            }
            const users = await User.findAll({
                include: [
                    {
                        model: Delegation,
                        through: { attributes: [] },
                        where: { delegationID },
                        attributes: [],
                    },
                    { model: Role, through: { attributes: [] }, attributes: ['name'] },
                ],
            });
            if (!users.length) {
                return [];
            }
            return users;
        } catch (error) {
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }




    /**
     * Get supervisors by regional manager.
     * @param {string} regionalManagerID - Regional Manager ID.
     * @returns {Promise<Array>} List of supervisors.
     */
    static async getSupervisorsByRegionalManager(regionalManagerID) {
        if (!regionalManagerID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: regionalManagerID });

        try {
            const regionalManager = await User.findByPk(regionalManagerID, {
                include: [
                    {
                        model: User,
                        as: 'Supervisors',
                        attributes: ['userID', 'firstname', 'lastname', 'email', 'phone'],
                        include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
                    },
                ],
            });
            if (!regionalManager) {
                return [];
            }
            return regionalManager.Supervisors || [];
        } catch (error) {
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    /**
     * Get regional managers by director.
     * @param {string} directorID - Director ID.
     * @returns {Promise<Array>} List of regional managers.
     */
    static async getRegionalManagersByDirector(directorID) {
        if (!directorID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: directorID });

        try {
            const director = await User.findByPk(directorID, {
                include: [
                    {
                        model: User,
                        as: 'RegionalManagers',
                        attributes: ['userID', 'firstname', 'lastname', 'email', 'phone'],
                        include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
                    },
                ],
            });
            if (!director) {
                return [];
            }
            return director.RegionalManagers || [];
        } catch (error) {
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    /**
     * Get director by regional manager.
     * @param {string} regionalManagerID - Regional Manager ID.
     * @returns {Promise<Array>} List containing the director.
     */
    static async getDirectorByRegionalManager(regionalManagerID) {
        if (!regionalManagerID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: regionalManagerID });

        try {
            const regionalManager = await User.findByPk(regionalManagerID, {
                include: [
                    {
                        model: User,
                        as: 'Director',
                        attributes: ['userID', 'firstname', 'lastname', 'email', 'phone'],
                        include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
                    },
                ],
            });
            if (!regionalManager) {
                return [];
            }
            return regionalManager.Director ? [regionalManager.Director] : [];
        } catch (error) {
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    /**
     * Get regional manager by supervisor.
     * @param {string} supervisorID - Supervisor ID.
     * @returns {Promise<Array>} List containing the regional manager.
     */
    static async getRegionalManagerBySupervisor(supervisorID) {
        if (!supervisorID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: supervisorID });

        try {
            const supervisor = await User.findByPk(supervisorID, {
                include: [
                    {
                        model: User,
                        as: 'RegionalManager',
                        attributes: ['userID', 'firstname', 'lastname', 'email', 'phone'],
                        include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
                    },
                ],
            });
            if (!supervisor) {
                return [];
            }
            return supervisor.RegionalManager ? [supervisor.RegionalManager] : [];
        } catch (error) {
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

















    /**
     * Assign a regional manager to a supervisor.
     * @param {string} supervisorID - Supervisor ID.
     * @param {string} regionalManagerID - Regional Manager ID.
     * @returns {Promise<Object>} Assignment details.
     */
    static async assignRegionalManagerToSupervisor(supervisorID, regionalManagerID) {
        if (!supervisorID || !regionalManagerID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: supervisorID });

        try {
            const supervisor = await User.findByPk(supervisorID, {
                include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
            });
            if (!supervisor) {
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            if (!supervisor.Roles.some(role => role.name === process.env.ROLE_SUPERVISOR)) {
                throw new Error(ERROR_MESSAGES.INVALID_ROLE_ASSIGNMENT);
            }

            const regionalManager = await User.findByPk(regionalManagerID, {
                include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
            });
            if (!regionalManager) {
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            if (!regionalManager.Roles.some(role => role.name === process.env.ROLE_REGIONAL_MANAGER)) {
                throw new Error(ERROR_MESSAGES.INVALID_ROLE_ASSIGNMENT);
            }

            await supervisor.update({ regionalManagerID });
            return {
                supervisorID,
                regionalManagerID,
                message: 'Regional Manager assigned successfully.',
            };
        } catch (error) {
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    static async revokeRegionalManagerFromSupervisor(supervisorID, confirmations = {}) {
        if (!supervisorID) {
            throw new Error('Missing required fields.');
        }

        this.validateInput({ userID: supervisorID });

        try {
            const supervisor = await User.findByPk(supervisorID, {
                include: [
                    { model: Governorate, through: { attributes: [] } },
                    { model: Delegation, through: { attributes: [] } },
                    { model: Agent, as: 'Agents' },
                ],
            });
            if (!supervisor) {
                throw new Error('User not found.');
            }
            if (!supervisor.regionalManagerID) {
                return {
                    supervisorID,
                    regionalManagerID: null,
                    message: 'No Regional Manager assigned.',
                    cascadeApplied: { governorates: false, delegations: false, agents: false },
                };
            }

            const regionalManagerID = supervisor.regionalManagerID;
            const regionalManager = await User.findByPk(regionalManagerID, {
                include: [{ model: Region, through: { attributes: [] } }],
            });
            if (!regionalManager) {
                throw new Error('User not found.');
            }

            const regions = regionalManager.Regions || [];
            const regionIDs = regions.map(r => r.regionID);
            const governorates = await Governorate.findAll({ where: { regionID: { [Op.in]: regionIDs } } });
            const governorateIDs = governorates.map(g => g.governorateID);
            const delegations = await Delegation.findAll({ where: { governorateID: { [Op.in]: governorateIDs } } });
            const delegationIDs = delegations.map(d => d.delegationID);
            const agents = await Agent.findAll({ where: { delegationID: { [Op.in]: delegationIDs }, supervisorID } });

            if ((governorates.length > 0 || delegations.length > 0 || agents.length > 0) && !confirmations.revokeAll) {
                throw new Error('Confirmation required for revoking associated governorates, delegations, and agents.');
            }

            if (confirmations.revokeAll) {
                for (const governorate of governorates) {
                    await supervisor.removeGovernorate(governorate);
                }
                for (const delegation of delegations) {
                    await supervisor.removeDelegation(delegation);
                }
                for (const agent of agents) {
                    await agent.update({ supervisorID: null, delegationID: null });
                }
            }

            await supervisor.update({ regionalManagerID: null });
            return {
                supervisorID,
                regionalManagerID,
                message: 'Regional Manager revoked successfully.',
                cascadeApplied: {
                    governorates: confirmations.revokeAll || false,
                    delegations: confirmations.revokeAll || false,
                    agents: confirmations.revokeAll || false,
                },
                affectedCounts: {
                    governorates: governorates.length,
                    delegations: delegations.length,
                    agents: agents.length,
                },
            };
        } catch (error) {
            throw new Error(error.message || 'Database update failed.');
        }
    }



    /**
     * Assign a director to a regional manager.
     * @param {string} regionalManagerID - Regional Manager ID.
     * @param {string} directorID - Director ID.
     * @returns {Promise<Object>} Assignment details.
     */
    static async assignDirectorToRegionalManager(regionalManagerID, directorID) {
        if (!regionalManagerID || !directorID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: regionalManagerID });

        try {
            const regionalManager = await User.findByPk(regionalManagerID, {
                include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
            });
            if (!regionalManager) {
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            if (!regionalManager.Roles.some(role => role.name === process.env.ROLE_REGIONAL_MANAGER)) {
                throw new Error(ERROR_MESSAGES.INVALID_ROLE_ASSIGNMENT);
            }

            const director = await User.findByPk(directorID, {
                include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
            });
            if (!director) {
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            if (!director.Roles.some(role => role.name === process.env.ROLE_DIRECTOR)) {
                throw new Error(ERROR_MESSAGES.INVALID_ROLE_ASSIGNMENT);
            }

            await regionalManager.update({ directorID });
            return {
                regionalManagerID,
                directorID,
                message: 'Director assigned successfully.',
            };
        } catch (error) {
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }


    static async revokeDirectorFromRegionalManager(regionalManagerID) {
        if (!regionalManagerID) {
            throw new Error('Missing required fields.');
        }

        this.validateInput({ userID: regionalManagerID });

        try {
            const regionalManager = await User.findByPk(regionalManagerID);
            if (!regionalManager) {
                throw new Error('User not found.');
            }
            if (!regionalManager.directorID) {
                return {
                    regionalManagerID,
                    directorID: null,
                    message: 'No Director assigned.',
                };
            }

            const directorID = regionalManager.directorID;
            await regionalManager.update({ directorID: null });
            return {
                regionalManagerID,
                directorID,
                message: 'Director revoked successfully.',
            };
        } catch (error) {
            throw new Error(error.message || 'Database update failed.');
        }
    }



    /**
     * Assign a supervisor to an agent.
     * @param {string} agentID - Agent ID.
     * @param {string} supervisorID - Supervisor ID.
     * @param {string} delegationID - Delegation ID.
     * @returns {Promise<Object>} Assignment details.
     */
    static async assignSupervisorToAgent(agentID, supervisorID, delegationID) {
        if (!agentID || !supervisorID || !delegationID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: supervisorID, delegationID, agentID });

        try {
            const agent = await Agent.findByPk(agentID);
            if (!agent) {
                return { success: false, message: 'Agent not found' };

            }

            const supervisor = await User.findByPk(supervisorID, {
                include: [
                    { model: Role, through: { attributes: [] }, attributes: ['name'] },
                    { model: Delegation, through: { attributes: [] } },
                ],
            });
            if (!supervisor) {
                return { success: false, message: 'Supervisor not found' };

            }
            if (!supervisor.Roles.some(role => role.name === process.env.ROLE_SUPERVISOR)) {
                return { success: false, message: 'Assigned user is not a supervisor' };
            }

            const delegation = await Delegation.findByPk(delegationID);
            if (!delegation) {
                throw new Error(ERROR_MESSAGES.DELEGATION_NOT_FOUND);
            }

            // Validate that the Delegation is assigned to the Supervisor
            if (!supervisor.Delegations.some(d => d.delegationID === delegationID)) {
                throw new Error(ERROR_MESSAGES.REGION_NOT_ASSIGNED);
            }

            await agent.update({ supervisorID, delegationID });
            return {
                success: true,
                agentID,
                supervisorID,
                delegationID,
                message: 'Supervisor and Delegation assigned successfully.',
            };
        } catch (error) {
            return { success: false, message: `Failed to assign supervisor: ${error.message}` };

        }
    }

    static async revokeSupervisorFromAgent(agentID) {
        if (!agentID) {
            throw new Error('Missing required fields.');
        }

        this.validateInput({ agentID });

        try {
            const agent = await Agent.findByPk(agentID);
            if (!agent) {
                throw new Error('Agent not found.');
            }
            if (!agent.supervisorID) {
                return {
                    agentID,
                    supervisorID: null,
                    delegationID: null,
                    message: 'No Supervisor assigned.',
                };
            }

            const supervisorID = agent.supervisorID;
            const delegationID = agent.delegationID;
            await agent.update({ supervisorID: null, delegationID: null });
            return {
                agentID,
                supervisorID,
                delegationID,
                message: 'Supervisor and Delegation revoked successfully.',
            };
        } catch (error) {
            throw new Error(error.message || 'Database update failed.');
        }
    }








    /**
     * Assign a region to a user.
     * @param {string} userID - User ID.
     * @param {string} regionID - Region ID.
     * @returns {Promise<Object>} Assignment details.
     */
    static async assignRegionToUser(userID, regionID) {
        if (!userID || !regionID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID, regionID });

        try {
            const user = await User.findByPk(userID, {
                include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
            });
            if (!user) {
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            if (!user.Roles.some(role => role.name === process.env.ROLE_REGIONAL_MANAGER)) {
                throw new Error(ERROR_MESSAGES.INVALID_ROLE_ASSIGNMENT);
            }

            const region = await Region.findByPk(regionID);
            if (!region) {
                throw new Error(ERROR_MESSAGES.REGION_NOT_FOUND);
            }

            await user.addRegion(region);
            return {
                userID,
                regionID,
                message: 'Region assigned successfully.',
            };
        } catch (error) {
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    static async revokeRegionsFromRegionalManager(regionalManagerID, regionIDs, confirmations = {}) {
        if (!regionalManagerID || !Array.isArray(regionIDs) || regionIDs.length === 0) {
            throw new Error('Missing required fields.');
        }

        this.validateInput({ userID: regionalManagerID, ids: regionIDs });

        try {
            const regionalManager = await User.findByPk(regionalManagerID, {
                include: [{ model: Region, through: { attributes: [] } }],
            });
            if (!regionalManager) {
                throw new Error('User not found.');
            }

            const regionsToRevoke = await Region.findAll({ where: { regionID: { [Op.in]: regionIDs } } });
            if (regionsToRevoke.length !== regionIDs.length) {
                throw new Error('One or more regions not found.');
            }

            const governorates = await Governorate.findAll({ where: { regionID: { [Op.in]: regionIDs } } });
            const governorateIDs = governorates.map(g => g.governorateID);
            const supervisors = await User.findAll({
                where: { regionalManagerID },
                include: [{ model: Governorate, through: { attributes: [] }, where: { governorateID: { [Op.in]: governorateIDs } } }],
            });

            if (supervisors.length > 0 && !confirmations.revokeSupervisors) {
                throw new Error('Confirmation required for revoking associated supervisors.');
            }

            if (confirmations.revokeSupervisors) {
                for (const supervisor of supervisors) {
                    await supervisor.update({ regionalManagerID: null });
                }
            }

            for (const region of regionsToRevoke) {
                await regionalManager.removeRegion(region);
            }

            return {
                regionalManagerID,
                regionIDs,
                message: 'Regions revoked successfully.',
                cascadeApplied: { supervisors: confirmations.revokeSupervisors || false },
                affectedCounts: { supervisors: supervisors.length },
            };
        } catch (error) {
            throw new Error(error.message || 'Database update failed.');
        }
    }



    /**
     * Assign a governorate to a user.
     * @param {string} userID - User ID.
     * @param {string} governorateID - Governorate ID.
     * @returns {Promise<Object>} Assignment details.
     */
    static async assignGovernorateToUser(userID, governorateID) {
        if (!userID || !governorateID) {
            return { success: false, message: ERROR_MESSAGES.MISSING_FIELDS };
        }
        try {
            const user = await User.findByPk(userID, {
                include: [
                    { model: Role, through: { attributes: [] }, attributes: ['name'] },
                    { model: Region, through: { attributes: [] } },
                ],
            });
            if (!user) return { success: false, message: ERROR_MESSAGES.USER_NOT_FOUND };
            if (!user.Roles.some(role => role.name === process.env.ROLE_SUPERVISOR)) {
                return { success: false, message: ERROR_MESSAGES.INVALID_ROLE_ASSIGNMENT };
            }
            const governorate = await Governorate.findByPk(governorateID);
            if (!governorate) return { success: false, message: ERROR_MESSAGES.GOVERNORATE_NOT_FOUND };
            await user.addGovernorate(governorate);
            return {
                success: true, // Add this
                userID,
                governorateID,
                message: 'Governorate assigned successfully.',
            };
        } catch (error) {
            return { success: false, message: ERROR_MESSAGES.DB_UPDATE_FAILED };
        }
    }
    static async revokeGovernoratesFromSupervisor(supervisorID, governorateIDs, confirmations = {}) {
        if (!supervisorID || !Array.isArray(governorateIDs) || governorateIDs.length === 0) {
            throw new Error('Missing required fields.');
        }

        this.validateInput({ userID: supervisorID, ids: governorateIDs });

        try {
            const supervisor = await User.findByPk(supervisorID, {
                include: [
                    { model: Governorate, through: { attributes: [] } },
                    { model: Delegation, through: { attributes: [] } },
                    { model: Agent, as: 'Agents' },
                ],
            });
            if (!supervisor) {
                throw new Error('User not found.');
            }

            const governoratesToRevoke = await Governorate.findAll({ where: { governorateID: { [Op.in]: governorateIDs } } });
            if (governoratesToRevoke.length !== governorateIDs.length) {
                throw new Error('One or more governorates not found.');
            }

            const delegations = await Delegation.findAll({ where: { governorateID: { [Op.in]: governorateIDs } } });
            const delegationIDs = delegations.map(d => d.delegationID);
            const agents = await Agent.findAll({ where: { delegationID: { [Op.in]: delegationIDs }, supervisorID } });

            if ((delegations.length > 0 || agents.length > 0) && !confirmations.revokeAll) {
                throw new Error('Confirmation required for revoking associated delegations and agents.');
            }

            if (confirmations.revokeAll) {
                for (const delegation of delegations) {
                    await supervisor.removeDelegation(delegation);
                }
                for (const agent of agents) {
                    await agent.update({ supervisorID: null, delegationID: null });
                }
            }

            for (const governorate of governoratesToRevoke) {
                await supervisor.removeGovernorate(governorate);
            }

            return {
                supervisorID,
                governorateIDs,
                message: 'Governorates revoked successfully.',
                cascadeApplied: {
                    delegations: confirmations.revokeAll || false,
                    agents: confirmations.revokeAll || false,
                },
                affectedCounts: {
                    delegations: delegations.length,
                    agents: agents.length,
                },
            };
        } catch (error) {
            throw new Error(error.message || 'Database update failed.');
        }
    }



    /**
     * Assign a delegation to a user.
     * @param {string} userID - User ID.
     * @param {string} delegationID - Delegation ID.
     * @returns {Promise<Object>} Assignment details.
     */
    static async assignDelegationToUser(userID, delegationID) {
        if (!userID || !delegationID) {
            return { success: false, message: 'Missing required fields.' };
        }
        try {
            const user = await User.findByPk(userID, {
                include: [
                    { model: Role, through: { attributes: [] }, attributes: ['name'] },
                    { model: Governorate, through: { attributes: [] } },
                ],
            });
            if (!user) return { success: false, message: 'User not found.' };
            if (!user.Roles.some(role => role.name === process.env.ROLE_SUPERVISOR)) {
                return { success: false, message: 'User is not a supervisor.' };
            }
            const delegation = await Delegation.findByPk(delegationID, {
                include: [{ model: Governorate }],
            });
            if (!delegation) return { success: false, message: 'Delegation not found.' };
            if (!user.Governorates.some(g => g.governorateID === delegation.governorateID)) {
                return { success: false, message: 'Governorate not assigned to user.' };
            }
            await user.addDelegation(delegation);
            return {
                success: true,  // Critical addition
                userID,
                delegationID,
                message: 'Delegation assigned successfully.'
            };
        } catch (error) {
            return { success: false, message: 'Database update failed.' };
        }
    }

    static async revokeDelegationsFromSupervisor(supervisorID, delegationIDs, confirmations = {}) {
        if (!supervisorID || !Array.isArray(delegationIDs) || delegationIDs.length === 0) {
            throw new Error('Missing required fields.');
        }

        this.validateInput({ userID: supervisorID, ids: delegationIDs });

        try {
            const supervisor = await User.findByPk(supervisorID, {
                include: [
                    { model: Delegation, through: { attributes: [] } },
                    { model: Agent, as: 'Agents' },
                ],
            });
            if (!supervisor) {
                throw new Error('User not found.');
            }

            const delegationsToRevoke = await Delegation.findAll({ where: { delegationID: { [Op.in]: delegationIDs } } });
            if (delegationsToRevoke.length !== delegationIDs.length) {
                throw new Error('One or more delegations not found.');
            }

            const agents = await Agent.findAll({ where: { delegationID: { [Op.in]: delegationIDs }, supervisorID } });

            if (agents.length > 0 && !confirmations.revokeAgents) {
                throw new Error('Confirmation required for revoking associated agents.');
            }

            if (confirmations.revokeAgents) {
                for (const agent of agents) {
                    await agent.update({ supervisorID: null, delegationID: null });
                }
            }

            for (const delegation of delegationsToRevoke) {
                await supervisor.removeDelegation(delegation);
            }

            return {
                supervisorID,
                delegationIDs,
                message: 'Delegations revoked successfully.',
                cascadeApplied: { agents: confirmations.revokeAgents || false },
                affectedCounts: { agents: agents.length },
            };
        } catch (error) {
            throw new Error(error.message || 'Database update failed.');
        }
    }


}

module.exports = UserService;