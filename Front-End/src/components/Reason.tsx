import { useState } from "react";

function Reason() {
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    console.log(selectedReasons);
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    const checked = event.target.checked;
    if (checked) {
      setSelectedReasons([...selectedReasons, value]);
    } else {
      setSelectedReasons(selectedReasons.filter((reason) => reason !== value));
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>
          <input
            name="reason1"
            value="Reason 1"
            onChange={handleChange}
            type="checkbox"
          />
          Reason 1
        </label>
        <label>
          <input
            name="reason2"
            value="Reason 2"
            onChange={handleChange}
            type="checkbox"
          />
          Reason 2
        </label>
        <label>
          <input
            name="reason3"
            value="Reason 3"
            onChange={handleChange}
            type="checkbox"
          />
          Reason 3
        </label>
      </div>
      <button type="submit">Next</button>
    </form>
  );
}
export default Reason;
