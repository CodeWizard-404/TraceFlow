import Permission from "./Permission";

interface Role {
    roleID: string;
    name: string;
    description?: string;
    permissions?: Permission[];
}

export default Role;