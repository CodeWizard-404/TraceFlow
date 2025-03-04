import { useEffect, useState } from "react";
import Timesheet from "../models/Timesheet";
import { getTimesheets } from "../apis/timesheetAPI";
import { useNavigate } from "react-router-dom";

function Timesheets() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTimesheets();
  }, []);

  const fetchTimesheets = async () => {
    const data = await getTimesheets();
    if (data) {
      setTimesheets(data);
    }
  };

  return (
    <div>
      <h1>Timesheets</h1>
      <ul>
        {timesheets.map((timesheet) => (
          <li key={timesheet.timesheetID}>
            Week {timesheet.weekNumber} ({timesheet.year})
            <ul>
              {timesheet.Visits.map((visit) => (
                <li key={visit.visitID}>
                  {" "}
                  {visit.time +
                    " | " +
                    visit.date +
                    " at " +
                    visit.location}{" "}
                </li>
              ))}
            </ul>
            <button onClick={() => navigate(`/visitForm`)}>
              Create new Visit
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
export default Timesheets;
