const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Permission', {
        permissionID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `perm_${nanoid()}`,
        },
        name: { 
            type: DataTypes.STRING,
            allowNull: false,
            unique: true, 
        },
        type: { 
            type: DataTypes.ENUM('page', 'feature'),
            allowNull: false,
            defaultValue: 'feature',
        },
        class: {
            type: DataTypes.ENUM(
                'User',       // Permissions related to user management
                'Role',       // Permissions related to roles
                'Timesheet',  // Permissions related to timesheets
                'Visit',      // Permissions related to visits
                'Checklist',  // Permissions related to checklists
                'Reason',     // Permissions related to reasons
                'ReceiptBook', // Permissions related to receipt books
                'ReceiptStub', // Permissions related to receipt stubs
                'Agent',       // Permissions related to agents
                'Auth',       // Permissions related to authentication
                'Permission' // Permissions related to permissions
            ),
            allowNull: false,
            defaultValue: 'User',
        },
        description: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    });
};