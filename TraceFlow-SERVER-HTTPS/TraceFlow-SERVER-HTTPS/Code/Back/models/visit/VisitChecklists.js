module.exports = (sequelize, DataTypes) => {
    return sequelize.define('VisitChecklist', {
        checked: { type: DataTypes.BOOLEAN, defaultValue: false}
    });
};