const bcrypt = require('bcrypt');
const { User, Role } = require('../models');
const { Op } = require('sequelize');

class UserService {
    // Create a user (simplified for this example)
    static async createUser(email, password, firstname, lastname, phone, wallet) {
        try {
            // Manual input validation with friendly message
            if (!email || !password || !firstname || !lastname || !phone || !wallet) {
                throw new Error('Please fill in all required fields: email, password, first name, last name, phone, and wallet.');
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const [user, created] = await User.findOrCreate({
                where: { phone },
                defaults: {
                    email,
                    password: hashedPassword,
                    firstname,
                    lastname,
                    phone,
                    wallet,
                },
            });

            if (!created) {
                const existingUser = await User.findOne({
                    where: {
                        [Op.or]: [{ email }, { phone }, { wallet }],
                    },
                });
                if (existingUser) {
                    const conflictFields = [];
                    if (existingUser.email === email) conflictFields.push('email');
                    if (existingUser.phone === phone) conflictFields.push('phone number');
                    if (existingUser.wallet === wallet) conflictFields.push('wallet');
                    throw new Error(`This ${conflictFields.join(', ')} is already in use. Please try a different one.`);
                }
                throw new Error('This phone number is already registered. Please use a different one.');
            }
            return user;
        } catch (error) {
            // Handle Sequelize-specific errors with friendly messages
            if (error.name === 'SequelizeUniqueConstraintError') {
                const field = error.fields[0];
                const friendlyField = field === 'email' ? 'email' : field === 'phone' ? 'phone number' : 'wallet';
                throw new Error(`This ${friendlyField} is already taken. Please choose another one.`);
            }
            if (error.name === 'SequelizeValidationError') {
                const details = error.errors.map(err => {
                    const field = err.path === 'email' ? 'email' : err.path === 'phone' ? 'phone number' : err.path;
                    return `The ${field} you entered isn’t valid.`;
                }).join(' ');
                throw new Error(details || 'Something’s wrong with the information you provided. Please check and try again.');
            }
            throw new Error(error.message || 'Oops! Something went wrong while creating your account. Please try again later.');
        }
    }

    // Get all users
    static async getAllUsers() {
        try {
            return await User.findAll({
                include: [{
                    model: Role,
                    through: { attributes: [] },
                    attributes: ['name'],
                }],
            });
        } catch (error) {
            throw new Error(`Failed to fetch users: ${error.message}`);
        }
    }

    // Get a user ID by phone number
    static async getUserByPhoneNumber(phone) {
        try {
            const user = await User.findOne({
                where: { phone },
            });
            if (!user) throw new Error('User not found');
            return user;
        } catch (error) {
            throw new Error(`Failed to fetch user ID: ${error.message}`);
        }
    }

    // Get a user by ID
    static async getUserById(userID) {
        try {
            const user = await User.findByPk(userID);
            if (!user) throw new Error('User not found');
            return user;
        } catch (error) {
            throw new Error(`Failed to fetch user: ${error.message}`);
        }
    }

    // Get Users By role
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

    // Update a user
    static async updateUser(userID, userData) {
        try {
            const user = await User.findByPk(userID);
            if (!user) throw new Error('User not found');

            if (userData.password) {
                userData.password = await bcrypt.hash(userData.password, 10);
            }

            if (userData.PFP !== undefined) {
                userData.PFP = userData.PFP; // Buffer from multer memoryStorage
            }

            await user.update(userData);
            return user;
        } catch (error) {
            throw new Error(`Failed to update user: ${error.message}`);
        }
    }
    // Delete a user
    static async deleteUser(userID) {
        try {
            const user = await User.findByPk(userID);
            if (!user) throw new Error('User not found');
            await user.destroy();
            return { message: 'User deleted successfully' };
        } catch (error) {
            throw new Error(`Failed to delete user: ${error.message}`);
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

    // Update assignSupervisorsToManager to ensure it works bidirectionally
    static async assignSupervisorsToManager(managerID, supervisorIDs) {
        try {
            const manager = await User.findByPk(managerID);
            if (!manager) throw new Error('Manager not found');

            const supervisors = await User.findAll({
                where: { userID: supervisorIDs },
            });
            if (supervisors.length !== supervisorIDs.length) {
                throw new Error('One or more supervisors not found');
            }

            // Fetch current supervisors
            const currentSupervisors = await manager.getSupervisors();
            const currentSupervisorIDs = currentSupervisors.map(s => s.userID);
            const newSupervisors = supervisorIDs.filter(id => !currentSupervisorIDs.includes(id));

            if (newSupervisors.length > 0) {
                await manager.addSupervisors(newSupervisors);
            }

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

            const supervisors = await User.findAll({
                where: { userID: supervisorIDs },
            });
            if (supervisors.length !== supervisorIDs.length) {
                throw new Error('One or more supervisors not found');
            }

            // Fetch current supervisors
            const currentSupervisors = await manager.getSupervisors();
            const currentSupervisorIDs = currentSupervisors.map(s => s.userID);
            const revokedSupervisors = supervisorIDs.filter(id => currentSupervisorIDs.includes(id));

            if (revokedSupervisors.length > 0) {
                await manager.removeSupervisors(revokedSupervisors);
            }

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