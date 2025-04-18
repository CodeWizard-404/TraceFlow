import PermissionsAction from "./Enum/PermissionsAction";

interface UserPermissionOverride {
    overrideID: string;
    userID: string;
    permissionID: string;
    roleID: string;
    action: PermissionsAction;
}

export default UserPermissionOverride;