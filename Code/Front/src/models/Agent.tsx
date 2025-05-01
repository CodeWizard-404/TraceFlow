interface Agent {
  agentID: string;
  name: string;
  lastname: string;
  email: string;
  phone: string;
  location: string | null;
  supervisorID?: string;
  delegationID?: string;
}

export default Agent;