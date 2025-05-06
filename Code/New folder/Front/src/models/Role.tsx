import Permission from './Permission';

interface Role {
    roleID: string;
    name: string;
    description?: string;
    Permissions?: Permission[];
}

export default Role;