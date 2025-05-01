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
};

class UserService {
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

    static validateInput({ email, phone, password, firstname, lastname, userID, role, ids, googleEmail, regionID, governorateID, delegationID, agentID }) {
        const errors = [];

        if (email !== undefined) {
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                errors.push(ERROR_MESSAGES.INVALID_EMAIL);
            }
        }

        if (phone !== undefined) {
            if (!phone || !/^\d{8,11}$/.test(phone)) {
                errors.push(ERROR_MESSAGES.INVALID_PHONE);
            }
        }

        if (password !== undefined) {
            if (!password || password.length < 6) {
                errors.push(ERROR_MESSAGES.INVALID_PASSWORD);
            }
        }

        if (firstname !== undefined) {
            if (!firstname || !/^[a-zA-Z]{2,50}$/.test(firstname)) {
                errors.push(ERROR_MESSAGES.INVALID_NAME);
            }
        }

        if (lastname !== undefined) {
            if (!lastname || !/^[a-zA-Z]{2,50}$/.test(lastname)) {
                errors.push(ERROR_MESSAGES.INVALID_NAME);
            }
        }

        if (userID !== undefined) {
            if (!userID) {
                errors.push(ERROR_MESSAGES.INVALID_ID);
            }
        }

        if (role !== undefined) {
            if (!role || typeof role !== 'string') {
                errors.push(ERROR_MESSAGES.INVALID_ROLE);
            }
        }

        if (ids !== undefined) {
            if (!Array.isArray(ids) || ids.length === 0) {
                errors.push(ERROR_MESSAGES.INVALID_IDS);
            }
        }

        if (googleEmail !== undefined) {
            if (!googleEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(googleEmail)) {
                errors.push(ERROR_MESSAGES.INVALID_GOOGLE_EMAIL);
            }
        }

        if (regionID !== undefined) {
            if (!regionID) {
                errors.push(ERROR_MESSAGES.INVALID_REGION_ID);
            }
        }

        if (governorateID !== undefined) {
            if (!governorateID) {
                errors.push(ERROR_MESSAGES.INVALID_GOVERNORATE_ID);
            }
        }

        if (delegationID !== undefined) {
            if (!delegationID) {
                errors.push(ERROR_MESSAGES.INVALID_DELEGATION_ID);
            }
        }

        if (agentID !== undefined) {
            if (!agentID) {
                errors.push(ERROR_MESSAGES.INVALID_AGENT_ID);
            }
        }

        if (errors.length > 0) {
            throw new Error(errors.join(' '));
        }
    }

    static async createUser(email, password, firstname, lastname, phone, actorID) {
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
            logger.error(`Keycloak create user error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(ERROR_MESSAGES.KEYCLOAK_CREATE_FAILED);
        }

        // Link Google account in Keycloak
        try {
            await axios.post(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${keycloakUserId}/federated-identity/google`,
                {
                    identityProvider: 'google',
                    userId: keycloakUserId,
                    userName: email,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            logger.error(`Keycloak link Google account error: ${error.message}`, {
                user: actorID,
                keycloakResponse: error.response?.data,
                status: error.response?.status,
            });
            await axios.delete(`${KEYCLOAK_URL}/admin/realms/${REALM}/users/${keycloakUserId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            throw new Error(ERROR_MESSAGES.KEYCLOAK_UPDATE_FAILED);
        }

        // Check for duplicates in local DB
        const existingUser = await User.findOne({
            where: { [Op.or]: [{ email }, { phone }, { googleEmail: email }] },
        });
        if (existingUser) {
            const errors = [];
            if (existingUser.email === email) errors.push(ERROR_MESSAGES.DUPLICATE_EMAIL);
            if (existingUser.phone === phone) errors.push(ERROR_MESSAGES.DUPLICATE_PHONE);
            if (existingUser.googleEmail === email) errors.push(ERROR_MESSAGES.GOOGLE_EMAIL_ALREADY_LINKED);
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
                googleEmail: email,
            });
            return user;
        } catch (error) {
            logger.error(`DB create user error: ${error.message}, user: ${actorID}`, { ip: null });
            await axios.delete(`${KEYCLOAK_URL}/admin/realms/${REALM}/users/${keycloakUserId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            throw new Error(ERROR_MESSAGES.DB_CREATE_FAILED);
        }
    }

    static async updateUser(userID, userData, actorID) {
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
            logger.error(`Keycloak update user error: ${error.message}`, {
                user: actorID,
                keycloakResponse: error.response?.data,
                status: error.response?.status,
            });
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
                logger.error(`Keycloak password update error: ${error.message}, user: ${actorID}`, { ip: null });
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
            logger.error(`DB update user error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    static async deleteUser(userID, actorID) {
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
                logger.error(`Keycloak delete user error: ${error.message}, user: ${actorID}`, { ip: null });
                throw new Error(ERROR_MESSAGES.KEYCLOAK_DELETE_FAILED);
            }
        }

        try {
            await user.destroy();
            return { message: 'User deleted successfully.' };
        } catch (error) {
            logger.error(`DB delete user error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(ERROR_MESSAGES.DB_DELETE_FAILED);
        }
    }

    static async getAllUsers() {
        try {
            const users = await User.findAll({
                include: [
                    { model: Role, through: { attributes: [] }, attributes: ['name'] },
                    { model: Region, through: { attributes: [] }, attributes: ['regionID', 'name'] },
                    { model: Governorate, through: { attributes: [] }, attributes: ['governorateID', 'name'] },
                    { model: Delegation, through: { attributes: [] }, attributes: ['delegationID', 'name'] },
                ],
                attributes: ['userID', 'email', 'firstname', 'lastname', 'phone', 'googleEmail', 'regionalManagerID', 'directorID'],
            });
            if (!users.length) {
                throw new Error(ERROR_MESSAGES.NO_USERS_FOUND);
            }
            return users;
        } catch (error) {
            logger.error(`Get all users error: ${error.message}`, { ip: null });
            throw new Error(error.message || ERROR_MESSAGES.NO_USERS_FOUND);
        }
    }

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
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            return user;
        } catch (error) {
            logger.error(`Get user by phone error: ${error.message}`, { ip: null });
            throw new Error(error.message || ERROR_MESSAGES.USER_NOT_FOUND);
        }
    }

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
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }

            return user;
        } catch (error) {
            logger.error(`Get user by ID error: ${error.message}`, { ip: null });
            throw new Error(error.message || ERROR_MESSAGES.USER_NOT_FOUND);
        }
    }

    static async getUsersByRole(roleName) {
        if (!roleName) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ role: roleName });

        try {
            const role = await Role.findOne({ where: { name: roleName } });
            if (!role) {
                throw new Error(ERROR_MESSAGES.ROLE_NOT_FOUND);
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
                throw new Error(ERROR_MESSAGES.NO_USERS_FOUND);
            }
            return users;
        } catch (error) {
            logger.error(`Get users by role error: ${error.message}`, { ip: null });
            throw new Error(error.message || ERROR_MESSAGES.NO_USERS_FOUND);
        }
    }

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
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            return user.Supervisors || [];
        } catch (error) {
            logger.error(`Get supervisors error: ${error.message}`, { ip: null });
            throw new Error(error.message || ERROR_MESSAGES.NO_SUPERVISORS_FOUND);
        }
    }

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
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            return user.RegionalManager ? [user.RegionalManager] : [];
        } catch (error) {
            logger.error(`Get regional managers error: ${error.message}`, { ip: null });
            throw new Error(error.message || ERROR_MESSAGES.NO_REGIONAL_MANAGERS_FOUND);
        }
    }

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
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            return user.Director ? [user.Director] : [];
        } catch (error) {
            logger.error(`Get director error: ${error.message}`, { ip: null });
            throw new Error(error.message || ERROR_MESSAGES.NO_DIRECTOR_FOUND);
        }
    }

    static async assignRegionalManagerToSupervisor(supervisorID, regionalManagerID, actorID) {
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
            logger.error(`Assign regional manager error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    static async revokeRegionalManagerFromSupervisor(supervisorID, actorID) {
        if (!supervisorID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: supervisorID });

        try {
            const supervisor = await User.findByPk(supervisorID);
            if (!supervisor) {
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            if (!supervisor.regionalManagerID) {
                throw new Error(ERROR_MESSAGES.NO_REGIONAL_MANAGERS_FOUND);
            }

            const regionalManagerID = supervisor.regionalManagerID;
            await supervisor.update({ regionalManagerID: null });
            return {
                supervisorID,
                regionalManagerID,
                message: 'Regional Manager revoked successfully.',
            };
        } catch (error) {
            logger.error(`Revoke regional manager error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    static async assignDirectorToRegionalManager(regionalManagerID, directorID, actorID) {
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
            logger.error(`Assign director error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    static async revokeDirectorFromRegionalManager(regionalManagerID, actorID) {
        if (!regionalManagerID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: regionalManagerID });

        try {
            const regionalManager = await User.findByPk(regionalManagerID);
            if (!regionalManager) {
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            if (!regionalManager.directorID) {
                throw new Error(ERROR_MESSAGES.NO_DIRECTOR_FOUND);
            }

            const directorID = regionalManager.directorID;
            await regionalManager.update({ directorID: null });
            return {
                regionalManagerID,
                directorID,
                message: 'Director revoked successfully.',
            };
        } catch (error) {
            logger.error(`Revoke director error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    static async assignRegionsToRegionalManager(regionalManagerID, regionIDs, actorID) {
        if (!regionalManagerID || !regionIDs) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: regionalManagerID, ids: regionIDs });

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

            const regions = await Region.findAll({ where: { regionID: regionIDs } });
            if (regions.length !== regionIDs.length) {
                throw new Error(ERROR_MESSAGES.REGION_NOT_FOUND);
            }

            await regionalManager.setRegions(regions);
            return {
                regionalManagerID,
                regionIDs,
                message: 'Regions assigned successfully.',
            };
        } catch (error) {
            logger.error(`Assign regions error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    static async revokeRegionsFromRegionalManager(regionalManagerID, regionIDs, actorID) {
        if (!regionalManagerID || !regionIDs) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: regionalManagerID, ids: regionIDs });

        try {
            const regionalManager = await User.findByPk(regionalManagerID);
            if (!regionalManager) {
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }

            const regions = await Region.findAll({ where: { regionID: regionIDs } });
            if (regions.length !== regionIDs.length) {
                throw new Error(ERROR_MESSAGES.REGION_NOT_FOUND);
            }

            await regionalManager.removeRegions(regions);
            return {
                regionalManagerID,
                regionIDs,
                message: 'Regions revoked successfully.',
            };
        } catch (error) {
            logger.error(`Revoke regions error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    static async assignGovernoratesToSupervisor(supervisorID, governorateIDs, actorID) {
        if (!supervisorID || !governorateIDs) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: supervisorID, ids: governorateIDs });

        try {
            const supervisor = await User.findByPk(supervisorID, {
                include: [
                    { model: Role, through: { attributes: [] }, attributes: ['name'] },
                    { model: User, as: 'RegionalManager', include: [{ model: Region }] },
                ],
            });
            if (!supervisor) {
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            if (!supervisor.Roles.some(role => role.name === process.env.ROLE_SUPERVISOR)) {
                throw new Error(ERROR_MESSAGES.INVALID_ROLE_ASSIGNMENT);
            }

            const governorates = await Governorate.findAll({
                where: { governorateID: governorateIDs },
                include: [{ model: Region }],
            });
            if (governorates.length !== governorateIDs.length) {
                throw new Error(ERROR_MESSAGES.GOVERNORATE_NOT_FOUND);
            }

            // Validate that Governorates belong to Regional Manager's Regions
            if (supervisor.RegionalManager) {
                const regionalManagerRegions = supervisor.RegionalManager.Regions.map(r => r.regionID);
                const invalidGovernorates = governorates.filter(g => !regionalManagerRegions.includes(g.regionID));
                if (invalidGovernorates.length > 0) {
                    throw new Error(ERROR_MESSAGES.REGION_NOT_ASSIGNED);
                }
            }

            await supervisor.setGovernorates(governorates);
            return {
                supervisorID,
                governorateIDs,
                message: 'Governorates assigned successfully.',
            };
        } catch (error) {
            logger.error(`Assign governorates error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    static async revokeGovernoratesFromSupervisor(supervisorID, governorateIDs, actorID) {
        if (!supervisorID || !governorateIDs) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: supervisorID, ids: governorateIDs });

        try {
            const supervisor = await User.findByPk(supervisorID);
            if (!supervisor) {
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }

            const governorates = await Governorate.findAll({ where: { governorateID: governorateIDs } });
            if (governorates.length !== governorateIDs.length) {
                throw new Error(ERROR_MESSAGES.GOVERNORATE_NOT_FOUND);
            }

            await supervisor.removeGovernorates(governorates);
            return {
                supervisorID,
                governorateIDs,
                message: 'Governorates revoked successfully.',
            };
        } catch (error) {
            logger.error(`Revoke governorates error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    static async assignDelegationsToSupervisor(supervisorID, delegationIDs, actorID) {
        if (!supervisorID || !delegationIDs) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: supervisorID, ids: delegationIDs });

        try {
            const supervisor = await User.findByPk(supervisorID, {
                include: [
                    { model: Role, through: { attributes: [] }, attributes: ['name'] },
                    { model: User, as: 'RegionalManager', include: [{ model: Region }] },
                ],
            });
            if (!supervisor) {
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            if (!supervisor.Roles.some(role => role.name === process.env.ROLE_SUPERVISOR)) {
                throw new Error(ERROR_MESSAGES.INVALID_ROLE_ASSIGNMENT);
            }

            const delegations = await Delegation.findAll({
                where: { delegationID: delegationIDs },
                include: [{ model: Governorate, include: [{ model: Region }] }],
            });
            if (delegations.length !== delegationIDs.length) {
                throw new Error(ERROR_MESSAGES.DELEGATION_NOT_FOUND);
            }

            // Validate that Delegations belong to Regional Manager's Regions
            if (supervisor.RegionalManager) {
                const regionalManagerRegions = supervisor.RegionalManager.Regions.map(r => r.regionID);
                const invalidDelegations = delegations.filter(d => !regionalManagerRegions.includes(d.Governorate.Region.regionID));
                if (invalidDelegations.length > 0) {
                    throw new Error(ERROR_MESSAGES.REGION_NOT_ASSIGNED);
                }
            }

            await supervisor.setDelegations(delegations);
            return {
                supervisorID,
                delegationIDs,
                message: 'Delegations assigned successfully.',
            };
        } catch (error) {
            logger.error(`Assign delegations error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    static async revokeDelegationsFromSupervisor(supervisorID, delegationIDs, actorID) {
        if (!supervisorID || !delegationIDs) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: supervisorID, ids: delegationIDs });

        try {
            const supervisor = await User.findByPk(supervisorID);
            if (!supervisor) {
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }

            const delegations = await Delegation.findAll({ where: { delegationID: delegationIDs } });
            if (delegations.length !== delegationIDs.length) {
                throw new Error(ERROR_MESSAGES.DELEGATION_NOT_FOUND);
            }

            await supervisor.removeDelegations(delegations);
            return {
                supervisorID,
                delegationIDs,
                message: 'Delegations revoked successfully.',
            };
        } catch (error) {
            logger.error(`Revoke delegations error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    static async assignSupervisorToAgent(agentID, supervisorID, delegationID, actorID) {
        if (!agentID || !supervisorID || !delegationID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: supervisorID, delegationID, agentID });

        try {
            const agent = await Agent.findByPk(agentID);
            if (!agent) {
                throw new Error(ERROR_MESSAGES.AGENT_NOT_FOUND);
            }

            const supervisor = await User.findByPk(supervisorID, {
                include: [
                    { model: Role, through: { attributes: [] }, attributes: ['name'] },
                    { model: Delegation, through: { attributes: [] } },
                ],
            });
            if (!supervisor) {
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            if (!supervisor.Roles.some(role => role.name === process.env.ROLE_SUPERVISOR)) {
                throw new Error(ERROR_MESSAGES.INVALID_ROLE_ASSIGNMENT);
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
                agentID,
                supervisorID,
                delegationID,
                message: 'Supervisor and Delegation assigned successfully.',
            };
        } catch (error) {
            logger.error(`Assign supervisor to agent error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    static async revokeSupervisorFromAgent(agentID, actorID) {
        if (!agentID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ agentID });

        try {
            const agent = await Agent.findByPk(agentID);
            if (!agent) {
                throw new Error(ERROR_MESSAGES.AGENT_NOT_FOUND);
            }
            if (!agent.supervisorID) {
                throw new Error(ERROR_MESSAGES.NO_SUPERVISORS_FOUND);
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
            logger.error(`Revoke supervisor from agent error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }

    static async assignGoogleAccount(userID, googleEmail, actorID) {
        if (!userID || !googleEmail) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID, googleEmail });

        const existingUser = await User.findOne({
            where: { googleEmail, userID: { [Op.ne]: userID } },
        });
        if (existingUser) {
            throw new Error(ERROR_MESSAGES.GOOGLE_EMAIL_ALREADY_LINKED);
        }

        const user = await User.findByPk(userID);
        if (!user) {
            throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        }
        if (!user.keycloakId) {
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
                throw new Error(ERROR_MESSAGES.GOOGLE_EMAIL_ALREADY_LINKED);
            }

            await axios.put(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.keycloakId}`,
                {
                    attributes: {
                        ...user.attributes,
                        googleEmail: googleEmail,
                    },
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            logger.error(`Keycloak assign Google account error: ${error.message}, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.KEYCLOAK_UPDATE_FAILED);
        }

        try {
            await user.update({ googleEmail });
            return user;
        } catch (error) {
            logger.error(`DB update Google account error: ${error.message}, user: ${actorID}`);
            throw new Error(ERROR_MESSAGES.DB_UPDATE_FAILED);
        }
    }
}

module.exports = UserService;