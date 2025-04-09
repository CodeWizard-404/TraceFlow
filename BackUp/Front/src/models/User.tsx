import Role from "./Role";

interface User {
    userID: string;
    firstname: string;
    lastname: string;
    phone: string;
    email: string;
    wallet: string;
    password?: string;
    Roles?: Role[];
    supervisors?: User[];
    managers?: User[];
    PFP?: string | { type: string; data: number[] } | ArrayBuffer | Uint8Array | null;
}

export default User;