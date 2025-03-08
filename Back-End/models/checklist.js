const { nanoid } = require('nanoid');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Checklist', {
    checklistID: { 
        type: DataTypes.STRING,     
        primaryKey: true,
        defaultValue: () => `chk_${nanoid()}`, 
    },
    item: { type: DataTypes.STRING, allowNull: false },

});

};
