const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('CsvHeader', {
        headerID: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: () => `hdr_${nanoid()}`,
        },
        csvType: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'agent',
            validate: {
                isIn: [['agent']],
            },
        },
        expectedHeader: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: true,
            },
        },
        mappedHeader: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: true,
            },
        },
    }, {
        indexes: [
            {
                unique: true,
                fields: ['csvType', 'expectedHeader'],
            },
            {
                unique: true,
                fields: ['csvType', 'mappedHeader'],
            },
        ],
    });
};