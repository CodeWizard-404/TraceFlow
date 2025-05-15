import User from "./User";

interface Agent {
  agentID: string;
  name: string;
  lastname: string;
  email: string;
  phone: string;
  location: string | null;
  latitude?: number;
  longitude?: number;
  supervisorID?: string;
  delegationID: string;
  createdAt: string;
  updatedAt: string;
  Supervisor: User;
  Delegation: {
    delegationID: string;
    name: string;
    Governorate: {
      governorateID: string;
      name: string;
    };
  };
}

export default Agent;