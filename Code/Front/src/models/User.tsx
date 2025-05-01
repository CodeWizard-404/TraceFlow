import Role from './Role';
import Region from './Region';
import Governorate from './Governorate';
import Delegation from './Delegation';

export interface User {
    userID: string;
    keycloakId?: string;
    firstname: string;
    lastname: string;
    phone: string;
    email: string;
    password: string;
    googleEmail?: string;
    PFP?: string | null;
    tempResetToken?: string;
    regionalManagerID?: string;
    directorID?: string;
    Roles?: Role[];
    supervisors?: User[];
    managers?: User[];
    Regions?: Region[];
    Governorates?: Governorate[];
    Delegations?: Delegation[];
}

export default User;