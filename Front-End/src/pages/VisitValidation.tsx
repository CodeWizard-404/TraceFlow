import { useEffect, useState } from "react";
import Timesheet from "../models/Timesheet";
import { getTimesheets, validateTimesheet } from "../apis/timesheetAPI";

function VisitValidation() {
  const [timesheets, setTimesheets] = useState<Array<Timesheet>>([]);

  useEffect(() => {
    const fetchTimesheets = async () => {
      const fetchedTimesheets = await getTimesheets();
      setTimesheets(fetchedTimesheets);
    };

    fetchTimesheets();
  }, []);

  return (
    <div>
      <h1>Timesheet List</h1>
      <table className="customTable">
        <tbody>
          <tr>
            <th>Timesheet ID</th>
            <th>Week Number</th>
            <th>Year</th>
            <th>Status</th>
            <th>Supervisor ID</th>
            <th>Agent ID</th>
            <th></th>
          </tr>
          {timesheets.map((timesheet) => (
            <tr key={timesheet.timesheetID}>
              <td>{timesheet.timesheetID}</td>
              <td>{timesheet.weekNumber}</td>
              <td>{timesheet.year}</td>
              <td>{timesheet.status}</td>
              <td>{timesheet.supervisorID}</td>
              <td>
                {timesheet.Visits.map((visit) => visit.agentID).join(", ")}
              </td>
              <td>
                <button
                  onClick={async (e) => {
                    e.currentTarget.disabled = true;
                    await validateTimesheet(timesheet.timesheetID);
                  }}
                  className="btn btn-success"
                  disabled={timesheet.status === "valid"}
                >
                  Validate Timesheet
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default VisitValidation;
