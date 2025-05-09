const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Log', {
        logID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `log_${nanoid()}`,
        },
        ip: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: {
                isIP: true,
            },
        },
        route: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'general',
            index: true,
        },
        service: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'default',
            index: true,
        },
        status: {
            type: DataTypes.INTEGER,
            allowNull: true,
            index: true,
            comment: 'HTTP status code of the response',
        },
        level: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isIn: [['error', 'warn', 'info', 'verbose', 'debug', 'trace']],
            },
            index: true,
        },
        method: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: {
                isIn: [['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']],
            },
            comment: 'HTTP request method',
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        url: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Request URL',
        },

        userId: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'ID of the user making the request',
            index: true,
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: 'Stores additional data, including encrypted fields',
        },
        traceId: {
            type: DataTypes.STRING,
            allowNull: false,
            index: true,
        },
        timestamp: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            index: true,
        },
    }, {
        indexes: [
            { fields: ['level', 'timestamp'] },
            { fields: ['route', 'timestamp'] },
            { fields: ['service'] },
            { fields: ['status'] },
            { fields: ['method'] },
            { fields: ['userId'] },
        ],
        paranoid: true,
        hooks: {
            beforeCreate: (log) => {
                if (!log.traceId) log.traceId = nanoid();
                if (!log.route) log.route = 'general';
                if (!log.service) log.service = 'default';
                if (log.status === undefined) log.status = null;
            },
        },
    });
};