const { sequelize } = require("../config/db");
const DataTypes = require("sequelize").DataTypes;

const Agent = require("./agent")(sequelize, DataTypes);
const ReceiptBook = require("./receipt/receiptBook")(sequelize, DataTypes);
const ReceiptStub = require("./receipt/receiptStub")(sequelize, DataTypes);
const ReceiptBookTransfer = require("./receipt/ReceiptBookTransfer")(sequelize, DataTypes);
const Timesheet = require("./timesheet")(sequelize, DataTypes);
const OTP = require("./user/otp")(sequelize, DataTypes);
const Permission = require("./user/permission")(sequelize, DataTypes);
const Role = require("./user/role")(sequelize, DataTypes);
const User = require("./user/user")(sequelize, DataTypes);
const UserPermissionOverride = require("./user/userPermissionOverride")(sequelize, DataTypes);
const Visit = require("./visit/visit")(sequelize, DataTypes);
const Checklist = require("./visit/checklist")(sequelize, DataTypes);
const VisitChecklist = require("./visit/VisitChecklists")(sequelize, DataTypes);
const Reason = require("./visit/reason")(sequelize, DataTypes);
const TrustedDevice = require("./user/trustedDevice")(sequelize, DataTypes);

const setupAssociations = () => {
    // User - User (many to many): A User can have multiple Supervisors and Managers, and a User can be a Supervisor or Manager of multiple Users.
    User.belongsToMany(User, { as: 'Supervisors', through: 'ManagerSupervisors', foreignKey: 'managerID', otherKey: 'supervisorID' });
    User.belongsToMany(User, { as: 'Managers', through: 'ManagerSupervisors', foreignKey: 'supervisorID', otherKey: 'managerID' });

    // Agent - Visit (1 to many): An Agent can have multiple Visits.
    Agent.hasMany(Visit, { foreignKey: "agentID" });
    Visit.belongsTo(Agent, { foreignKey: "agentID" });

    // Timesheet - Visit (1 to many): A Timesheet tracks multiple Visits.
    Timesheet.hasMany(Visit, { foreignKey: "timesheetID" });
    Visit.belongsTo(Timesheet, { foreignKey: "timesheetID" });

    // User - Timesheet (1 to many): A User can oversee multiple Timesheets.
    User.hasMany(Timesheet, { foreignKey: "supervisorID" });
    Timesheet.belongsTo(User, { foreignKey: "supervisorID" });

    // Visit - Checklist (many to many): A Visit can have multiple Checklists, and a Checklist can apply to multiple Visits.
    Visit.belongsToMany(Checklist, { through: { model: VisitChecklist, unique: false }, foreignKey: "visitID", otherKey: "checklistID" });
    Checklist.belongsToMany(Visit, { through: { model: VisitChecklist, unique: false }, foreignKey: "checklistID", otherKey: "visitID" });

    // Visit - Reason (many to many): A Visit can have multiple Reasons (e.g., cancellation), and a Reason can apply to multiple Visits.
    Visit.belongsToMany(Reason, { through: "VisitReasons", foreignKey: "visitID", otherKey: "reasonID" });
    Reason.belongsToMany(Visit, { through: "VisitReasons", foreignKey: "reasonID", otherKey: "visitID" });

    // User - OTP (1 to many): A User can have multiple OTPs for secure actions (e.g., receipt book transfers).
    User.hasMany(OTP, { foreignKey: "userID" });
    OTP.belongsTo(User, { foreignKey: "userID" });

    // User - TrustedDevice (1 to many): A User can have multiple TrustedDevices.
    User.hasMany(TrustedDevice, { foreignKey: "userID" });
    TrustedDevice.belongsTo(User, { foreignKey: "userID" });

    // User - Role (many to many): A User can have multiple Roles, and a Role can be assigned to multiple Users.
    User.belongsToMany(Role, { through: "UserRoles", foreignKey: "userID", otherKey: "roleID" });
    Role.belongsToMany(User, { through: "UserRoles", foreignKey: "roleID", otherKey: "userID" });

    // Role - Permission (many to many): A Role can have multiple Permissions, and a Permission can belong to multiple Roles.
    Role.belongsToMany(Permission, { through: "RolePermissions", foreignKey: "roleID", otherKey: "permissionID" });
    Permission.belongsToMany(Role, { through: "RolePermissions", foreignKey: "permissionID", otherKey: "roleID" });

    // User - UserPermissionOverride (1 to many): A User can have multiple permission overrides.
    User.hasMany(UserPermissionOverride, { foreignKey: 'userID' });
    UserPermissionOverride.belongsTo(User, { foreignKey: 'userID' });

    Permission.hasMany(UserPermissionOverride, { foreignKey: 'permissionID' });
    UserPermissionOverride.belongsTo(Permission, { foreignKey: 'permissionID' });

    Role.hasMany(UserPermissionOverride, { foreignKey: 'roleID' });
    UserPermissionOverride.belongsTo(Role, { foreignKey: 'roleID' });

    // User - ReceiptBook (many to many): A User can own or manage multiple ReceiptBooks, and a ReceiptBook can be linked to multiple Users.
    User.belongsToMany(ReceiptBook, { through: "UserReceiptBooks", foreignKey: "userID", otherKey: "bookID" });
    ReceiptBook.belongsToMany(User, { through: "UserReceiptBooks", foreignKey: "bookID", otherKey: "userID" });

    ReceiptBook.hasMany(ReceiptBookTransfer, { foreignKey: "bookID" });
    ReceiptBookTransfer.belongsTo(ReceiptBook, { foreignKey: "bookID" });

    ReceiptBook.belongsTo(User, { as: 'CurrentHolder', foreignKey: 'currentHolderID' });
    User.hasMany(ReceiptBook, { as: 'HeldBooks', foreignKey: 'currentHolderID' });

    User.hasMany(ReceiptBookTransfer, { as: "SentTransfers", foreignKey: "fromUserID" });
    ReceiptBookTransfer.belongsTo(User, { as: "FromUser", foreignKey: "fromUserID" });

    User.hasMany(ReceiptBookTransfer, { as: "ReceivedTransfers", foreignKey: "toUserID" });
    ReceiptBookTransfer.belongsTo(User, { as: "ToUser", foreignKey: "toUserID" });

    Agent.hasMany(ReceiptBookTransfer, { foreignKey: "toAgentID" });
    ReceiptBookTransfer.belongsTo(Agent, { foreignKey: "toAgentID" });

    // ReceiptBook - Agent (many to one): A ReceiptBook is assigned to one Agent, but an Agent can have multiple ReceiptBooks.
    ReceiptBook.belongsTo(Agent, { foreignKey: "agentID" });
    Agent.hasMany(ReceiptBook, { foreignKey: "agentID" });

    // ReceiptBook - ReceiptStub (1 to 1): A ReceiptBook has one ReceiptStub, and a ReceiptStub belongs to one ReceiptBook.
    ReceiptBook.hasOne(ReceiptStub, { foreignKey: "bookID" });
    ReceiptStub.belongsTo(ReceiptBook, { foreignKey: "bookID" });
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
    ReceiptBookTransfer,
    UserPermissionOverride,
    TrustedDevice,
    setupAssociations,
};