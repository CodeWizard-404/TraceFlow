const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('ReceiptBookType', {
        typeID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `type_${nanoid()}`,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
    });
};