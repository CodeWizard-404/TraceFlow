const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('ReceiptBook', {
        bookID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `book_${nanoid()}`,
        },
        number: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'initial',
        },
        qrCode: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        agentID: {
            type: DataTypes.STRING,
            allowNull: true,
            references: {
                model: 'Agents',
                key: 'agentID',
            },
        }
    });
};