const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('AIConfig', {
        configID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `ai_${nanoid()}`,
        },
        supervisorId: {
            type: DataTypes.STRING,
            allowNull: true,
            references: {
                model: 'Users',
                key: 'userID',
            },
        },
        anomalyThreshold: {
            type: DataTypes.FLOAT,
            defaultValue: parseFloat(process.env.OLLAMA_ANOMALY_THRESHOLD) || 0.95,
            validate: {
                min: 0,
                max: 1,
            },
        },
        timesheetMaxSuggestions: {
            type: DataTypes.INTEGER,
            defaultValue: parseInt(process.env.OLLAMA_TIMESHEET_MAX_SUGGESTIONS) || 5,
            validate: {
                min: 0,
            },
        },
        maxOptimizeRoute: {
            type: DataTypes.INTEGER,
            defaultValue: parseInt(process.env.OLLAMA_MAX_OPTIMIZE_ROUTE) || 5,
            validate: {
                min: 0,
            },
        },
        modelName: {
            type: DataTypes.STRING,
            defaultValue: process.env.OLLAMA_MODEL_NAME || 'mistral',
            validate: {
                notEmpty: true,
            },
        },
    }, {
        tableName: 'ai_configs',
        timestamps: true,
    });
};