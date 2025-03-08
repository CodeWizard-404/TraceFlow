const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Reason', {
    reasonID: { 
        type: DataTypes.STRING,     
        primaryKey: true,
        defaultValue: () => `rea_${nanoid()}`,
    },
    item: { type: DataTypes.STRING, allowNull: false },

});

};
