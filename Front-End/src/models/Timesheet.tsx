import TimesheetStatus from "./Enum/TimesheetStatus";
import Visit from "./Visit";

interface Timesheet {
  timesheetID: string;
  weekNumber: number;
  year: number;
  status: TimesheetStatus;
  supervisorID: string;
  Visits?: Visit[];
}

export default Timesheet;
