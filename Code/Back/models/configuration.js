module.exports = (sequelize, DataTypes) => {
    const Configuration = sequelize.define(
        'Configuration',
        {
            key: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                validate: {
                    notEmpty: true,
                },
            },
            value: {
                type: DataTypes.TEXT,
                allowNull: false,
                validate: {
                    notEmpty: true,
                },
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            updatedBy: {
                type: DataTypes.UUID,
                allowNull: true,
                references: {
                    model: 'Users',
                    key: 'userID',
                },
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
        },
        {
            tableName: 'Configurations',
            timestamps: true,
            createdAt: false,
        }
    );

    Configuration.associate = (models) => {
        Configuration.belongsTo(models.User, {
            foreignKey: 'updatedBy',
            as: 'Updater',
        });
    };

    return Configuration;
};