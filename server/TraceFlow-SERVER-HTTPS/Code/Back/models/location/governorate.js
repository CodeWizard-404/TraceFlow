const { nanoid } = require('nanoid');
module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Governorate', {
        governorateID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `gov_${nanoid(6)}`,
        },
        name: {
            type: DataTypes.STRING,
            unique: true
        },
        nameAr: {
            type: DataTypes.STRING
        },
        nameFr: {
            type: DataTypes.STRING
        },
        regionID: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'Regions',
                key: 'regionID'
            }
        }
    });
};