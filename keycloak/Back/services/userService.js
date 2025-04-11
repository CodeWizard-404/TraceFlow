const axios = require('axios');
const { User, Role } = require('../models');
const { Op } = require('sequelize');
require('dotenv').config();

// Keycloak configuration
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';

// Get admin token for Keycloak
async function getAdminToken() {
    const response = await axios.post(
        `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
        new URLSearchParams({
            grant_type: 'password',
            client_id: 'admin-cli',
            username: process.env.ADMIN_USER,
            password: process.env.ADMIN_PASS,
        })
    );
    return response.data.access_token;
}

class UserService {
    // Create a new user in both local DB and Keycloak
    static async createUser(email, password, firstname, lastname, phone, wallet) {
        if (!email || !password || !firstname || !lastname || !phone || !wallet) {
            throw new Error('All fields (email, password, firstname, lastname, phone, wallet) are required');
        }

        const token = await getAdminToken();

        // Step 1: Create the user in Keycloak
        const keycloakResponse = await axios.post(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users`,
            {
                username: email,
                email,
                firstName: firstname,
                lastName: lastname,
                enabled: true,
                attributes: { phone, wallet },
                credentials: [{ type: 'password', value: password, temporary: false }],
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const keycloakUserId = keycloakResponse.headers.location.split('/').pop();
        console.log(`Created user ${email} in Keycloak with ID ${keycloakUserId}`);

        // Step 2: Create or sync the user in the local DB
        const [user, created] = await User.findOrCreate({
            where: { userID: keycloakUserId },
            defaults: {
                userID: keycloakUserId,
                email,
                firstname,
                lastname,
                phone,
                wallet,
                password: 'KEYCLOAK_MANAGED', // Password is managed by Keycloak
            },
        });

        if (!created) {
            const existingUser = await User.findOne({
                where: { [Op.or]: [{ email }, { phone }, { wallet }] },
            });
            if (existingUser && existingUser.userID !== keycloakUserId) {
                const conflicts = [];
                if (existingUser.email === email) conflicts.push('email');
                if (existingUser.phone === phone) conflicts.push('phone');
                if (existingUser.wallet === wallet) conflicts.push('wallet');
                throw new Error(`Conflict: ${conflicts.join(', ')} already in use`);
            }
        }

        console.log(`Created user ${email} in local DB`);
        return user;
    }

    // Get all users from the local database
    static async getAllUsers() {
        return await User.findAll({
            include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
            attributes: ['userID', 'email', 'firstname', 'lastname', 'phone', 'wallet'],
        });
    }

    // Get a user by phone number
    static async getUserByPhoneNumber(phone) {
        const user = await User.findOne({
            where: { phone },
            include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
        });
        if (!user) throw new Error('User not found');
        return user;
    }

    // Get a user by ID
    static async getUserById(userID) {
        const user = await User.findByPk(userID, {
            include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
        });
        if (!user) throw new Error('User not found');
        return user;
    }

    // Get users by role name
    static async getUsersByRole(roleName) {
        const role = await Role.findOne({ where: { name: roleName } });
        if (!role) throw new Error('Role not found');

        const users = await User.findAll({
            include: [{
                model: Role,
                through: { attributes: [] },
                where: { roleID: role.roleID },
                attributes: [],
            }],
        });
        return users;
    }

    // Update a user’s details in both local DB and Keycloak
    static async updateUser(userID, userData) {
        const user = await User.findByPk(userID);
        if (!user) throw new Error('User not found');

        const token = await getAdminToken();

        // Step 1: Update Keycloak user
        await axios.put(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userID}`,
            {
                email: userData.email || user.email,
                firstName: userData.firstname || user.firstname,
                lastName: userData.lastname || user.lastname,
                attributes: {
                    phone: userData.phone || user.phone,
                    wallet: userData.wallet || user.wallet,
                },
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        // Step 2: Update password in Keycloak if provided
        if (userData.password) {
            await axios.put(
                `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userID}/reset-password`,
                {
                    type: 'password',
                    value: userData.password,
                    temporary: false,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log(`Updated password for user ${userID} in Keycloak`);
        }
        console.log(`Updated user ${userID} in Keycloak`);

        // Step 3: Update the local DB, including PFP if provided
        await user.update({
            email: userData.email || user.email,
            firstname: userData.firstname || user.firstname,
            lastname: userData.lastname || user.lastname,
            phone: userData.phone || user.phone,
            wallet: userData.wallet || user.wallet,
            PFP: userData.PFP !== undefined ? userData.PFP : user.PFP, // Update PFP if provided
        });
        console.log(`Updated user ${userID} in local DB`);

        return user;
    }

    // Delete a user from both local DB and Keycloak
    static async deleteUser(userID) {
        const user = await User.findByPk(userID);
        if (!user) throw new Error('User not found');

        const token = await getAdminToken();

        // Step 1: Delete the user from Keycloak
        await axios.delete(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userID}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(`Deleted user ${userID} from Keycloak`);

        // Step 2: Delete the user from the local DB
        await user.destroy();
        console.log(`Deleted user ${userID} from local DB`);

        return { message: 'User deleted successfully' };
    }

    // Get supervisors assigned to a user
    static async getSupervisorsByUser(userID) {
        const user = await User.findByPk(userID, {
            include: [{
                model: User,
                as: 'Supervisors',
                through: { attributes: [] },
                attributes: ['userID', 'firstname', 'lastname', 'email', 'phone'],
            }],
        });
        if (!user) throw new Error('User not found');
        return user.Supervisors;
    }

    // Get managers assigned to a user
    static async getManagersByUser(userID) {
        const user = await User.findByPk(userID, {
            include: [{
                model: User,
                as: 'Managers',
                through: { attributes: [] },
                attributes: ['userID', 'firstname', 'lastname', 'email', 'phone'],
            }],
        });
        if (!user) throw new Error('User not found');
        return user.Managers;
    }

    // Assign supervisors to a manager in the local DB
    static async assignSupervisorsToManager(managerID, supervisorIDs) {
        const manager = await User.findByPk(managerID);
        if (!manager) throw new Error('Manager not found');

        const supervisors = await User.findAll({ where: { userID: supervisorIDs } });
        if (supervisors.length !== supervisorIDs.length) throw new Error('One or more supervisors not found');

        const currentSupervisors = await manager.getSupervisors();
        const currentSupervisorIDs = currentSupervisors.map(s => s.userID);
        const newSupervisors = supervisors.filter(s => !currentSupervisorIDs.includes(s.userID));

        if (newSupervisors.length > 0) {
            await manager.addSupervisors(newSupervisors);
            console.log(`Assigned ${newSupervisors.length} supervisors to manager ${managerID} in local DB`);
        }

        return {
            managerID,
            assignedSupervisors: newSupervisors.map(s => s.userID),
            totalAssigned: (await manager.getSupervisors()).length,
        };
    }

    // Revoke supervisors from a manager in the local DB
    static async revokeSupervisorsFromManager(managerID, supervisorIDs) {
        const manager = await User.findByPk(managerID);
        if (!manager) throw new Error('Manager not found');

        const supervisors = await User.findAll({ where: { userID: supervisorIDs } });
        if (supervisors.length !== supervisorIDs.length) throw new Error('One or more supervisors not found');

        const currentSupervisors = await manager.getSupervisors();
        const currentSupervisorIDs = currentSupervisors.map(s => s.userID);
        const revokedSupervisors = supervisors.filter(s => currentSupervisorIDs.includes(s.userID));

        if (revokedSupervisors.length > 0) {
            await manager.removeSupervisors(revokedSupervisors);
            console.log(`Revoked ${revokedSupervisors.length} supervisors from manager ${managerID} in local DB`);
        }

        return {
            managerID,
            revokedSupervisors: revokedSupervisors.map(s => s.userID),
            totalAssigned: (await manager.getSupervisors()).length,
        };
    }
}

module.exports = UserService;