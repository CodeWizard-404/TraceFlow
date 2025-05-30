// models/index.js
const { sequelize } = require("../config/db");
const DataTypes = require("sequelize").DataTypes;

// Import models
const Agent = require("./agent")(sequelize, DataTypes);
const ReceiptBook = require("./receipt/receiptBook")(sequelize, DataTypes);
const ReceiptStub = require("./receipt/receiptStub")(sequelize, DataTypes);
const ReceiptBookTransfer = require("./receipt/ReceiptBookTransfer")(sequelize, DataTypes);
const ReceiptBookType = require("./receipt/receiptBookType")(sequelize, DataTypes);
const Timesheet = require("./visit/timesheet")(sequelize, DataTypes);
const OTP = require("./user/otp")(sequelize, DataTypes);
const Permission = require("./user/permission")(sequelize, DataTypes);
const Role = require("./user/role")(sequelize, DataTypes);
const User = require("./user/user")(sequelize, DataTypes);
const Visit = require("./visit/visit")(sequelize, DataTypes);
const Checklist = require("./visit/checklist")(sequelize, DataTypes);
const VisitChecklist = require("./visit/VisitChecklists")(sequelize, DataTypes);
const Reason = require("./visit/reason")(sequelize, DataTypes);
const TrustedDevice = require("./user/trustedDevice")(sequelize, DataTypes);
const Log = require("./log")(sequelize, DataTypes);
const Notification = require("./notif/notification")(sequelize, DataTypes);
const NotificationPreference = require("./notif/notificationPreference")(sequelize, DataTypes);
const NotificationRule = require("./notif/notificationRule")(sequelize, DataTypes);
const Region = require('./location/region')(sequelize, DataTypes);
const Governorate = require('./location/governorate')(sequelize, DataTypes);
const Delegation = require('./location/delegation')(sequelize, DataTypes);
const CsvHeader = require('./CsvHeader')(sequelize, DataTypes);
const AIConfig = require('./aiConfig')(sequelize, DataTypes);
const ReportSchedule = require('./report/reportSchedule')(sequelize, DataTypes);
const GeneratedReport = require('./report/generatedReport')(sequelize, DataTypes);

// Define model associations
const setupAssociations = () => {
    // User Hierarchy
    User.hasMany(User, { as: 'Supervisors', foreignKey: 'regionalManagerID' });
    User.belongsTo(User, { as: 'RegionalManager', foreignKey: 'regionalManagerID' });
    User.hasMany(User, { as: 'RegionalManagers', foreignKey: 'directorID' });
    User.belongsTo(User, { as: 'Director', foreignKey: 'directorID' });

    // Region Assignments
    User.belongsToMany(Region, { through: 'UserRegions', foreignKey: 'userID', otherKey: 'regionID' });
    Region.belongsToMany(User, { through: 'UserRegions', foreignKey: 'regionID', otherKey: 'userID' });

    // Governorate Assignments
    User.belongsToMany(Governorate, { through: 'UserGovernorates', foreignKey: 'userID', otherKey: 'governorateID' });
    Governorate.belongsToMany(User, { through: 'UserGovernorates', foreignKey: 'governorateID', otherKey: 'userID' });

    // Delegation Assignments
    User.belongsToMany(Delegation, { through: 'UserDelegations', foreignKey: 'userID', otherKey: 'delegationID' });
    Delegation.belongsToMany(User, { through: 'UserDelegations', foreignKey: 'delegationID', otherKey: 'userID' });

    // Agent - Supervisor
    Agent.belongsTo(User, { as: 'Supervisor', foreignKey: 'supervisorID' });
    User.hasMany(Agent, { as: 'Agents', foreignKey: 'supervisorID' });

    // Agent - Delegation
    Agent.belongsTo(Delegation, { foreignKey: 'delegationID' });
    Delegation.hasMany(Agent, { foreignKey: 'delegationID' });

    // Agent - Visit
    Agent.hasMany(Visit, { foreignKey: "agentID" });
    Visit.belongsTo(Agent, { foreignKey: "agentID" });

    // Timesheet - Visit
    Timesheet.hasMany(Visit, { foreignKey: "timesheetID" });
    Visit.belongsTo(Timesheet, { foreignKey: "timesheetID" });

    // User - Timesheet
    User.hasMany(Timesheet, { foreignKey: "supervisorID" });
    Timesheet.belongsTo(User, { foreignKey: "supervisorID" });

    // Visit - Checklist
    Visit.belongsToMany(Checklist, { through: { model: VisitChecklist, unique: false }, foreignKey: "visitID", otherKey: "checklistID" });
    Checklist.belongsToMany(Visit, { through: { model: VisitChecklist, unique: false }, foreignKey: "checklistID", otherKey: "visitID" });

    // Visit - Reason
    Visit.belongsToMany(Reason, { through: "VisitReasons", foreignKey: "visitID", otherKey: "reasonID" });
    Reason.belongsToMany(Visit, { through: "VisitReasons", foreignKey: "reasonID", otherKey: "visitID" });

    // User - OTP
    User.hasMany(OTP, { foreignKey: "userID" });
    OTP.belongsTo(User, { foreignKey: "userID" });

    // User - TrustedDevice
    User.hasMany(TrustedDevice, { foreignKey: "userID" });
    TrustedDevice.belongsTo(User, { foreignKey: "userID" });

    // User - Role
    User.belongsToMany(Role, { through: "UserRoles", foreignKey: "userID", otherKey: "roleID" });
    Role.belongsToMany(User, { through: "UserRoles", foreignKey: "roleID", otherKey: "userID" });

    // Role - Permission
    Role.belongsToMany(Permission, { through: "RolePermissions", foreignKey: "roleID", otherKey: "permissionID" });
    Permission.belongsToMany(Role, { through: "RolePermissions", foreignKey: "permissionID", otherKey: "roleID" });

    // User - ReceiptBook
    User.belongsToMany(ReceiptBook, { through: "UserReceiptBooks", foreignKey: "userID", otherKey: "bookID" });
    ReceiptBook.belongsToMany(User, { through: "UserReceiptBooks", foreignKey: "bookID", otherKey: "userID" });

    // ReceiptBook - ReceiptBookTransfer
    ReceiptBook.hasMany(ReceiptBookTransfer, { foreignKey: "bookID" });
    ReceiptBookTransfer.belongsTo(ReceiptBook, { foreignKey: "bookID" });

    // ReceiptBook - User
    ReceiptBook.belongsTo(User, { as: 'CurrentHolder', foreignKey: 'currentHolderID' });
    User.hasMany(ReceiptBook, { as: 'HeldBooks', foreignKey: 'currentHolderID' });

    // User - ReceiptBookTransfer
    User.hasMany(ReceiptBookTransfer, { as: "SentTransfers", foreignKey: "fromUserID" });
    ReceiptBookTransfer.belongsTo(User, { as: "FromUser", foreignKey: "fromUserID" });
    User.hasMany(ReceiptBookTransfer, { as: "ReceivedTransfers", foreignKey: "toUserID" });
    ReceiptBookTransfer.belongsTo(User, { as: "ToUser", foreignKey: "toUserID" });

    // Agent - ReceiptBookTransfer
    Agent.hasMany(ReceiptBookTransfer, { foreignKey: "toAgentID" });
    ReceiptBookTransfer.belongsTo(Agent, { foreignKey: "toAgentID" });

    // ReceiptBook - Agent
    ReceiptBook.belongsTo(Agent, { foreignKey: "agentID" });
    Agent.hasMany(ReceiptBook, { foreignKey: "agentID" });

    // ReceiptBook - ReceiptStub
    ReceiptBook.hasOne(ReceiptStub, { foreignKey: "bookID" });
    ReceiptStub.belongsTo(ReceiptBook, { foreignKey: "bookID" });

    // ReceiptBook - ReceiptBookType
    ReceiptBook.belongsTo(ReceiptBookType, { foreignKey: "typeID" });
    ReceiptBookType.hasMany(ReceiptBook, { foreignKey: "typeID" });

    // User - Notification
    User.hasMany(Notification, { foreignKey: "userID" });
    Notification.belongsTo(User, { foreignKey: "userID" });

    // User - NotificationPreference
    User.hasOne(NotificationPreference, { foreignKey: "userID" });
    NotificationPreference.belongsTo(User, { foreignKey: "userID" });

    // User - NotificationRule
    User.hasMany(NotificationRule, { foreignKey: "creatorID" });
    NotificationRule.belongsTo(User, { foreignKey: "creatorID" });

    // Region - Governorate
    Region.hasMany(Governorate, { foreignKey: 'regionID' });
    Governorate.belongsTo(Region, { foreignKey: 'regionID' });

    // Governorate - Delegation
    Governorate.hasMany(Delegation, { foreignKey: 'governorateID' });
    Delegation.belongsTo(Governorate, { foreignKey: 'governorateID' });

    // AIConfig - User
    AIConfig.belongsTo(User, { foreignKey: 'supervisorId', as: 'Supervisor' });
    User.hasMany(AIConfig, { foreignKey: 'supervisorId', as: 'AIConfigs' });

    // ReportSchedule - User
    ReportSchedule.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });

    // GeneratedReport - User and ReportSchedule
    GeneratedReport.belongsTo(User, { foreignKey: 'generatedBy', as: 'Generator' });
    GeneratedReport.belongsTo(ReportSchedule, { foreignKey: 'scheduleID', as: 'Schedule' });
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
    ReceiptBookType,
    TrustedDevice,
    Log,
    Notification,
    NotificationPreference,
    NotificationRule,
    Region,
    Governorate,
    Delegation,
    CsvHeader,
    AIConfig,
    ReportSchedule,
    GeneratedReport,
    setupAssociations,
};