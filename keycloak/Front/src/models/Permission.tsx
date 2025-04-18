import PermissionsClass from "./Enum/PermissionsClass";

interface Permission {
    permissionID: string;
    name: string;
    class: PermissionsClass;
    description?: string;
}

export default Permission;