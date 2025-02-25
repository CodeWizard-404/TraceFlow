interface Timesheet {
  timesheetID: number;
  weekNumber: string;
  year: number;
  status: string;
  supervisorID: string;
  Visits: any[];
}

export default Timesheet;
