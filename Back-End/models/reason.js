const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Reason', {
    reasonID: { 
        type: DataTypes.STRING,     
        primaryKey: true,
        defaultValue: () => nanoid(), 
    },
    item: { type: DataTypes.STRING, allowNull: false },

});

};
