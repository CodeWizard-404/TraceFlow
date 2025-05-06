const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Agent', {
        agentID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `agt_${nanoid()}`,
        },
        name: { type: DataTypes.STRING },
        lastname: { type: DataTypes.STRING },
        email: { type: DataTypes.STRING, unique: true },
        phone: { type: DataTypes.STRING },
        location: { type: DataTypes.STRING },
        supervisorID: {
            type: DataTypes.STRING,
            allowNull: true, // change on production
            references: {
                model: 'Users',
                key: 'userID',
            },
        },
        delegationID: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'Delegations',
                key: 'delegationID',
            },
        },
    });
};