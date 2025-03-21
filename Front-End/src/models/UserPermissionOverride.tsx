interface UserPermissionOverride {
    overrideID: string;
    userID: string;
    roleID: string;
    permissionID: string;
    action: "grant" | "revoke";
}

export default UserPermissionOverride;