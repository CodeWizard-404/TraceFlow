import TimesheetStatus from "./Enum/TimesheetStatus";
import Visit from "./Visit";
import User from "./User";

interface Timesheet {
  timesheetID: string;
  weekNumber: number;
  year: number;
  status: TimesheetStatus;
  supervisorID: string;
  Visits?: Array<Visit & { address?: string }>;
  User?: User;
  createdAt?: string;
  updatedAt?: string;
}

export default Timesheet;