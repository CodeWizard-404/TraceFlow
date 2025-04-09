import PermissionsAction from "./Enum/PermissionsAction";

interface UserPermissionOverride {
    overrideID: string;
    userID: string;
    roleID: string;
    permissionID: string;
    action: PermissionsAction
}

export default UserPermissionOverride;