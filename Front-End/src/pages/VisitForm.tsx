// // VisitForm.jsx
// import { ChangeEvent, useEffect, useState } from "react";
// import { getAgentsByLocation, getLocations } from "../apis/agentAPI";
// import Agent from "../models/Agent";
// import Visit from "../models/Visit";
// import Timesheet from "../models/Timesheet";
// import { addVisit } from "../apis/timesheetAPI";
// import { useNavigate, useLocation } from "react-router-dom";

// function VisitForm() {
//   const navigate = useNavigate();
//   const location = useLocation();
//   const { weekNumber, year } = location.state || {};
  
//   const [locations, setLocations] = useState<Array<string>>([]);
//   const [agents, setAgents] = useState<Array<Agent>>([]);

//   async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
//     event.preventDefault();

//     const formData = new FormData(event.currentTarget);

//     const visitData: Partial<Visit> = {
//       date: (formData.get("date") as string) || "",
//       time: (formData.get("time") as string) || "",
//       location: (formData.get("location") as string) || "",
//       agentID: (formData.get("agent") as string) || "",
//     };

//     const timesheetData: Partial<Timesheet> = {
//       weekNumber: weekNumber?.toString() || "1",
//       year: year || new Date().getFullYear(),
//       supervisorID: "2",
//     };

//     await addVisit(visitData, timesheetData);
//     navigate("/timesheet");
//   }

//   const fetchLocations = async () => {
//     const locationsData = await getLocations();
//     if (locationsData) {
//       setLocations(locationsData);
//     }
//   };

//   const fetchAgents = async (location: string) => {
//     const agentsData = await getAgentsByLocation(location);
//     if (agentsData) {
//       setAgents(agentsData);
//     }
//   };

//   useEffect(() => {
//     fetchLocations();
//   }, []);

//   function handleChange(event: ChangeEvent<HTMLSelectElement>): void {
//     const location = event.target.value;
//     fetchAgents(location);
//   }

//   return (
//     <div className="form-container">
//       <h1>Create New Visit</h1>
//       <form onSubmit={handleSubmit}>
//         <div className="form-group">
//           <label htmlFor="date">Date of Visit:</label>
//           <input type="date" id="date" name="date" required />
//         </div>

//         <label htmlFor="time">Time:</label>
//         <input type="time" id="time" name="time" required />

//         <label htmlFor="location">Location:</label>
//         <select name="location" id="location" onChange={handleChange}>
//           <option key="default" value="default">
//             ----
//           </option>
//           {locations.map((location) => (
//             <option key={location} value={location}>
//               {location}
//             </option>
//           ))}
//         </select>

//         <label htmlFor="agent">Agent:</label>
//         <select name="agent" id="agent">
//           {agents.map((agent) => (
//             <option key={agent.agentID} value={agent.agentID}>
//               {agent.phone}
//             </option>
//           ))}
//         </select>

//         <div className="form-group">
//           <button type="submit">Submit Visit</button>
//         </div>
//       </form>
//     </div>
//   );
// }

// export default VisitForm;
