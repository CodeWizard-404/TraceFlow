// models/receipt/receiptStub.js
const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('ReceiptStub', {
        stubID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `stub_${nanoid()}`,
        },
        status: {
            type: DataTypes.ENUM('pending', 'collected', 'transmitted', 'archived'),
            allowNull: false,
            defaultValue: 'pending',
        },
        bookID: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true, // One stub per book
            references: {
                model: 'ReceiptBooks',
                key: 'bookID',
            },
        },
    });
};