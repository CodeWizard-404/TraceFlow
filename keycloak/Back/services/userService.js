const axios = require('axios');
const { User, Role } = require('../models');
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
    INVALID_WALLET: 'Please enter a valid wallet address.',
    INVALID_PASSWORD: 'Password must be at least 6 characters.',
    INVALID_NAME: 'Names must be 2–50 characters and contain only letters.',
    INVALID_ID: 'Invalid user ID',
    DUPLICATE_EMAIL: 'This email is already in use.',
    DUPLICATE_PHONE: 'This phone number is already in use.',
    DUPLICATE_WALLET: 'This wallet is already in use.',
    USER_NOT_FOUND: 'User not found.',
    ROLE_NOT_FOUND: 'Role not found.',
    NO_USERS_FOUND: 'No users found.',
    NO_SUPERVISORS_FOUND: 'No supervisors found.',
    NO_MANAGERS_FOUND: 'No managers found.',
    MANAGER_NOT_FOUND: 'Manager not found.',
    SUPERVISOR_NOT_FOUND: 'One or more supervisors not found.',
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
    INVALID_SUPERVISOR_IDS: 'Supervisor IDs must be a valid array.',
    INVALID_GOOGLE_EMAIL: 'Please enter a valid Google email address.',
    GOOGLE_EMAIL_ALREADY_LINKED: 'This Google email is already linked to another user.',
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

    static validateInput({ email, phone, wallet, password, firstname, lastname, userID, role, supervisorIDs }) {
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

        if (wallet !== undefined) {
            if (!wallet || !/^[a-zA-Z0-9]{10,50}$/.test(wallet)) {
                errors.push(ERROR_MESSAGES.INVALID_WALLET);
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

        if (supervisorIDs !== undefined) {
            if (!Array.isArray(supervisorIDs) || supervisorIDs.length === 0) {
                errors.push(ERROR_MESSAGES.INVALID_SUPERVISOR_IDS);
            }
        }

        if (errors.length > 0) {
            throw new Error(errors.join(' '));
        }
    }

    static async createUser(email, password, firstname, lastname, phone, wallet, actorID) {
        if (!email || !password || !firstname || !lastname || !phone || !wallet) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ email, phone, wallet, password, firstname, lastname });

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
                    userId: keycloakUserId, // Use Keycloak user ID as Google user ID
                    userName: email, // Use email as Google username
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            logger.error(`Keycloak link Google account error: ${error.message}`, {
                user: actorID,
                keycloakResponse: error.response?.data,
                status: error.response?.status,
            });
            // Roll back Keycloak user creation if Google linking fails
            await axios.delete(`${KEYCLOAK_URL}/admin/realms/${REALM}/users/${keycloakUserId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            throw new Error(ERROR_MESSAGES.KEYCLOAK_UPDATE_FAILED);
        }

        // Check for duplicates in local DB
        const existingUser = await User.findOne({
            where: { [Op.or]: [{ email }, { phone }, { wallet }, { googleEmail: email }] },
        });
        if (existingUser) {
            const errors = [];
            if (existingUser.email === email) errors.push(ERROR_MESSAGES.DUPLICATE_EMAIL);
            if (existingUser.phone === phone) errors.push(ERROR_MESSAGES.DUPLICATE_PHONE);
            if (existingUser.wallet === wallet) errors.push(ERROR_MESSAGES.DUPLICATE_WALLET);
            if (existingUser.googleEmail === email) errors.push(ERROR_MESSAGES.GOOGLE_EMAIL_ALREADY_LINKED);
            // Roll back Keycloak user creation if DB check fails
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
                wallet,
                password: 'KEYCLOAK_MANAGED',
                googleEmail: email, // Store the same email as googleEmail
            });
            return user;
        } catch (error) {
            logger.error(`DB create user error: ${error.message}, user: ${actorID}`, { ip: null });
            // Roll back Keycloak user creation if DB save fails
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
            wallet: userData.wallet,
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
        if (userData.email || userData.phone || userData.wallet) {
            const existingUser = await User.findOne({
                where: {
                    [Op.or]: [
                        userData.email ? { email: userData.email } : null,
                        userData.email ? { googleEmail: userData.email } : null,
                        userData.phone ? { phone: userData.phone } : null,
                        userData.wallet ? { wallet: userData.wallet } : null,
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
                if (userData.wallet && existingUser.wallet === userData.wallet) {
                    errors.push(ERROR_MESSAGES.DUPLICATE_WALLET);
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

            // Update Google federated identity if email changed
            if (userData.email && userData.email !== user.email) {
                // Remove existing Google identity
                await axios.delete(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.keycloakId}/federated-identity/google`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                // Add new Google identity
                await axios.post(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.keycloakId}/federated-identity/google`,
                    {
                        identityProvider: 'google',
                        userId: user.keycloakId, // Keep Keycloak user ID as Google user ID
                        userName: userData.email, // Use new email
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
                wallet: userData.wallet || user.wallet,
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

        // Delete from Keycloak
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

        // Delete from local DB
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
                include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
                attributes: ['userID', 'email', 'firstname', 'lastname', 'phone', 'wallet', 'googleEmail'],
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
                include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
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
            // Fetch user by userID in the local DB
            let user = await User.findByPk(userID, {
                include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
            });

            if (!user) {
                // If no user is found with userID, fetch by keycloakId in the local DB
                user = await User.findOne({
                    where: { keycloakId: userID },
                    include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
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
                        through: { attributes: [] },
                        attributes: ['userID', 'firstname', 'lastname', 'email', 'phone'],
                    },
                ],
            });
            if (!user) {
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            return user.Supervisors || [];
        } catch (error) {
            logger.error(`Get supervisors error: ${error.message}`, { ip: null });
            if (error.message === ERROR_MESSAGES.USER_NOT_FOUND) {
                throw new Error(error.message);
            }
            return [];
        }
    }

    static async getManagersByUser(userID) {
        if (!userID) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID });

        try {
            const user = await User.findByPk(userID, {
                include: [
                    {
                        model: User,
                        as: 'Managers',
                        through: { attributes: [] },
                        attributes: ['userID', 'firstname', 'lastname', 'email', 'phone'],
                    },
                ],
            });
            if (!user) {
                throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            return user.Managers || [];
        } catch (error) {
            logger.error(`Get managers error: ${error.message}`, { ip: null });
            if (error.message === ERROR_MESSAGES.USER_NOT_FOUND) {
                throw new Error(error.message);
            }
            return [];
        }
    }

    static async assignSupervisorsToManager(managerID, supervisorIDs, actorID) {
        if (!managerID || !supervisorIDs) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: managerID, supervisorIDs });

        try {
            const manager = await User.findByPk(managerID);
            if (!manager) {
                throw new Error(ERROR_MESSAGES.MANAGER_NOT_FOUND);
            }
            const supervisors = await User.findAll({ where: { userID: supervisorIDs } });
            if (supervisors.length !== supervisorIDs.length) {
                throw new Error(ERROR_MESSAGES.SUPERVISOR_NOT_FOUND);
            }
            const currentSupervisors = await manager.getSupervisors();
            const newSupervisors = supervisors.filter(
                (s) => !currentSupervisors.some((cs) => cs.userID === s.userID)
            );
            if (newSupervisors.length > 0) {
                await manager.addSupervisors(newSupervisors);
            }
            return {
                managerID,
                assignedSupervisors: newSupervisors.map((s) => s.userID),
                totalAssigned: (await manager.getSupervisors()).length,
            };
        } catch (error) {
            logger.error(`Assign supervisors error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || ERROR_MESSAGES.SUPERVISOR_NOT_FOUND);
        }
    }

    static async revokeSupervisorsFromManager(managerID, supervisorIDs, actorID) {
        if (!managerID || !supervisorIDs) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        this.validateInput({ userID: managerID, supervisorIDs });

        try {
            const manager = await User.findByPk(managerID);
            if (!manager) {
                throw new Error(ERROR_MESSAGES.MANAGER_NOT_FOUND);
            }
            const supervisors = await User.findAll({ where: { userID: supervisorIDs } });
            if (supervisors.length !== supervisorIDs.length) {
                throw new Error(ERROR_MESSAGES.SUPERVISOR_NOT_FOUND);
            }
            const currentSupervisors = await manager.getSupervisors();
            const revokedSupervisors = supervisors.filter((s) =>
                currentSupervisors.some((cs) => cs.userID === s.userID)
            );
            if (revokedSupervisors.length > 0) {
                await manager.removeSupervisors(revokedSupervisors);
            }
            return {
                managerID,
                revokedSupervisors: revokedSupervisors.map((s) => s.userID),
                totalAssigned: (await manager.getSupervisors()).length,
            };
        } catch (error) {
            logger.error(`Revoke supervisors error: ${error.message}, user: ${actorID}`, { ip: null });
            throw new Error(error.message || ERROR_MESSAGES.SUPERVISOR_NOT_FOUND);
        }
    }
    static async assignGoogleAccount(userID, googleEmail, actorID) {
        if (!userID || !googleEmail) {
            throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
        }

        // Validate Google email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(googleEmail)) {
            throw new Error(ERROR_MESSAGES.INVALID_GOOGLE_EMAIL);
        }

        // Check if the Google email is already linked to another user in the local DB
        const existingUser = await User.findOne({
            where: { googleEmail, userID: { [Op.ne]: userID } },
        });
        if (existingUser) {
            throw new Error(ERROR_MESSAGES.GOOGLE_EMAIL_ALREADY_LINKED);
        }

        // Find the user
        const user = await User.findByPk(userID);
        if (!user) {
            throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        }
        if (!user.keycloakId) {
            throw new Error(ERROR_MESSAGES.USER_NOT_SYNCED);
        }

        const token = await this.getAdminToken();

        // Update Keycloak user to link Google identity
        try {
            // Check if the Google identity is already linked
            const federatedIdentities = await axios.get(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.keycloakId}/federated-identity`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const googleIdentity = federatedIdentities.data.find(id => id.identityProvider === 'google');
            if (googleIdentity) {
                throw new Error(ERROR_MESSAGES.GOOGLE_EMAIL_ALREADY_LINKED);
            }

            // Link Google identity (Keycloak requires the user to authenticate with Google to complete the linking)
            // Instead, we'll store the Google email as an attribute and update the local DB
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

        // Update local DB
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