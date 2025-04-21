const { sequelize } = require("../config/db");
const DataTypes = require("sequelize").DataTypes;

// Import models
const Agent = require("./agent")(sequelize, DataTypes);
const ReceiptBook = require("./receipt/receiptBook")(sequelize, DataTypes);
const ReceiptStub = require("./receipt/receiptStub")(sequelize, DataTypes);
const ReceiptBookTransfer = require("./receipt/ReceiptBookTransfer")(sequelize, DataTypes);
const Timesheet = require("./visit/timesheet")(sequelize, DataTypes);
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
const Log = require("./log")(sequelize, DataTypes);
const Notification = require("./notif/notification")(sequelize, DataTypes);
const NotificationPreference = require("./notif/notificationPreference")(sequelize, DataTypes);
const NotificationRule = require("./notif/notificationRule")(sequelize, DataTypes); // Add NotificationRule model

// Define model associations
const setupAssociations = () => {
    // User - User (many-to-many): Managers and Supervisors hierarchy
    User.belongsToMany(User, { as: 'Supervisors', through: 'ManagerSupervisors', foreignKey: 'managerID', otherKey: 'supervisorID' });
    User.belongsToMany(User, { as: 'Managers', through: 'ManagerSupervisors', foreignKey: 'supervisorID', otherKey: 'managerID' });

    // Agent - Visit (1-to-many): Agent can have multiple Visits
    Agent.hasMany(Visit, { foreignKey: "agentID" });
    Visit.belongsTo(Agent, { foreignKey: "agentID" });

    // Timesheet - Visit (1-to-many): Timesheet tracks multiple Visits
    Timesheet.hasMany(Visit, { foreignKey: "timesheetID" });
    Visit.belongsTo(Timesheet, { foreignKey: "timesheetID" });

    // User - Timesheet (1-to-many): User oversees multiple Timesheets
    User.hasMany(Timesheet, { foreignKey: "supervisorID" });
    Timesheet.belongsTo(User, { foreignKey: "supervisorID" });

    // Visit - Checklist (many-to-many): Visit can have multiple Checklists
    Visit.belongsToMany(Checklist, { through: { model: VisitChecklist, unique: false }, foreignKey: "visitID", otherKey: "checklistID" });
    Checklist.belongsToMany(Visit, { through: { model: VisitChecklist, unique: false }, foreignKey: "checklistID", otherKey: "visitID" });

    // Visit - Reason (many-to-many): Visit can have multiple Reasons
    Visit.belongsToMany(Reason, { through: "VisitReasons", foreignKey: "visitID", otherKey: "reasonID" });
    Reason.belongsToMany(Visit, { through: "VisitReasons", foreignKey: "reasonID", otherKey: "visitID" });

    // User - OTP (1-to-many): User can have multiple OTPs
    User.hasMany(OTP, { foreignKey: "userID" });
    OTP.belongsTo(User, { foreignKey: "userID" });

    // User - TrustedDevice (1-to-many): User can have multiple TrustedDevices
    User.hasMany(TrustedDevice, { foreignKey: "userID" });
    TrustedDevice.belongsTo(User, { foreignKey: "userID" });

    // User - Role (many-to-many): User can have multiple Roles
    User.belongsToMany(Role, { through: "UserRoles", foreignKey: "userID", otherKey: "roleID" });
    Role.belongsToMany(User, { through: "UserRoles", foreignKey: "roleID", otherKey: "userID" });

    // Role - Permission (many-to-many): Role can have multiple Permissions
    Role.belongsToMany(Permission, { through: "RolePermissions", foreignKey: "roleID", otherKey: "permissionID" });
    Permission.belongsToMany(Role, { through: "RolePermissions", foreignKey: "permissionID", otherKey: "roleID" });

    // User - UserPermissionOverride (1-to-many): User can have multiple permission overrides
    User.hasMany(UserPermissionOverride, { foreignKey: 'userID' });
    UserPermissionOverride.belongsTo(User, { foreignKey: 'userID' });
    Permission.hasMany(UserPermissionOverride, { foreignKey: 'permissionID' });
    UserPermissionOverride.belongsTo(Permission, { foreignKey: 'permissionID' });
    Role.hasMany(UserPermissionOverride, { foreignKey: 'roleID' });
    UserPermissionOverride.belongsTo(Role, { foreignKey: 'roleID' });

    // User - ReceiptBook (many-to-many): User can manage multiple ReceiptBooks
    User.belongsToMany(ReceiptBook, { through: "UserReceiptBooks", foreignKey: "userID", otherKey: "bookID" });
    ReceiptBook.belongsToMany(User, { through: "UserReceiptBooks", foreignKey: "bookID", otherKey: "userID" });

    // ReceiptBook - ReceiptBookTransfer (1-to-many): ReceiptBook can have multiple Transfers
    ReceiptBook.hasMany(ReceiptBookTransfer, { foreignKey: "bookID" });
    ReceiptBookTransfer.belongsTo(ReceiptBook, { foreignKey: "bookID" });

    // ReceiptBook - User (1-to-many): User as CurrentHolder of ReceiptBooks
    ReceiptBook.belongsTo(User, { as: 'CurrentHolder', foreignKey: 'currentHolderID' });
    User.hasMany(ReceiptBook, { as: 'HeldBooks', foreignKey: 'currentHolderID' });

    // User - ReceiptBookTransfer (1-to-many): User as sender or receiver of Transfers
    User.hasMany(ReceiptBookTransfer, { as: "SentTransfers", foreignKey: "fromUserID" });
    ReceiptBookTransfer.belongsTo(User, { as: "FromUser", foreignKey: "fromUserID" });
    User.hasMany(ReceiptBookTransfer, { as: "ReceivedTransfers", foreignKey: "toUserID" });
    ReceiptBookTransfer.belongsTo(User, { as: "ToUser", foreignKey: "toUserID" });

    // Agent - ReceiptBookTransfer (1-to-many): Agent as receiver of Transfers
    Agent.hasMany(ReceiptBookTransfer, { foreignKey: "toAgentID" });
    ReceiptBookTransfer.belongsTo(Agent, { foreignKey: "toAgentID" });

    // ReceiptBook - Agent (many-to-one): ReceiptBook assigned to an Agent
    ReceiptBook.belongsTo(Agent, { foreignKey: "agentID" });
    Agent.hasMany(ReceiptBook, { foreignKey: "agentID" });

    // ReceiptBook - ReceiptStub (1-to-1): ReceiptBook has one ReceiptStub
    ReceiptBook.hasOne(ReceiptStub, { foreignKey: "bookID" });
    ReceiptStub.belongsTo(ReceiptBook, { foreignKey: "bookID" });

    // User - Notification (1-to-many): User can have multiple Notifications
    User.hasMany(Notification, { foreignKey: "userID" });
    Notification.belongsTo(User, { foreignKey: "userID" });

    // User - NotificationPreference (1-to-1): User has one NotificationPreference
    User.hasOne(NotificationPreference, { foreignKey: "userID" });
    NotificationPreference.belongsTo(User, { foreignKey: "userID" });

    // User - NotificationRule (1-to-many): User can create multiple NotificationRules
    User.hasMany(NotificationRule, { foreignKey: "creatorID" });
    NotificationRule.belongsTo(User, { foreignKey: "creatorID" });
};

// Export models and setup function
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
    Log,
    Notification,
    NotificationPreference,
    NotificationRule, // Export NotificationRule model
    setupAssociations,
};