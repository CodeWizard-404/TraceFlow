const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Agent', {
        agentID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `agt_${nanoid()}`,
        },
        name: { type: DataTypes.STRING },
        lastname: { type: DataTypes.STRING},
        wallet: { type: DataTypes.STRING },
        cin: { type: DataTypes.STRING, unique: true},
        email: { type: DataTypes.STRING, unique: true },
        phone: { type: DataTypes.STRING },
        location: { type: DataTypes.STRING},
    });
};