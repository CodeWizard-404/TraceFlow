const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { User, Role, OTP, Permission } = require('../models');

class UserService {
    // Create a user (simplified for this example)
    async createUser(email, password, firstname, lastname, phone, wallet) {
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
    async getAllUsers() {
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
    async getIdByPhoneNumber(phone) {
        try {
            const user = await User.findOne({
                where: { phone },
                attributes: ['userID'],
            });
            if (!user) throw new Error('User not found');
            return user.userID;
        } catch (error) {
            throw new Error(`Failed to fetch user ID: ${error.message}`);
        }
    }



    // Get a user by ID
    async getUserById(userID) {
        try {
            const user = await User.findByPk(userID);
            if (!user) throw new Error('User not found');
            return user;
        } catch (error) {
            throw new Error(`Failed to fetch user: ${error.message}`);
        }
    }
    // Update a user
    async updateUser(userID, userData) {
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
    async deleteUser(userID) {
        try {
            const user = await User.findByPk(userID);
            if (!user) throw new Error('User not found');
            await user.destroy();
            return { message: 'User deleted successfully' };
        } catch (error) {
            throw new Error(`Failed to delete user: ${error.message}`);
        }
    }

    // Assign roles to a user
    async assignRolesToUser(userID, roleIDs) {
        try {
            const user = await User.findByPk(userID);
            if (!user) throw new Error('User not found');

            const roles = await Role.findAll({
                where: { roleID: roleIDs },
            });
            if (roles.length !== roleIDs.length) {
                throw new Error('One or more roles not found');
            }

            const currentRoles = await user.getRoles();
            const currentRoleIDs = currentRoles.map(r => r.roleID);
            const newRoles = roles.filter(r => !currentRoleIDs.includes(r.roleID));

            if (newRoles.length > 0) {
                await user.addRoles(newRoles);
            }

            return {
                userID,
                assignedRoles: newRoles.map(r => r.name),
                totalAssigned: (await user.getRoles()).length,
            };
        } catch (error) {
            throw new Error(`Failed to assign roles: ${error.message}`);
        }
    }

    // Get roles by user
    async getRolesByUser(userID) {
        try {
            const user = await User.findByPk(userID, {
                include: [{
                    model: Role,
                    through: { attributes: [] },
                    attributes: ['roleID', 'name', 'description'],
                    include: [{
                        model: Permission,
                        through: { attributes: [] },
                        attributes: ['name', 'description'],
                    }],
                }],
            });
            if (!user) throw new Error('User not found');
            return user.Roles;
        } catch (error) {
            throw new Error(`Failed to fetch roles for user: ${error.message}`);
        }
    }


    // Assign supervisors to a manager
    async assignSupervisorsToManager(managerID, supervisorIDs) {
        try {
            const manager = await User.findByPk(managerID);
            if (!manager) throw new Error('Manager not found');

            const supervisors = await User.findAll({
                where: { userID: supervisorIDs },
            });
            if (supervisors.length !== supervisorIDs.length) {
                throw new Error('One or more supervisors not found');
            }

            // Assign supervisors to the manager
            await manager.setSupervisors(supervisorIDs);

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

module.exports = new UserService();