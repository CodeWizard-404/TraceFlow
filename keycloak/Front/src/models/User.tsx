import Role from './Role';

interface User {
    userID: string;
    keycloakId: string;
    firstname: string;
    lastname: string;
    phone: string;
    email: string;
    wallet: string;
    password?: string;
    googleEmail?: string; // New field
    Roles?: Role[];
    supervisors?: User[];
    managers?: User[];
    PFP?: string | { type: string; data: number[] } | ArrayBuffer | Uint8Array | null;
}

export default User;