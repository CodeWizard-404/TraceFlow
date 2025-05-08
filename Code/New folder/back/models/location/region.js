const { nanoid } = require('nanoid');
module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Region', {
        regionID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `reg_${nanoid(6)}`,
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
        }
    });
};