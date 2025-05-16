import { VisitChecklist } from "./Checklist";
import VisitStatus from "./Enum/VisitStatus";
import { VisitReason } from "./Reason";

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
  Reasons?: VisitReason[];
  calendarEventId?: string | null;
}

export default Visit;