const axios = require('axios');
const { User, Role } = require('../models');
const { Op } = require('sequelize');
require('dotenv').config();

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.REALM || 'TraceFlow';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';

async function getAdminToken() {
    const response = await axios.post(
        `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
        new URLSearchParams({
            grant_type: 'password',
            client_id: 'admin-cli',
            username: ADMIN_USER,
            password: ADMIN_PASS,
        })
    );
    return response.data.access_token;
}

class UserService {
    static async createUser(email, password, firstname, lastname, phone, wallet) {
        try {
            if (!email || !password || !firstname || !lastname || !phone || !wallet) {
                throw new Error('Please fill in all required fields: email, password, first name, last name, phone, and wallet.');
            }

            const token = await getAdminToken();
            // Create user in Keycloak
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

            // Get the Keycloak user ID (sub)
            const location = keycloakResponse.headers.location;
            const keycloakUserId = location.split('/').pop();

            // Sync with local DB
            const [user, created] = await User.findOrCreate({
                where: { userID: keycloakUserId },
                defaults: {
                    userID: keycloakUserId,
                    email,
                    firstname,
                    lastname,
                    phone,
                    wallet,
                    password: 'KEYCLOAK_MANAGED', // Placeholder, not used
                },
            });

            if (!created) {
                const existingUser = await User.findOne({
                    where: { [Op.or]: [{ email }, { phone }, { wallet }] },
                });
                if (existingUser && existingUser.userID !== keycloakUserId) {
                    const conflictFields = [];
                    if (existingUser.email === email) conflictFields.push('email');
                    if (existingUser.phone === phone) conflictFields.push('phone number');
                    if (existingUser.wallet === wallet) conflictFields.push('wallet');
                    throw new Error(`This ${conflictFields.join(', ')} is already in use. Please try a different one.`);
                }
            }

            return user;
        } catch (error) {
            throw new Error(error.response?.data?.errorMessage || error.message || 'Oops! Something went wrong while creating your account.');
        }
    }

    static async getAllUsers() {
        try {
            return await User.findAll({
                include: [{ model: Role, through: { attributes: [] }, attributes: ['name'] }],
            });
        } catch (error) {
            throw new Error(`Failed to fetch users: ${error.message}`);
        }
    }

    static async getUserByPhoneNumber(phone) {
        try {
            const user = await User.findOne({ where: { phone } });
            if (!user) throw new Error('User not found');
            return user;
        } catch (error) {
            throw new Error(`Failed to fetch user: ${error.message}`);
        }
    }

    static async getUserById(userID) {
        try {
            const user = await User.findByPk(userID);
            if (!user) throw new Error('User not found');
            return user;
        } catch (error) {
            throw new Error(`Failed to fetch user: ${error.message}`);
        }
    }

    static async getUsersByRole(roleName) {
        try {
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
        } catch (error) {
            throw new Error(`Failed to fetch users by role: ${error.message}`);
        }
    }

    static async updateUser(userID, userData) {
        try {
            const user = await User.findByPk(userID);
            if (!user) throw new Error('User not found');

            const token = await getAdminToken();
            console.log('Updating user:', userData);
            console.log('User found:', user);
            console.log('Token:', token);
            console.log('Keycloak URL:', `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.keycloakId}`);

            // Update Keycloak user if keycloakId exists
            if (user.keycloakId) {
                await axios.put(
                    `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.keycloakId}`,
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

                // Update password in Keycloak if provided
                if (userData.password) {
                    await axios.put(
                        `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.keycloakId}/reset-password`,
                        {
                            type: 'password',
                            value: userData.password,
                            temporary: false,
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                }
            } else {
                console.warn(`No keycloakId found for user ${userID}. Skipping Keycloak update.`);
            }

            // Update local DB
            if (userData.PFP !== undefined) userData.PFP = userData.PFP;
            await user.update(userData);
            return user;
        } catch (error) {
            console.error(`${new Date().toISOString()} - Update user failed:`, error.response?.data || error);
            throw new Error(`Failed to update user: ${error.response?.data?.errorMessage || error.message}`);
        }
    }

    static async deleteUser(userID) {
        try {
            const token = await getAdminToken();
            await axios.delete(
                `${KEYCLOAK_URL} / admin / realms / ${REALM} / users / ${userID}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const user = await User.findByPk(userID);
            if (user) await user.destroy();
            return { message: 'User deleted successfully' };
        } catch (error) {
            throw new Error(`Failed to delete user: ${error.response?.data?.errorMessage || error.message}`);
        }
    }

    static async getSupervisorsByUser(userID) {
        try {
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
        } catch (error) {
            throw new Error(`Failed to fetch supervisors: ${error.message}`);
        }
    }

    static async getManagersByUser(userID) {
        try {
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
        } catch (error) {
            throw new Error(`Failed to fetch managers: ${error.message}`);
        }
    }

    static async assignSupervisorsToManager(managerID, supervisorIDs) {
        try {
            const manager = await User.findByPk(managerID);
            if (!manager) throw new Error('Manager not found');

            const supervisors = await User.findAll({ where: { userID: supervisorIDs } });
            if (supervisors.length !== supervisorIDs.length) throw new Error('One or more supervisors not found');

            const currentSupervisors = await manager.getSupervisors();
            const currentSupervisorIDs = currentSupervisors.map(s => s.userID);
            const newSupervisors = supervisorIDs.filter(id => !currentSupervisorIDs.includes(id));

            if (newSupervisors.length > 0) await manager.addSupervisors(newSupervisors);

            return {
                managerID,
                assignedSupervisors: supervisors.map(s => s.userID),
                message: 'Supervisors assigned successfully',
            };
        } catch (error) {
            throw new Error(`Failed to assign supervisors: ${error.message}`);
        }
    }

    static async revokeSupervisorsFromManager(managerID, supervisorIDs) {
        try {
            const manager = await User.findByPk(managerID);
            if (!manager) throw new Error('Manager not found');

            const supervisors = await User.findAll({ where: { userID: supervisorIDs } });
            if (supervisors.length !== supervisorIDs.length) throw new Error('One or more supervisors not found');

            const currentSupervisors = await manager.getSupervisors();
            const currentSupervisorIDs = currentSupervisors.map(s => s.userID);
            const revokedSupervisors = supervisorIDs.filter(id => currentSupervisorIDs.includes(id));

            if (revokedSupervisors.length > 0) await manager.removeSupervisors(revokedSupervisors);

            return {
                managerID,
                revokedSupervisors,
                message: 'Supervisors revoked successfully',
            };
        } catch (error) {
            throw new Error(`Failed to revoke supervisors: ${error.message}`);
        }
    }
}

module.exports = UserService;