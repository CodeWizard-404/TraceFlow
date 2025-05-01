const UserService = require('../services/userService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

class UserController {
    // --- User Retrieval Methods ---

    static async getAllUsers(req, res) {
        try {
            const users = await UserService.getAllUsers();
            logger.info(`Fetched all users by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(users);
        } catch (error) {
            logger.error(`Fetch users error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(500).json({ error: 'Failed to fetch users' });
        }
    }

    static async getUserByPhoneNumber(req, res) {
        try {
            const { phone } = req.params;
            if (!phone) {
                logger.warn(`Get user by phone failed: Missing phone, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Phone number is required' });
            }
            const user = await UserService.getUserByPhoneNumber(phone);
            logger.info(`Fetched user by phone ${phone} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(user);
        } catch (error) {
            logger.error(`Get user by phone error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(404).json({ error: 'User not found' });
        }
    }

    static async getUsersByRole(req, res) {
        try {
            const { role } = req.params;
            if (!role) {
                logger.warn(`Get users by role failed: Missing role, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Role is required' });
            }
            const users = await UserService.getUsersByRole(role);
            logger.info(`Fetched users by role ${role} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(users);
        } catch (error) {
            logger.error(`Get users by role error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: 'Failed to fetch users by role' });
        }
    }

    static async getUserById(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Get user by ID failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            const user = await UserService.getUserById(userID);
            logger.info(`Fetched user ${userID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(user);
        } catch (error) {
            logger.error(`Get user by ID error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(404).json({ error: 'User not found' });
        }
    }

    static async getProfile(req, res) {
        try {
            const userID = req.user?.userID;
            if (!userID) {
                logger.warn(`Get profile failed: Not authenticated, IP: ${req.ip}`);
                return res.status(401).json({ error: 'Please log in to view your profile' });
            }
            const user = await UserService.getUserById(userID);
            const responseUser = user.toJSON();
            if (responseUser.PFP) {
                responseUser.PFP = responseUser.PFP.toString('base64');
            }
            logger.info(`Fetched profile for user ${userID}, IP: ${req.ip}`);
            return res.status(200).json(responseUser);
        } catch (error) {
            logger.error(`Get profile error: ${error.message}, user: ${req.user?.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: 'Failed to fetch profile' });
        }
    }

    static async getSupervisorsByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Get supervisors failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            const supervisors = await UserService.getSupervisorsByUser(userID);
            logger.info(`Fetched supervisors for user ${userID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(supervisors);
        } catch (error) {
            logger.error(`Get supervisors error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(404).json({ error: 'Supervisors not found' });
        }
    }

    static async getRegionalManagersByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Get regional managers failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            const regionalManagers = await UserService.getRegionalManagersByUser(userID);
            logger.info(`Fetched regional managers for user ${userID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(regionalManagers);
        } catch (error) {
            logger.error(`Get regional managers error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(404).json({ error: 'Regional Managers not found' });
        }
    }

    static async getDirectorByUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Get director failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            const director = await UserService.getDirectorByUser(userID);
            logger.info(`Fetched director for user ${userID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(director);
        } catch (error) {
            logger.error(`Get director error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(404).json({ error: 'Director not found' });
        }
    }

    // --- User Modification Methods ---

    static async createUser(req, res) {
        try {
            const { email, password, firstname, lastname, phone } = req.body;
            if (!email || !password || !firstname || !lastname || !phone) {
                logger.warn(`Create user failed: Missing fields, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'All fields are required' });
            }
            const user = await UserService.createUser(email, password, firstname, lastname, phone, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:created',
                data: { userID: user.userID, email },
                metadata: { createdBy: req.user.email }
            });
            logger.info(`User created: ${email} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(201).json(user);
        } catch (error) {
            logger.error(`Create user error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    static async updateUser(req, res) {
        try {
            const { userID } = req.params;
            const userData = req.body;
            if (!userID) {
                logger.warn(`Update user failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            if (req.file) {
                if (!req.file.mimetype.startsWith('image/')) {
                    logger.warn(`Update user failed: Invalid image, user: ${req.user.userID}, IP: ${req.ip}`);
                    return res.status(400).json({ error: 'Please upload a valid image' });
                }
                userData.PFP = req.file.buffer;
            } else if (userData.removePFP === true) {
                userData.PFP = null;
            }
            const updatedUser = await UserService.updateUser(userID, userData, req.user.userID);
            const responseUser = updatedUser.toJSON();
            if (responseUser.PFP) {
                responseUser.PFP = responseUser.PFP.toString('base64');
            } else {
                delete responseUser.PFP;
            }
            await NotificationService.triggerNotification({
                event: 'user:updated',
                data: { userID, email: updatedUser.email },
                metadata: { updatedBy: req.user.email }
            });
            logger.info(`Updated user ${userID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(responseUser);
        } catch (error) {
            logger.error(`Update user error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    static async updateProfile(req, res) {
        try {
            const userID = req.user?.userID;
            if (!userID) {
                logger.warn(`Update profile failed: Not authenticated, IP: ${req.ip}`);
                return res.status(401).json({ error: 'Please log in to update your profile' });
            }
            const userData = req.body;
            if (req.file) {
                if (!req.file.mimetype.startsWith('image/')) {
                    logger.warn(`Update profile failed: Invalid image, user: ${req.user.userID}, IP: ${req.ip}`);
                    return res.status(400).json({ error: 'Please upload a valid image' });
                }
                userData.PFP = req.file.buffer;
            } else if (userData.removePFP === true) {
                userData.PFP = null;
            }
            const updatedUser = await UserService.updateUser(userID, userData, req.user.userID);
            const responseUser = updatedUser.toJSON();
            if (responseUser.PFP) {
                responseUser.PFP = responseUser.PFP.toString('base64');
            } else {
                delete responseUser.PFP;
            }
            await NotificationService.triggerNotification({
                event: 'user:profile_updated',
                data: { userID, email: updatedUser.email },
                metadata: { updatedBy: req.user.email }
            });
            logger.info(`Updated profile for user ${userID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(responseUser);
        } catch (error) {
            logger.error(`Update profile error: ${error.message}, user: ${req.user?.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    static async deleteUser(req, res) {
        try {
            const { userID } = req.params;
            if (!userID) {
                logger.warn(`Delete user failed: Missing userID, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID is required' });
            }
            const result = await UserService.deleteUser(userID, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:deleted',
                data: { userID },
                metadata: { deletedBy: req.user.email }
            });
            logger.info(`Deleted user ${userID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Delete user error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    static async assignRegionalManagerToSupervisor(req, res) {
        try {
            const { supervisorID, regionalManagerID } = req.body;
            if (!supervisorID || !regionalManagerID) {
                logger.warn(`Assign regional manager failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Supervisor ID and Regional Manager ID are required' });
            }
            const result = await UserService.assignRegionalManagerToSupervisor(supervisorID, regionalManagerID, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:regional_manager_assigned',
                data: { supervisorID, regionalManagerID },
                metadata: { assignedBy: req.user.email }
            });
            logger.info(`Assigned regional manager ${regionalManagerID} to supervisor ${supervisorID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Assign regional manager error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    static async revokeRegionalManagerFromSupervisor(req, res) {
        try {
            const { supervisorID } = req.body;
            if (!supervisorID) {
                logger.warn(`Revoke regional manager failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Supervisor ID is required' });
            }
            const result = await UserService.revokeRegionalManagerFromSupervisor(supervisorID, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:regional_manager_revoked',
                data: { supervisorID, regionalManagerID: result.regionalManagerID },
                metadata: { revokedBy: req.user.email }
            });
            logger.info(`Revoked regional manager from supervisor ${supervisorID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Revoke regional manager error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    static async assignDirectorToRegionalManager(req, res) {
        try {
            const { regionalManagerID, directorID } = req.body;
            if (!regionalManagerID || !directorID) {
                logger.warn(`Assign director failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Regional Manager ID and Director ID are required' });
            }
            const result = await UserService.assignDirectorToRegionalManager(regionalManagerID, directorID, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:director_assigned',
                data: { regionalManagerID, directorID },
                metadata: { assignedBy: req.user.email }
            });
            logger.info(`Assigned director ${directorID} to regional manager ${regionalManagerID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Assign director error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    static async revokeDirectorFromRegionalManager(req, res) {
        try {
            const { regionalManagerID } = req.body;
            if (!regionalManagerID) {
                logger.warn(`Revoke director failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Regional Manager ID is required' });
            }
            const result = await UserService.revokeDirectorFromRegionalManager(regionalManagerID, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:director_revoked',
                data: { regionalManagerID, directorID: result.directorID },
                metadata: { revokedBy: req.user.email }
            });
            logger.info(`Revoked director from regional manager ${regionalManagerID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Revoke director error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    static async assignRegionsToRegionalManager(req, res) {
        try {
            const { regionalManagerID, regionIDs } = req.body;
            if (!regionalManagerID || !Array.isArray(regionIDs) || regionIDs.length === 0) {
                logger.warn(`Assign regions failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Regional Manager ID and Region IDs are required' });
            }
            const result = await UserService.assignRegionsToRegionalManager(regionalManagerID, regionIDs, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:regions_assigned',
                data: { regionalManagerID, regionIDs },
                metadata: { assignedBy: req.user.email }
            });
            logger.info(`Assigned regions to regional manager ${regionalManagerID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Assign regions error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    static async revokeRegionsFromRegionalManager(req, res) {
        try {
            const { regionalManagerID, regionIDs } = req.body;
            if (!regionalManagerID || !Array.isArray(regionIDs) || regionIDs.length === 0) {
                logger.warn(`Revoke regions failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Regional Manager ID and Region IDs are required' });
            }
            const result = await UserService.revokeRegionsFromRegionalManager(regionalManagerID, regionIDs, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:regions_revoked',
                data: { regionalManagerID, regionIDs },
                metadata: { revokedBy: req.user.email }
            });
            logger.info(`Revoked regions from regional manager ${regionalManagerID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Revoke regions error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    static async assignGovernoratesToSupervisor(req, res) {
        try {
            const { supervisorID, governorateIDs } = req.body;
            if (!supervisorID || !Array.isArray(governorateIDs) || governorateIDs.length === 0) {
                logger.warn(`Assign governorates failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Supervisor ID and Governorate IDs are required' });
            }
            const result = await UserService.assignGovernoratesToSupervisor(supervisorID, governorateIDs, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:governorates_assigned',
                data: { supervisorID, governorateIDs },
                metadata: { assignedBy: req.user.email }
            });
            logger.info(`Assigned governorates to supervisor ${supervisorID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Assign governorates error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    static async revokeGovernoratesFromSupervisor(req, res) {
        try {
            const { supervisorID, governorateIDs } = req.body;
            if (!supervisorID || !Array.isArray(governorateIDs) || governorateIDs.length === 0) {
                logger.warn(`Revoke governorates failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Supervisor ID and Governorate IDs are required' });
            }
            const result = await UserService.revokeGovernoratesFromSupervisor(supervisorID, governorateIDs, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:governorates_revoked',
                data: { supervisorID, governorateIDs },
                metadata: { revokedBy: req.user.email }
            });
            logger.info(`Revoked governorates from supervisor ${supervisorID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Revoke governorates error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    static async assignDelegationsToSupervisor(req, res) {
        try {
            const { supervisorID, delegationIDs } = req.body;
            if (!supervisorID || !Array.isArray(delegationIDs) || delegationIDs.length === 0) {
                logger.warn(`Assign delegations failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Supervisor ID and Delegation IDs are required' });
            }
            const result = await UserService.assignDelegationsToSupervisor(supervisorID, delegationIDs, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:delegations_assigned',
                data: { supervisorID, delegationIDs },
                metadata: { assignedBy: req.user.email }
            });
            logger.info(`Assigned delegations to supervisor ${supervisorID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Assign delegations error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    static async revokeDelegationsFromSupervisor(req, res) {
        try {
            const { supervisorID, delegationIDs } = req.body;
            if (!supervisorID || !Array.isArray(delegationIDs) || delegationIDs.length === 0) {
                logger.warn(`Revoke delegations failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Supervisor ID and Delegation IDs are required' });
            }
            const result = await UserService.revokeDelegationsFromSupervisor(supervisorID, delegationIDs, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:delegations_revoked',
                data: { supervisorID, delegationIDs },
                metadata: { revokedBy: req.user.email }
            });
            logger.info(`Revoked delegations from supervisor ${supervisorID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Revoke delegations error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    static async assignSupervisorToAgent(req, res) {
        try {
            const { agentID, supervisorID, delegationID } = req.body;
            if (!agentID || !supervisorID || !delegationID) {
                logger.warn(`Assign supervisor to agent failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Agent ID, Supervisor ID, and Delegation ID are required' });
            }
            const result = await UserService.assignSupervisorToAgent(agentID, supervisorID, delegationID, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:supervisor_assigned_to_agent',
                data: { agentID, supervisorID, delegationID },
                metadata: { assignedBy: req.user.email }
            });
            logger.info(`Assigned supervisor ${supervisorID} to agent ${agentID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Assign supervisor to agent error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    static async revokeSupervisorFromAgent(req, res) {
        try {
            const { agentID } = req.body;
            if (!agentID) {
                logger.warn(`Revoke supervisor from agent failed: Invalid input, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'Agent ID is required' });
            }
            const result = await UserService.revokeSupervisorFromAgent(agentID, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:supervisor_revoked_from_agent',
                data: { agentID, supervisorID: result.supervisorID, delegationID: result.delegationID },
                metadata: { revokedBy: req.user.email }
            });
            logger.info(`Revoked supervisor from agent ${agentID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(result);
        } catch (error) {
            logger.error(`Revoke supervisor from agent error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }

    static async assignGoogleAccount(req, res) {
        try {
            const { userID } = req.params;
            const { googleEmail } = req.body;
            if (!userID || !googleEmail) {
                logger.warn(`Assign Google account failed: Missing fields, user: ${req.user.userID}, IP: ${req.ip}`);
                return res.status(400).json({ error: 'User ID and Google email are required' });
            }
            const updatedUser = await UserService.assignGoogleAccount(userID, googleEmail, req.user.userID);
            await NotificationService.triggerNotification({
                event: 'user:google_account_assigned',
                data: { userID, googleEmail },
                metadata: { assignedBy: req.user.email }
            });
            logger.info(`Assigned Google account to user ${userID} by user ${req.user.userID}, IP: ${req.ip}`);
            return res.status(200).json(updatedUser);
        } catch (error) {
            logger.error(`Assign Google account error: ${error.message}, user: ${req.user.userID}, IP: ${req.ip}`);
            return res.status(400).json({ error: error.message });
        }
    }
}

module.exports = UserController;