// models/receipt/receiptBookTransfer.js
const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('ReceiptBookTransfer', {
        transferID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `trans_${nanoid()}`,
        },
        bookID: {
            type: DataTypes.STRING,
            allowNull: false,
            references: { model: 'ReceiptBooks', key: 'bookID' },
        },
        fromUserID: {
            type: DataTypes.STRING,
            allowNull: true, // Null if from agent or initial stock
            references: { model: 'Users', key: 'userID' },
        },
        toUserID: {
            type: DataTypes.STRING,
            allowNull: true, // Null if to agent
            references: { model: 'Users', key: 'userID' },
        },
        toAgentID: {
            type: DataTypes.STRING,
            allowNull: true, // Null if to user
            references: { model: 'Agents', key: 'agentID' },
        },
        status: {
            type: DataTypes.ENUM(
                'In Stock', 'Sent to Supplier', 'With Regional Manager', 'With Supervisor', 
                'Assigned to Agent', 'Stub Collected', 'With Stock Manager', 'Archived'
            ),
            allowNull: false,
        },
        transferDate: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    });
};