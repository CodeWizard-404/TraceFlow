const bcrypt = require('bcrypt');
const { User, Role, Permission, UserPermissionOverride } = require('../models');

class UserService {
    // Create a user (simplified for this example)
    static async createUser(email, password, firstname, lastname, phone, wallet) {
        try {
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
            if (!created) throw new Error('User already exists');
            return user;
        } catch (error) {
            throw new Error(`Failed to create user: ${error.message}`);
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
    // Update a user
    static async updateUser(userID, userData) {
        try {
            const user = await User.findByPk(userID);
            if (!user) throw new Error('User not found');
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


}

module.exports = UserService;