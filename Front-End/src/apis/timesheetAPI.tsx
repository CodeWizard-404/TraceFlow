import Timesheet from "../models/Timesheet";
import Visit from "../models/Visit";

async function getTimesheets() {
  try {
    const response = await fetch(`http://localhost:5000/api/timesheets`);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("There was a problem with the fetch operation:", error);
    throw error;
  }
}

async function addVisit(
  visitData: Partial<Visit>,
  timesheetData: Partial<Timesheet>
) {
  try {
    const response = await fetch(`http://localhost:5000/api/timesheets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...timesheetData, visits: [visitData] }),
    });
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("There was a problem with the fetch operation:", error);
    throw error;
  }
}

async function validateTimesheet(timesheetID: number) {
  try {
    const response = await fetch(
      `http://localhost:5000/api/timesheets/${timesheetID}/validate`
    );
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("There was a problem with the fetch operation:", error);
    throw error;
  }
}
export { getTimesheets, addVisit, validateTimesheet };
