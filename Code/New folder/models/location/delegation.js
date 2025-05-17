const { nanoid } = require('nanoid');
module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Delegation', {
        delegationID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `del_${nanoid(6)}`,
        },
        name: {
            type: DataTypes.STRING
        },
        nameAr: {
            type: DataTypes.STRING
        },
        nameFr: {
            type: DataTypes.STRING
        }
    });
};