interface Visit {
  visitID: string;
  date: string;
  time: string;
  duration: number;
  location: string;
  reason: string[];
  checklist: string[];
  status: "pending" | "valid" | "visited";
  agentID: string;
  timesheetID: string;
}

export default Visit;
