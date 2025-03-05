const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Agent', {
        agentID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => nanoid(),
        },
        name: { type: DataTypes.STRING, allowNull: false },
        lastname: { type: DataTypes.STRING, allowNull: false },
        wallet: { type: DataTypes.STRING, allowNull: false },
        cin: { type: DataTypes.STRING, unique: true, allowNull: false },
        email: { type: DataTypes.STRING, unique: true, allowNull: false },
        phone: { type: DataTypes.STRING, allowNull: false },
        location: { type: DataTypes.STRING, unique: true, allowNull: false },
    });
};