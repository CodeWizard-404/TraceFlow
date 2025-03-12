const { Sequelize } = require('sequelize');
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

// Define associations with detailed comments
const setupAssociations = () => {
    // Agent - Visit (1 to many): An Agent can have multiple Visits.
    // This reflects agents performing multiple visits as part of their duties.
    Agent.hasMany(Visit, { foreignKey: 'agentID' });
    Visit.belongsTo(Agent, { foreignKey: 'agentID' });

    // Timesheet - Visit (1 to many): A Timesheet tracks multiple Visits.
    // This allows supervisors to group visits under a single timesheet for review.
    Timesheet.hasMany(Visit, { foreignKey: 'timesheetID' });
    Visit.belongsTo(Timesheet, { foreignKey: 'timesheetID' });

    // User - Timesheet (1 to many): A User (e.g., Supervisor) can oversee multiple Timesheets.
    // Supervisors or managers create and manage timesheets.
    User.hasMany(Timesheet, { foreignKey: 'supervisorID' });
    Timesheet.belongsTo(User, { foreignKey: 'supervisorID' });

    // Visit - Checklist (many to many): A Visit can have multiple Checklists, and a Checklist can apply to multiple Visits.
    // This uses VisitChecklist as a junction table to track which checklists are completed per visit.
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

    // Visit - Reason (many to many): A Visit can have multiple Reasons (e.g., cancellation), and a Reason can apply to multiple Visits.
    // Junction table 'VisitReasons' links visits to their reasons, supporting detailed reporting.
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

    // User - OTP (1 to many): A User can have multiple OTPs for secure actions (e.g., receipt book transfers).
    // OTPs are tied to users for authentication or validation purposes.
    User.hasMany(OTP, { foreignKey: 'userID' });
    OTP.belongsTo(User, { foreignKey: 'userID' });

    // User - Role (many to many): A User can have multiple Roles, and a Role can be assigned to multiple Users.
    // Junction table 'UserRoles' enables role-based access control (e.g., Supervisor, Manager).
    User.belongsToMany(Role, {
        through: 'UserRoles',
        foreignKey: 'userID',
        otherKey: 'roleID',
    });
    Role.belongsToMany(User, {
        through: 'UserRoles',
        foreignKey: 'roleID',
        otherKey: 'userID',
    });

    // Role - Permission (many to many): A Role can have multiple Permissions, and a Permission can belong to multiple Roles.
    // Junction table 'RolePermissions' defines what actions (e.g., 'view_reports') a role can perform.
    Role.belongsToMany(Permission, {
        through: 'RolePermissions',
        foreignKey: 'roleID',
        otherKey: 'permissionID',
    });
    Permission.belongsToMany(Role, {
        through: 'RolePermissions',
        foreignKey: 'permissionID',
        otherKey: 'roleID',
    });

    // User - ReceiptBook (many to many): A User can own or manage multiple ReceiptBooks, and a ReceiptBook can be linked to multiple Users.
    // Junction table 'UserReceiptBooks' tracks ownership or responsibility (e.g., Regional Manager assigning books).
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

    // ReceiptBook - Agent (many to one): A ReceiptBook is assigned to one Agent, but an Agent can have multiple ReceiptBooks.
    // This supports tracking which agent is responsible for getting a receipt book.
    ReceiptBook.belongsTo(Agent, { foreignKey: 'agentID' });
    Agent.hasMany(ReceiptBook, { foreignKey: 'agentID' });

    // ReceiptBook - ReceiptStub (1 to 1): A ReceiptBook has one ReceiptStub, and a ReceiptStub belongs to one ReceiptBook.
    // This represents the stub collected from a receipt book after payments are processed.
    ReceiptBook.hasOne(ReceiptStub, { foreignKey: 'bookID' });
    ReceiptStub.belongsTo(ReceiptBook, { foreignKey: 'bookID' });
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