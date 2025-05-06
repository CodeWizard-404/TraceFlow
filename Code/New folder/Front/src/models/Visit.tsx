import { VisitChecklist } from "./Checklist";
import VisitStatus from "./Enum/VisitStatus";
import { VisitReason } from "./Reason";

interface Visit {
  visitID: string;
  date: string;
  time: string; 
  duration?: number | null; 
  location?: string;
  status: VisitStatus;
  photos?: string[];
  comment?: string | null;
  agentID: string;
  timesheetID: string;
  Checklists?: VisitChecklist[]; 
  Reasons?: VisitReason[]; 
}

export default Visit;
