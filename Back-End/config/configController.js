// controllers/configController.js
const { Permission, Role, Checklist, Reason } = require('../models');

class ConfigController {
    static async getConfig(req, res) {
        try {
            // Fetch all permissions
            const permissions = await Permission.findAll({
                attributes: ['permissionID', 'name', 'type', 'class', 'description']
            });

            // Fetch all roles with their permissions
            const roles = await Role.findAll({
                attributes: ['roleID', 'name', 'description'],
                include: [{
                    model: Permission,
                    through: { attributes: [] },
                    attributes: ['permissionID', 'name']
                }]
            });

            // Fetch all checklist items
            const checklistItems = await Checklist.findAll({
                attributes: ['checklistID', 'item']
            });

            // Fetch all reason items
            const reasonItems = await Reason.findAll({
                attributes: ['reasonID', 'item']
            });


            const config = {
                permissions: permissions.map(p => ({
                    id: p.permissionID,
                    name: p.name,
                    type: p.type,
                    class: p.class,
                    description: p.description
                })),
                roles: roles.map(r => ({
                    id: r.roleID,
                    name: r.name,
                    description: r.description,
                    permissions: r.Permissions.map(p => p.name)
                })),
                checklistItems: checklistItems.map(c => ({
                    id: c.checklistID,
                    item: c.item
                })),
                reasonItems: reasonItems.map(r => ({
                    id: r.reasonID,
                    item: r.item
                })),
            };

            res.status(200).json(config);
        } catch (error) {
            console.error(`${new Date().toISOString()} - Get config failed:`, error);
            res.status(500).json({ error: 'Failed to retrieve configuration data' });
        }
    }
}

module.exports = ConfigController;