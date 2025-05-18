import Agent from "./Agent";
import { VisitChecklist } from "./Checklist";
import VisitStatus from "./Enum/VisitStatus";
import { Reason } from "./Reason";

interface Visit {
  visitID: string;
  date: string;
  time: string;
  duration?: number | null;
  location?: string | null;
  status: VisitStatus;
  photos?: string[];
  comment?: string | null;
  agentID?: string | null;
  timesheetID: string;
  Checklists?: VisitChecklist[];
  Reasons?: Reason[];
  Agent?: Agent;
  calendarEventId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export default Visit;