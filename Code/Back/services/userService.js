const axios = require('axios');
const { User, Role, Region, Governorate, Delegation, Agent } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
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
            logger.error(`Get admin token error: ${error.message}`, { ip: null });
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
     * Assign a Google account to a user.
     * @param {string} userID - User ID.
     * @param {string} googleEmail - Google email to assign.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Updated user.
     */
    static async assignGoogleAccount(userID, googleEmail, actorID) {
        if (!userID || !googleEmail) {
            logger.warn(`Assign Google account failed: Missing fields, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID, googleEmail });

        const existingUser = await User.findOne({
            where: { googleEmail, userID: { [Op.ne]: userID } },
        });
        if (existingUser) {
            logger.warn(`Assign Google account failed: Email already linked, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.GOOGLE_EMAIL_ALREADY_LINKED);
        }

        const user = await User.findByPk(userID);
        if (!user) {
            logger.warn(`Assign Google account failed: User not found, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        }
        if (!user.keycloakId) {
            logger.warn(`Assign Google account failed: User not synced, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.USER_NOT_SYNCED);
        }

        const token = await this.getAdminToken();

        try {
            const federatedIdentities = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.keycloakId}/federated-identity`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const googleIdentity = federatedIdentities.data.find(id => id.identityProvider === 'google');
            if (googleIdentity) {
                logger.warn(`Assign Google account failed: Google identity already linked, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.GOOGLE_EMAIL_ALREADY_LINKED);
            }

            await axios.post(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.keycloakId}/federated-identity/google`,
                {
                    identityProvider: 'google',
                    userId: user.keycloakId,
                    userName: googleEmail,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            logger.error(`Keycloak assign Google account error: ${error.message}, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.KEYCLOAK_UPDATE_FAILED);
        }

        try {
            await user.update({ googleEmail });
            logger.info(`Assigned Google account to user ${userID} by user ${actorID}`);
            return user;
        } catch (error) {
            logger.error(`DB update Google account error: ${error.message}, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    /**
     * Create a new user.
     * @param {string} email - User's email.
     * @param {string} password - User's password.
     * @param {string} firstname - User's first name.
     * @param {string} lastname - User's last name.
     * @param {string} phone - User's phone number.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Created user.
     */
    static async createUser(email, password, firstname, lastname, phone, actorID) {
        if (!email || !password || !firstname || !lastname || !phone) {
            logger.warn(`Create user failed: Missing fields, user: ${actorID}`);
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
                logger.warn(`Create user failed: Duplicate email ${email}, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.DUPLICATE_EMAIL);
            }
        } catch (error) {
            if (error.response?.status !== 404) {
                logger.error(`Keycloak check duplicate error: ${error.message}, user: ${actorID}`);
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
            logger.error(`Keycloak create user error: ${error.message}, user: ${actorID}`);
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
            logger.warn(`Create user failed: ${errors.join(' ')}, user: ${actorID}`);
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
            logger.info(`Created user ${email} by user ${actorID}`);
            return user;
        } catch (error) {
            logger.error(`DB create user error: ${error.message}, user: ${actorID}`);
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
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Updated user.
     */
    static async updateUser(userID, userData, actorID) {
        if (!userID) {
            logger.warn(`Update user failed: Missing userID, user: ${actorID}`);
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
            logger.warn(`Update user failed: User not found, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        }
        if (!user.keycloakId) {
            logger.warn(`Update user failed: User not synced, user: ${actorID}`);
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
                logger.warn(`Update user failed: ${errors.join(' ')}, user: ${actorID}`);
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
            logger.error(`Keycloak update user error: ${error.message}, user: ${actorID}`);
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
                logger.error(`Keycloak password update error: ${error.message}, user: ${actorID}`);
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
            logger.info(`Updated user ${userID} by user ${actorID}`);
            return user;
        } catch (error) {
            logger.error(`DB update user error: ${error.message}, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    /**
     * Delete a user.
     * @param {string} userID - User ID.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Success message.
     */
    static async deleteUser(userID, actorID) {
        if (!userID) {
            logger.warn(`Delete user failed: Missing userID, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID });

        const user = await User.findByPk(userID);
        if (!user) {
            logger.warn(`Delete user failed: User not found, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        const token = await this.getAdminToken();

        if (user.keycloakId) {
            try {
                await axios.delete(`${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.keycloakId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
            } catch (error) {
                logger.error(`Keycloak delete user error: ${error.message}, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.KEYCLOAK_DELETE_FAILED);
            }
        }

        try {
            await user.destroy();
            logger.info(`Deleted user ${userID} by user ${actorID}`);
            return { message: 'User deleted successfully.' };
        } catch (error) {
            logger.error(`DB delete user error: ${error.message}, user: ${actorID}`);
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
                logger.info(`No users found`);
                return [];
            }
            return users;
        } catch (error) {
            logger.error(`Get all users error: ${error.message}`);
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
            logger.warn(`Get user by phone failed: Missing phone`);
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
                logger.info(`No user found for phone ${phone}`);
                return null;
            }
            return user;
        } catch (error) {
            logger.error(`Get user by phone error: ${error.message}`);
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
            logger.warn(`Get user by ID failed: Missing userID`);
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
                logger.info(`No user found for ID ${userID}`);
                return null;
            }

            return user;
        } catch (error) {
            logger.error(`Get user by ID error: ${error.message}`);
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
            logger.warn(`Get users by role failed: Missing role`);
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ role: roleName });

        try {
            const role = await Role.findOne({ where: { name: roleName } });
            if (!role) {
                logger.warn(`Get users by role failed: Role ${roleName} not found`);
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
                logger.info(`No users found for role ${roleName}`);
                return [];
            }
            return users;
        } catch (error) {
            logger.error(`Get users by role error: ${error.message}`);
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
            logger.warn(`Get supervisors failed: Missing userID`);
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
                logger.warn(`Get supervisors failed: User ${userID} not found`);
                return [];
            }
            logger.info(`Fetched supervisors for user ${userID}`);
            return user.Supervisors || [];
        } catch (error) {
            logger.error(`Get supervisors error: ${error.message}`);
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
            logger.warn(`Get regional managers failed: Missing userID`);
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
                logger.warn(`Get regional managers failed: User ${userID} not found`);
                return [];
            }
            logger.info(`Fetched regional managers for user ${userID}`);
            return user.RegionalManager ? [user.RegionalManager] : [];
        } catch (error) {
            logger.error(`Get regional managers error: ${error.message}`);
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
            logger.warn(`Get director failed: Missing userID`);
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
                logger.warn(`Get director failed: User ${userID} not found`);
                return [];
            }
            logger.info(`Fetched director for user ${userID}`);
            return user.Director ? [user.Director] : [];
        } catch (error) {
            logger.error(`Get director error: ${error.message}`);
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }






    /**
     * Get regions assigned to a user.
     * @param {string} userID - User ID.
     * @returns {Promise<Array>} List of regions.
     */
    static async getRegionsByUser(userID) {
        if (!userID) {
            logger.warn(`Get regions by user failed: Missing userID`);
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID });

        try {
            const user = await User.findByPk(userID, {
                include: [
                    { model: Region, through: { attributes: [] }, attributes: ['regionID', 'name'] },
                ],
            });
            if (!user) {
                logger.warn(`Get regions by user failed: User ${userID} not found`);
                return [];
            }
            logger.info(`Fetched regions for user ${userID}`);
            return user.Regions || [];
        } catch (error) {
            logger.error(`Get regions by user error: ${error.message}`);
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    /**
     * Get governorates assigned to a user.
     * @param {string} userID - User ID.
     * @returns {Promise<Array>} List of governorates.
     */
    static async getGovernoratesByUser(userID) {
        if (!userID) {
            logger.warn(`Get governorates by user failed: Missing userID`);
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID });

        try {
            const user = await User.findByPk(userID, {
                include: [
                    { model: Governorate, through: { attributes: [] }, attributes: ['governorateID', 'name'] },
                ],
            });
            if (!user) {
                logger.warn(`Get governorates by user failed: User ${userID} not found`);
                return [];
            }
            logger.info(`Fetched governorates for user ${userID}`);
            return user.Governorates || [];
        } catch (error) {
            logger.error(`Get governorates by user error: ${error.message}`);
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    /**
     * Get delegations assigned to a user.
     * @param {string} userID - User ID.
     * @returns {Promise<Array>} List of delegations.
     */
    static async getDelegationsByUser(userID) {
        if (!userID) {
            logger.warn(`Get delegations by user failed: Missing userID`);
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID });

        try {
            const user = await User.findByPk(userID, {
                include: [
                    { model: Delegation, through: { attributes: [] }, attributes: ['delegationID', 'name'] },
                ],
            });
            if (!user) {
                logger.warn(`Get delegations by user failed: User ${userID} not found`);
                return [];
            }
            logger.info(`Fetched delegations for user ${userID}`);
            return user.Delegations || [];
        } catch (error) {
            logger.error(`Get delegations by user error: ${error.message}`);
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
            logger.warn(`Get users by region failed: Missing regionID`);
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ regionID });

        try {
            const region = await Region.findByPk(regionID);
            if (!region) {
                logger.warn(`Get users by region failed: Region ${regionID} not found`);
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
                logger.info(`No users found for region ${regionID}`);
                return [];
            }
            return users;
        } catch (error) {
            logger.error(`Get users by region error: ${error.message}`);
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
            logger.warn(`Get users by governorate failed: Missing governorateID`);
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ governorateID });

        try {
            const governorate = await Governorate.findByPk(governorateID);
            if (!governorate) {
                logger.warn(`Get users by governorate failed: Governorate ${governorateID} not found`);
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
                logger.info(`No users found for governorate ${governorateID}`);
                return [];
            }
            return users;
        } catch (error) {
            logger.error(`Get users by governorate error: ${error.message}`);
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
            logger.warn(`Get users by delegation failed: Missing delegationID`);
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ delegationID });

        try {
            const delegation = await Delegation.findByPk(delegationID);
            if (!delegation) {
                logger.warn(`Get users by delegation failed: Delegation ${delegationID} not found`);
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
                logger.info(`No users found for delegation ${delegationID}`);
                return [];
            }
            return users;
        } catch (error) {
            logger.error(`Get users by delegation error: ${error.message}`);
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
            logger.warn(`Get supervisors by regional manager failed: Missing regionalManagerID`);
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
                logger.warn(`Get supervisors by regional manager failed: Regional manager ${regionalManagerID} not found`);
                return [];
            }
            logger.info(`Fetched supervisors for regional manager ${regionalManagerID}`);
            return regionalManager.Supervisors || [];
        } catch (error) {
            logger.error(`Get supervisors by regional manager error: ${error.message}`);
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
            logger.warn(`Get regional managers by director failed: Missing directorID`);
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
                logger.warn(`Get regional managers by director failed: Director ${directorID} not found`);
                return [];
            }
            logger.info(`Fetched regional managers for director ${directorID}`);
            return director.RegionalManagers || [];
        } catch (error) {
            logger.error(`Get regional managers by director error: ${error.message}`);
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
            logger.warn(`Get director by regional manager failed: Missing regionalManagerID`);
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
                logger.warn(`Get director by regional manager failed: Regional manager ${regionalManagerID} not found`);
                return [];
            }
            logger.info(`Fetched director for regional manager ${regionalManagerID}`);
            return regionalManager.Director ? [regionalManager.Director] : [];
        } catch (error) {
            logger.error(`Get director by regional manager error: ${error.message}`);
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
            logger.warn(`Get regional manager by supervisor failed: Missing supervisorID`);
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
                logger.warn(`Get regional manager by supervisor failed: Supervisor ${supervisorID} not found`);
                return [];
            }
            logger.info(`Fetched regional manager for supervisor ${supervisorID}`);
            return supervisor.RegionalManager ? [supervisor.RegionalManager] : [];
        } catch (error) {
            logger.error(`Get regional manager by supervisor error: ${error.message}`);
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

















    /**
     * Assign a regional manager to a supervisor.
     * @param {string} supervisorID - Supervisor ID.
     * @param {string} regionalManagerID - Regional Manager ID.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Assignment details.
     */
    static async assignRegionalManagerToSupervisor(supervisorID, regionalManagerID, actorID) {
        if (!supervisorID || !regionalManagerID) {
            logger.warn(`Assign regional manager failed: Missing fields, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: supervisorID });

        try {
            const supervisor = await User.findByPk(supervisorID, {
                include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
            });
            if (!supervisor) {
                logger.warn(`Assign regional manager failed: Supervisor ${supervisorID} not found, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            if (!supervisor.Roles.some(role => role.name === process.env.ROLE_SUPERVISOR)) {
                logger.warn(`Assign regional manager failed: Invalid role for supervisor ${supervisorID}, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.INVALID_ROLE_ASSIGNMENT);
            }

            const regionalManager = await User.findByPk(regionalManagerID, {
                include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
            });
            if (!regionalManager) {
                logger.warn(`Assign regional manager failed: Regional manager ${regionalManagerID} not found, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            if (!regionalManager.Roles.some(role => role.name === process.env.ROLE_REGIONAL_MANAGER)) {
                logger.warn(`Assign regional manager failed: Invalid role for regional manager ${regionalManagerID}, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.INVALID_ROLE_ASSIGNMENT);
            }

            await supervisor.update({ regionalManagerID });
            logger.info(`Assigned regional manager ${regionalManagerID} to supervisor ${supervisorID} by user ${actorID}`);
            return {
                supervisorID,
                regionalManagerID,
                message: 'Regional Manager assigned successfully.',
            };
        } catch (error) {
            logger.error(`Assign regional manager error: ${error.message}, user: ${actorID}`);
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    /**
     * Revoke a regional manager from a supervisor with cascading confirmations.
     * @param {string} supervisorID - Supervisor ID.
     * @param {string} actorID - ID of the user performing the action.
     * @param {Object} confirmations - Object containing confirmation flags.
     * @param {boolean} confirmations.revokeGovernorates - Confirm revocation of governorates.
     * @param {boolean} confirmations.revokeDelegations - Confirm revocation of delegations.
     * @param {boolean} confirmations.revokeAgents - Confirm revocation of agents.
     * @returns {Promise<Object>} Revocation details.
     */
    static async revokeRegionalManagerFromSupervisor(supervisorID, actorID, confirmations = {}) {
        if (!supervisorID) {
            logger.warn(`Revoke regional manager failed: Missing supervisorID, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
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
                logger.warn(`Revoke regional manager failed: Supervisor ${supervisorID} not found, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            if (!supervisor.regionalManagerID) {
                logger.info(`No regional manager assigned to supervisor ${supervisorID}, user: ${actorID}`);
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
                logger.warn(`Revoke regional manager failed: Regional manager ${regionalManagerID} not found, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }

            const governorates = supervisor.Governorates || [];
            const delegations = supervisor.Delegations || [];
            const agents = supervisor.Agents || [];

            // Check for required confirmations
            if (governorates.length > 0 && !confirmations.revokeGovernorates) {
                logger.warn(`Revoke regional manager failed: Governorate confirmation required, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.CASCADE_CONFIRMATION_GOVERNORATES);
            }
            if (delegations.length > 0 && !confirmations.revokeDelegations) {
                logger.warn(`Revoke regional manager failed: Delegation confirmation required, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.CASCADE_CONFIRMATION_DELEGATIONS);
            }
            if (agents.length > 0 && !confirmations.revokeAgents) {
                logger.warn(`Revoke regional manager failed: Agent confirmation required, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.CASCADE_CONFIRMATION_AGENTS);
            }

            // Perform cascading revocations if confirmed
            if (confirmations.revokeGovernorates) {
                for (const governorate of governorates) {
                    await supervisor.removeGovernorate(governorate);
                }
            }

            if (confirmations.revokeDelegations) {
                for (const delegation of delegations) {
                    await supervisor.removeDelegation(delegation);
                }
            }

            if (confirmations.revokeAgents) {
                for (const agent of agents) {
                    await agent.update({ supervisorID: null, delegationID: null });
                }
            }

            // Revoke the regional manager
            await supervisor.update({ regionalManagerID: null });
            logger.info(`Revoked regional manager ${regionalManagerID} from supervisor ${supervisorID} by user ${actorID}`);
            return {
                supervisorID,
                regionalManagerID,
                message: 'Regional Manager revoked successfully.',
                cascadeApplied: {
                    governorates: confirmations.revokeGovernorates || false,
                    delegations: confirmations.revokeDelegations || false,
                    agents: confirmations.revokeAgents || false,
                },
                affectedCounts: {
                    governorates: governorates.length,
                    delegations: delegations.length,
                    agents: agents.length,
                },
            };
        } catch (error) {
            logger.error(`Revoke regional manager error: ${error.message}, user: ${actorID}`);
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }



    /**
     * Assign a director to a regional manager.
     * @param {string} regionalManagerID - Regional Manager ID.
     * @param {string} directorID - Director ID.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Assignment details.
     */
    static async assignDirectorToRegionalManager(regionalManagerID, directorID, actorID) {
        if (!regionalManagerID || !directorID) {
            logger.warn(`Assign director failed: Missing fields, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: regionalManagerID });

        try {
            const regionalManager = await User.findByPk(regionalManagerID, {
                include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
            });
            if (!regionalManager) {
                logger.warn(`Assign director failed: Regional manager ${regionalManagerID} not found, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            if (!regionalManager.Roles.some(role => role.name === process.env.ROLE_REGIONAL_MANAGER)) {
                logger.warn(`Assign director failed: Invalid role for regional manager ${regionalManagerID}, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.INVALID_ROLE_ASSIGNMENT);
            }

            const director = await User.findByPk(directorID, {
                include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
            });
            if (!director) {
                logger.warn(`Assign director failed: Director ${directorID} not found, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            if (!director.Roles.some(role => role.name === process.env.ROLE_DIRECTOR)) {
                logger.warn(`Assign director failed: Invalid role for director ${directorID}, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.INVALID_ROLE_ASSIGNMENT);
            }

            await regionalManager.update({ directorID });
            logger.info(`Assigned director ${directorID} to regional manager ${regionalManagerID} by user ${actorID}`);
            return {
                regionalManagerID,
                directorID,
                message: 'Director assigned successfully.',
            };
        } catch (error) {
            logger.error(`Assign director error: ${error.message}, user: ${actorID}`);
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    /**
     * Revoke a director from a regional manager.
     * @param {string} regionalManagerID - Regional Manager ID.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Revocation details.
     */
    static async revokeDirectorFromRegionalManager(regionalManagerID, actorID) {
        if (!regionalManagerID) {
            logger.warn(`Revoke director failed: Missing regionalManagerID, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: regionalManagerID });

        try {
            const regionalManager = await User.findByPk(regionalManagerID);
            if (!regionalManager) {
                logger.warn(`Revoke director failed: Regional manager ${regionalManagerID} not found, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            if (!regionalManager.directorID) {
                logger.info(`No director assigned to regional manager ${regionalManagerID}, user: ${actorID}`);
                return {
                    regionalManagerID,
                    directorID: null,
                    message: 'No Director assigned.',
                };
            }

            const directorID = regionalManager.directorID;
            await regionalManager.update({ directorID: null });
            logger.info(`Revoked director ${directorID} from regional manager ${regionalManagerID} by user ${actorID}`);
            return {
                regionalManagerID,
                directorID,
                message: 'Director revoked successfully.',
            };
        } catch (error) {
            logger.error(`Revoke director error: ${error.message}, user: ${actorID}`);
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }



    /**
     * Assign a supervisor to an agent.
     * @param {string} agentID - Agent ID.
     * @param {string} supervisorID - Supervisor ID.
     * @param {string} delegationID - Delegation ID.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Assignment details.
     */
    static async assignSupervisorToAgent(agentID, supervisorID, delegationID, actorID) {
        if (!agentID || !supervisorID || !delegationID) {
            logger.warn(`Assign supervisor to agent failed: Missing fields, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: supervisorID, delegationID, agentID });

        try {
            const agent = await Agent.findByPk(agentID);
            if (!agent) {
                logger.warn(`Assign supervisor to agent failed: Agent ${agentID} not found, user: ${actorID}`);
                //throw new Error(ERROR_MESSAGES.AGENT_NOT_FOUND);
                return { success: false, message: 'Agent not found' };

            }

            const supervisor = await User.findByPk(supervisorID, {
                include: [
                    { model: Role, through: { attributes: [] }, attributes: ['name'] },
                    { model: Delegation, through: { attributes: [] } },
                ],
            });
            if (!supervisor) {
                logger.warn(`Assign supervisor to agent failed: Supervisor ${supervisorID} not found, user: ${actorID}`);
                //throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
                return { success: false, message: 'Supervisor not found' };

            }
            if (!supervisor.Roles.some(role => role.name === process.env.ROLE_SUPERVISOR)) {
                logger.warn(`Assign supervisor to agent failed: Invalid role for supervisor ${supervisorID}, user: ${actorID}`);
                //throw new Error(ERROR_MESSAGES.INVALID_ROLE_ASSIGNMENT)
                return { success: false, message: 'Assigned user is not a supervisor' };
            }

            const delegation = await Delegation.findByPk(delegationID);
            if (!delegation) {
                logger.warn(`Assign supervisor to agent failed: Delegation ${delegationID} not found, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.DELEGATION_NOT_FOUND);
            }

            // Validate that the Delegation is assigned to the Supervisor
            if (!supervisor.Delegations.some(d => d.delegationID === delegationID)) {
                logger.warn(`Assign supervisor to agent failed: Delegation ${delegationID} not assigned to supervisor, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.REGION_NOT_ASSIGNED);
            }

            await agent.update({ supervisorID, delegationID });
            logger.info(`Assigned supervisor ${supervisorID} to agent ${agentID} by user ${actorID}`);
            return {
                success: true,
                agentID,
                supervisorID,
                delegationID,
                message: 'Supervisor and Delegation assigned successfully.',
            };
        } catch (error) {
            logger.error(`Assign supervisor to agent error: ${error.message}, user: ${actorID}`);
            //throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
            return { success: false, message: `Failed to assign supervisor: ${error.message}` };

        }
    }

    /**
     * Revoke a supervisor from an agent.
     * @param {string} agentID - Agent ID.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Revocation details.
     */
    static async revokeSupervisorFromAgent(agentID, actorID) {
        if (!agentID) {
            logger.warn(`Revoke supervisor from agent failed: Missing agentID, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ agentID });

        try {
            const agent = await Agent.findByPk(agentID);
            if (!agent) {
                logger.warn(`Revoke supervisor from agent failed: Agent ${agentID} not found, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.AGENT_NOT_FOUND);
            }
            if (!agent.supervisorID) {
                logger.info(`No supervisor assigned to agent ${agentID}, user: ${actorID}`);
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
            logger.info(`Revoked supervisor ${supervisorID} from agent ${agentID} by user ${actorID}`);
            return {
                agentID,
                supervisorID,
                delegationID,
                message: 'Supervisor and Delegation revoked successfully.',
            };
        } catch (error) {
            logger.error(`Revoke supervisor from agent error: ${error.message}, user: ${actorID}`);
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }








    /**
     * Assign a region to a user.
     * @param {string} userID - User ID.
     * @param {string} regionID - Region ID.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Assignment details.
     */
    static async assignRegionToUser(userID, regionID, actorID) {
        if (!userID || !regionID) {
            logger.warn(`Assign region failed: Missing fields, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID, regionID });

        try {
            const user = await User.findByPk(userID, {
                include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
            });
            if (!user) {
                logger.warn(`Assign region failed: User ${userID} not found, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            if (!user.Roles.some(role => role.name === process.env.ROLE_REGIONAL_MANAGER)) {
                logger.warn(`Assign region failed: Invalid role for user ${userID}, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.INVALID_ROLE_ASSIGNMENT);
            }

            const region = await Region.findByPk(regionID);
            if (!region) {
                logger.warn(`Assign region failed: Region ${regionID} not found, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.REGION_NOT_FOUND);
            }

            await user.addRegion(region);
            logger.info(`Assigned region ${regionID} to user ${userID} by user ${actorID}`);
            return {
                userID,
                regionID,
                message: 'Region assigned successfully.',
            };
        } catch (error) {
            logger.error(`Assign region error: ${error.message}, user: ${actorID}`);
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    /**
     * Revoke a region from a user with optional cascading revocation.
     * @param {string} userID - User ID.
     * @param {string} regionID - Region ID.
     * @param {string} actorID - ID of the user performing the action.
     * @param {boolean} cascadeConfirmed - Whether to cascade revocation to governorates and delegations.
     * @returns {Promise<Object>} Revocation details.
     */
    static async revokeRegionFromUser(userID, regionID, actorID, cascadeConfirmed = false) {
        if (!userID || !regionID) {
            logger.warn(`Revoke region failed: Missing fields, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID, regionID });

        try {
            const user = await User.findByPk(userID, {
                include: [
                    { model: Region, through: { attributes: [] } },
                    { model: Governorate, through: { attributes: [] } },
                    { model: Delegation, through: { attributes: [] } },
                ],
            });
            if (!user) {
                logger.warn(`Revoke region failed: User ${userID} not found, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }

            const region = await Region.findByPk(regionID);
            if (!region) {
                logger.warn(`Revoke region failed: Region ${regionID} not found, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.REGION_NOT_FOUND);
            }

            if (!user.Regions.some(r => r.regionID === regionID)) {
                logger.info(`Region ${regionID} not assigned to user ${userID}, user: ${actorID}`);
                return {
                    userID,
                    regionID,
                    message: 'Region not assigned.',
                    cascadeApplied: false,
                };
            }

            const governorates = await Governorate.findAll({ where: { regionID } });
            const governorateIDs = governorates.map(g => g.governorateID);
            const delegations = await Delegation.findAll({
                where: { governorateID: { [Op.in]: governorateIDs } },
            });

            if (cascadeConfirmed) {
                // Revoke associated governorates
                for (const governorate of governorates) {
                    await user.removeGovernorate(governorate);
                }

                // Revoke associated delegations
                for (const delegation of delegations) {
                    await user.removeDelegation(delegation);
                }
            } else if (governorates.length > 0 || delegations.length > 0) {
                logger.warn(`Revoke region failed: Cascade confirmation required, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.CASCADE_CONFIRMATION_REQUIRED);
            }

            // Revoke the region
            await user.removeRegion(region);
            logger.info(`Revoked region ${regionID} from user ${userID} by user ${actorID}`);
            return {
                userID,
                regionID,
                message: 'Region revoked successfully.',
                cascadeApplied: cascadeConfirmed,
            };
        } catch (error) {
            logger.error(`Revoke region error: ${error.message}, user: ${actorID}`);
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }



    /**
     * Assign a governorate to a user.
     * @param {string} userID - User ID.
     * @param {string} governorateID - Governorate ID.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Assignment details.
     */
    static async assignGovernorateToUser(userID, governorateID, actorID) {
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
            logger.info(`Assigned governorate ${governorateID} to user ${userID} by user ${actorID}`);
            return {
                success: true, // Add this
                userID,
                governorateID,
                message: 'Governorate assigned successfully.',
            };
        } catch (error) {
            logger.error(`Assign governorate error: ${error.message}, user: ${actorID}`);
            return { success: false, message: ERROR_MESSAGES.DB_UPDATE_FAILED };
        }
    }
    /**
     * Revoke a governorate from a user with cascading confirmations.
     * @param {string} userID - User ID.
     * @param {string} governorateID - Governorate ID.
     * @param {string} actorID - ID of the user performing the action.
     * @param {Object} confirmations - Object containing confirmation flags.
     * @param {boolean} confirmations.revokeDelegations - Confirm revocation of delegations.
     * @param {boolean} confirmations.revokeAgents - Confirm revocation of agents.
     * @returns {Promise<Object>} Revocation details.
     */
    static async revokeGovernorateFromUser(userID, governorateID, actorID, confirmations = {}) {
        if (!userID || !governorateID) {
            logger.warn(`Revoke governorate failed: Missing fields, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID, governorateID });

        try {
            const user = await User.findByPk(userID, {
                include: [
                    { model: Governorate, through: { attributes: [] } },
                    { model: Delegation, through: { attributes: [] } },
                    { model: Agent, as: 'Agents' },
                ],
            });
            if (!user) {
                logger.warn(`Revoke governorate failed: User ${userID} not found, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }

            const governorate = await Governorate.findByPk(governorateID);
            if (!governorate) {
                logger.warn(`Revoke governorate failed: Governorate ${governorateID} not found, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.GOVERNORATE_NOT_FOUND);
            }

            if (!user.Governorates.some(g => g.governorateID === governorateID)) {
                logger.info(`Governorate ${governorateID} not assigned to user ${userID}, user: ${actorID}`);
                return {
                    userID,
                    governorateID,
                    message: 'Governorate not assigned.',
                    cascadeApplied: { delegations: false, agents: false },
                    affectedCounts: { delegations: 0, agents: 0 },
                };
            }

            const delegations = await Delegation.findAll({ where: { governorateID } });
            const delegationIDs = delegations.map(d => d.delegationID);
            const agents = await Agent.findAll({
                where: {
                    supervisorID: userID,
                    delegationID: { [Op.in]: delegationIDs },
                },
            });

            // Check for required confirmations
            if (delegations.length > 0 && !confirmations.revokeDelegations) {
                logger.warn(`Revoke governorate failed: Delegation confirmation required, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.CASCADE_CONFIRMATION_DELEGATIONS);
            }
            if (agents.length > 0 && !confirmations.revokeAgents) {
                logger.warn(`Revoke governorate failed: Agent confirmation required, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.CASCADE_CONFIRMATION_AGENTS);
            }

            // Perform cascading revocations if confirmed
            if (confirmations.revokeDelegations) {
                for (const delegation of delegations) {
                    await user.removeDelegation(delegation);
                }
            }

            if (confirmations.revokeAgents) {
                for (const agent of agents) {
                    await agent.update({ supervisorID: null, delegationID: null });
                }
            }

            // Revoke the governorate
            await user.removeGovernorate(governorate);
            logger.info(`Revoked governorate ${governorateID} from user ${userID} by user ${actorID}`);
            return {
                userID,
                governorateID,
                message: 'Governorate revoked successfully.',
                cascadeApplied: {
                    delegations: confirmations.revokeDelegations || false,
                    agents: confirmations.revokeAgents || false,
                },
                affectedCounts: {
                    delegations: delegations.length,
                    agents: agents.length,
                },
            };
        } catch (error) {
            logger.error(`Revoke governorate error: ${error.message}, user: ${actorID}`);
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }



    /**
     * Assign a delegation to a user.
     * @param {string} userID - User ID.
     * @param {string} delegationID - Delegation ID.
     * @param {string} actorID - ID of the user performing the action.
     * @returns {Promise<Object>} Assignment details.
     */
    static async assignDelegationToUser(userID, delegationID, actorID) {
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
            logger.info(`Assigned delegation ${delegationID} to user ${userID} by user ${actorID}`);
            return {
                success: true,  // Critical addition
                userID,
                delegationID,
                message: 'Delegation assigned successfully.'
            };
        } catch (error) {
            logger.error(`Assign delegation error: ${error.message}, user: ${actorID}`);
            return { success: false, message: 'Database update failed.' };
        }
    }

    /**
     * Revoke a delegation from a user with cascading confirmation for agents.
     * @param {string} userID - User ID.
     * @param {string} delegationID - Delegation ID.
     * @param {string} actorID - ID of the user performing the action.
     * @param {Object} confirmations - Object containing confirmation flags.
     * @param {boolean} confirmations.revokeAgents - Confirm revocation of agents.
     * @returns {Promise<Object>} Revocation details.
     */
    static async revokeDelegationFromUser(userID, delegationID, actorID, confirmations = {}) {
        if (!userID || !delegationID) {
            logger.warn(`Revoke delegation failed: Missing fields, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID, delegationID });

        try {
            const user = await User.findByPk(userID, {
                include: [
                    { model: Delegation, through: { attributes: [] } },
                    { model: Agent, as: 'Agents' },
                ],
            });
            if (!user) {
                logger.warn(`Revoke delegation failed: User ${userID} not found, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }

            const delegation = await Delegation.findByPk(delegationID);
            if (!delegation) {
                logger.warn(`Revoke delegation failed: Delegation ${delegationID} not found, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.DELEGATION_NOT_FOUND);
            }

            if (!user.Delegations.some(d => d.delegationID === delegationID)) {
                logger.info(`Delegation ${delegationID} not assigned to user ${userID}, user: ${actorID}`);
                return {
                    userID,
                    delegationID,
                    message: 'Delegation not assigned.',
                    cascadeApplied: { agents: false },
                    affectedAgents: 0,
                };
            }

            const affectedAgents = await Agent.findAll({
                where: {
                    supervisorID: userID,
                    delegationID,
                },
            });

            // Check for required confirmation
            if (affectedAgents.length > 0 && !confirmations.revokeAgents) {
                logger.warn(`Revoke delegation failed: Agent confirmation required, user: ${actorID}`);
                throw new Error(ERROR_MESSAGES.CASCADE_CONFIRMATION_AGENTS);
            }

            // Perform cascading revocation of agents if confirmed
            if (confirmations.revokeAgents) {
                for (const agent of affectedAgents) {
                    await agent.update({ supervisorID: null, delegationID: null });
                }
            }

            // Revoke the delegation
            await user.removeDelegation(delegation);
            logger.info(`Revoked delegation ${delegationID} from user ${userID} by user ${actorID}`);
            return {
                userID,
                delegationID,
                message: 'Delegation revoked successfully.',
                cascadeApplied: { agents: confirmations.revokeAgents || false },
                affectedAgents: affectedAgents.length,
            };
        } catch (error) {
            logger.error(`Revoke delegation error: ${error.message}, user: ${actorID}`);
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }


}

module.exports = UserService;