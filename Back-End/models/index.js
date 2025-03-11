const { sequelize } = require('../config/db');
const DataTypes = require('sequelize').DataTypes;

const Agent = require('./agent')(sequelize, DataTypes);
const User = require('./user')(sequelize, DataTypes);
const Visit = require('./visit')(sequelize, DataTypes);
const Timesheet = require('./timesheet')(sequelize, DataTypes);
const Checklist = require('./checklist')(sequelize, DataTypes);
const VisitChecklist = require('./VisitChecklists')(sequelize, DataTypes);
const Reason = require('./reason')(sequelize, DataTypes);
const OTP = require('./otp')(sequelize, DataTypes);
const Role = require('./role')(sequelize, DataTypes);
const Permission = require('./permission')(sequelize, DataTypes);
const ReceiptBook = require('./receiptBook')(sequelize, DataTypes);
const ReceiptStub = require('./receiptStub')(sequelize, DataTypes);

// Define associations
const setupAssociations = () => {
    // User-User (many-to-many, e.g., supervisors managing other users)
    User.belongsToMany(User, {
        as: 'ManagedUsers',
        through: 'UserManagers',
        foreignKey: 'managerID',
        otherKey: 'userID',
    });
    User.belongsToMany(User, {
        as: 'Managers',
        through: 'UserManagers',
        foreignKey: 'userID',
        otherKey: 'managerID',
    });

    // User-Timesheet (one-to-many: User manages Timesheets)
    User.hasMany(Timesheet, { foreignKey: 'supervisorID' });
    Timesheet.belongsTo(User, { foreignKey: 'supervisorID' });

    // Timesheet-Visit (one-to-many: Timesheet contains Visits)
    Timesheet.hasMany(Visit, { foreignKey: 'timesheetID' });
    Visit.belongsTo(Timesheet, { foreignKey: 'timesheetID' });

    // Visit-Agent (many-to-one: Visits assigned to one Agent)
    Visit.belongsTo(Agent, { foreignKey: 'agentID' });
    Agent.hasMany(Visit, { foreignKey: 'agentID' });

    // Visit-Checklist (many-to-many: Visit includes Checklists)
    Visit.belongsToMany(Checklist, {
        through: { model: VisitChecklist, unique: false },
        foreignKey: 'visitID',
        otherKey: 'checklistID',
    });
    Checklist.belongsToMany(Visit, {
        through: { model: VisitChecklist, unique: false },
        foreignKey: 'checklistID',
        otherKey: 'visitID',
    });

    // Visit-Reason (many-to-many: Visit includes Reasons)
    Visit.belongsToMany(Reason, {
        through: 'VisitReasons',
        foreignKey: 'visitID',
        otherKey: 'reasonID',
    });
    Reason.belongsToMany(Visit, {
        through: 'VisitReasons',
        foreignKey: 'reasonID',
        otherKey: 'visitID',
    });

    // Role-User (many-to-many: Roles assigned to Users)
    Role.belongsToMany(User, {
        through: 'UserRoles',
        foreignKey: 'roleID',
        otherKey: 'userID',
    });
    User.belongsToMany(Role, {
        through: 'UserRoles',
        foreignKey: 'userID',
        otherKey: 'roleID',
    });

    // Permission-Role (many-to-many: Permissions granted to Roles)
    Permission.belongsToMany(Role, {
        through: 'RolePermissions',
        foreignKey: 'permissionID',
        otherKey: 'roleID',
    });
    Role.belongsToMany(Permission, {
        through: 'RolePermissions',
        foreignKey: 'roleID',
        otherKey: 'permissionID',
    });

    // User-ReceiptBook (many-to-many: Users own ReceiptBooks)
    User.belongsToMany(ReceiptBook, {
        through: 'UserReceiptBooks',
        foreignKey: 'userID',
        otherKey: 'bookID',
    });
    ReceiptBook.belongsToMany(User, {
        through: 'UserReceiptBooks',
        foreignKey: 'bookID',
        otherKey: 'userID',
    });

    // ReceiptBook-ReceiptStub (one-to-one: ReceiptBook contains one ReceiptStub)
    ReceiptBook.hasOne(ReceiptStub, { foreignKey: 'bookID' });
    ReceiptStub.belongsTo(ReceiptBook, { foreignKey: 'bookID' });

    // ReceiptBook-Agent (many-to-one: ReceiptBooks assigned to one Agent)
    ReceiptBook.belongsTo(Agent, { foreignKey: 'agentID' });
    Agent.hasMany(ReceiptBook, { foreignKey: 'agentID' });

    // OTP-User (many-to-one: OTPs belong to one User)
    OTP.belongsTo(User, { foreignKey: 'userID' });
    User.hasMany(OTP, { foreignKey: 'userID' });
};

module.exports = {
    sequelize,
    User,
    Agent,
    Visit,
    Timesheet,
    Checklist,
    Reason,
    VisitChecklist,
    OTP,
    Role,
    Permission,
    ReceiptBook,
    ReceiptStub,
    setupAssociations,
};