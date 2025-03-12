const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('ReceiptStub', {
        stubID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `stub_${nanoid()}`,
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'pending',
        },
        bookID: { 
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'ReceiptBooks',
                key: 'bookID',
            },
        },
    });
};