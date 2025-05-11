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
        location: { type: DataTypes.STRING }, // Kept for compatibility
        latitude: { type: DataTypes.FLOAT },  // New field for latitude
        longitude: { type: DataTypes.FLOAT }, // New field for longitude
        supervisorID: {
            type: DataTypes.STRING,
            allowNull: true,
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
    }, {
        hooks: {
            beforeSave: (agent) => {
                // Sync location string with latitude/longitude
                if (agent.latitude && agent.longitude) {
                    agent.location = `${agent.latitude},${agent.longitude}`;
                } else if (agent.location && !agent.latitude && !agent.longitude) {
                    const [lat, lng] = agent.location.split(',').map(Number);
                    agent.latitude = lat;
                    agent.longitude = lng;
                }
            }
        }
    });
};