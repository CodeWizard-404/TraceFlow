// models/receipt/receiptBook.js
const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('ReceiptBook', {
        bookID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `book_${nanoid()}`,
        },
        number: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM(
                'In Stock',              // Purchase team
                'Sent to Supplier',      // Purchase team
                'Collect from Supplier', // Purchase team
                'With Regional Manager', // Regional manager(s)
                'With Supervisor',       // Supervisor(s)
                'Assigned to Agent',     // Agent
                'Stub Collected',        // Supervisor after collecting stub
                'With Stock Manager',    // Stock manager
                'Archived'               // Final state
            ),
            allowNull: false,
            defaultValue: 'In Stock',
        },
        qrCode: {
            type: DataTypes.BLOB,
            allowNull: false,
        },
        agentID: {
            type: DataTypes.STRING,
            allowNull: true,
            references: { model: 'Agents', key: 'agentID' },
        },
        currentHolderID: {
            type: DataTypes.STRING,
            allowNull: true, // Null when with agent or in stock initially
            references: { model: 'Users', key: 'userID' },
        },
    });
};