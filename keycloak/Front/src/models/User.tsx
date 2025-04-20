import Role from './Role';

interface User {
    userID: string;
    keycloakId?: string;
    firstname: string;
    lastname: string;
    phone: string;
    email: string;
    password: string;
    wallet: string;
    googleEmail?: string;
    PFP?: string | null;
    tempResetToken?: string;
    Roles?: Role[];
    supervisors?: User[];
    managers?: User[];
}

export default User;