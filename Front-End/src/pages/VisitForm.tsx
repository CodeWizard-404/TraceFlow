import { useEffect, useState } from "react";
import { getLocations } from "../apis/agentAPI";

function VisitForm() {
  const [locations, setLocations] = useState([]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    console.log("Form submitted");
  }

  const fetchLocations = async () => {
    const locationsData = await getLocations();
    if (locationsData) {
      setLocations(locationsData);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  return (
    <div>
      <h1>Visit Form</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="date">Date of Visit:</label>
        <input type="date" id="date" name="date" required />
        <label htmlFor="location">Location:</label>
        <select name="location" id="location">
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}

export default VisitForm;
