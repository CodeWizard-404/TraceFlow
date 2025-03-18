import Role from './Role';

interface User {
    userID: string;
    firstname: string;
    lastname: string;
    phone: string;
    email: string;
    wallet: string;
    password?: string;
    roles?: Role[];
    supervisors?: User[];
    managers?: User[]; 
}

export default User;