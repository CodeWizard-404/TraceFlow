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
            defaultValue: 'initial', // e.g., 'initial', 'distributed', 'collected'
        },
        qrCode: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        ownerID: {
            type: DataTypes.STRING,
            allowNull: true, // Can be null initially until assigned
            references: {
                model: 'Users',
                key: 'userID',
            },
        },
        agentID: {
            type: DataTypes.STRING,
            allowNull: true, // Assigned to an agent later
            references: {
                model: 'Agents',
                key: 'agentID',
            },
        },
    });
};