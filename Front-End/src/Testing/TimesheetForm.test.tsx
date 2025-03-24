import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useError } from "../context/ErrorContext";
import * as checklistAPI from "../apis/checklistAPI";
import * as reasonAPI from "../apis/reasonAPI";
import * as timesheetAPI from "../apis/timesheetAPI";
import * as agentAPI from "../apis/agentAPI";
import * as userAPI from "../apis/userAPI";
import TimesheetForm from "../pages/timesheet/TimesheetForm";

jest.mock("../context/AuthContext");
jest.mock("../context/ErrorContext");
jest.mock("../apis/agentAPI");
jest.mock("../apis/checklistAPI");
jest.mock("../apis/reasonAPI");
jest.mock("../apis/timesheetAPI", () => ({
  createTimesheet: jest.fn(),
}));
jest.mock("../apis/userAPI");
jest.mock("lodash", () => ({
  debounce: jest.fn((fn) => fn),
}));

describe("TimesheetForm", () => {
  const mockUser = { userID: "user1", firstname: "John", lastname: "Doe" };
  const mockToken = "fake-token";
  const mockPermissions = [{ name: "create_timesheets" }];

  beforeEach(() => {
    jest.clearAllMocks();

    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      token: mockToken,
      effectivePermissions: mockPermissions,
      userRoles: mockPermissions,
    });

    (useError as jest.Mock).mockReturnValue({
      setError: jest.fn(),
    });

    (agentAPI.getAgentLocations as jest.Mock).mockResolvedValue([
      "Location1",
      "Location2",
    ]);
    (agentAPI.getAgentsByLocation as jest.Mock).mockResolvedValue([
      {
        agentID: "agent1",
        name: "Agent",
        lastname: "One",
        phone: "1234567890",
      },
    ]);
    (reasonAPI.getAllReasons as jest.Mock).mockResolvedValue([
      { reasonID: "reason1", item: "Reason One" },
    ]);
    (checklistAPI.getAllChecklists as jest.Mock).mockResolvedValue([
      { checklistID: "checklist1", item: "Checklist One" },
    ]);
    (timesheetAPI.createTimesheet as jest.Mock).mockResolvedValue({});
    (userAPI.getSupervisorsByUser as jest.Mock).mockResolvedValue([]);
  });

  const renderTimesheetForm = () =>
    render(
      <MemoryRouter>
        <TimesheetForm />
      </MemoryRouter>
    );

  it("renders the form with initial elements", () => {
    renderTimesheetForm();
    expect(screen.getByText("Create Visit")).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toBeInTheDocument();
    expect(screen.getByLabelText("Time")).toBeInTheDocument();
    expect(screen.getByLabelText("Agent Phone (Optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Location")).toBeInTheDocument();
    expect(screen.getByLabelText("Agent")).toBeInTheDocument();
    expect(screen.getByLabelText("Reasons")).toBeInTheDocument();
    expect(screen.getByLabelText("Checklists")).toBeInTheDocument();
    expect(screen.getByText("Create Timesheet")).toBeDisabled();
  });

  it("fetches and displays locations on mount", async () => {
    renderTimesheetForm();
    await waitFor(() => {
      expect(agentAPI.getAgentLocations).toHaveBeenCalledWith(mockToken);
      const locationSelect = screen.getByLabelText(
        "Select a location"
      ) as HTMLSelectElement;
      expect(locationSelect.options.length).toBe(3);
      expect(locationSelect.options[1].text).toBe("Location1");
      expect(locationSelect.options[2].text).toBe("Location2");
    });
  });

  it("fetches agents when a location is selected", async () => {
    renderTimesheetForm();
    const locationSelect = screen.getByLabelText("Select a location");
    fireEvent.change(locationSelect, { target: { value: "Location1" } });

    await waitFor(() => {
      expect(agentAPI.getAgentsByLocation).toHaveBeenCalledWith(
        "Location1",
        mockToken
      );
      const agentSelect = screen.getByLabelText(
        "Select an agent"
      ) as HTMLSelectElement;
      expect(agentSelect.options.length).toBe(2);
      expect(agentSelect.options[1].text).toBe("Agent One (1234567890)");
    });
  });

  it("allows selecting reasons and checklists", async () => {
    renderTimesheetForm();
    await waitFor(() => {
      expect(reasonAPI.getAllReasons).toHaveBeenCalledWith(mockToken);
      expect(checklistAPI.getAllChecklists).toHaveBeenCalledWith(mockToken);
    });

    const reasonSelect = screen.getByLabelText("Select a reason");
    fireEvent.change(reasonSelect, { target: { value: "reason1" } });
    expect(screen.getByText("Reason One ×")).toBeInTheDocument();

    const checklistSelect = screen.getByLabelText("Select a checklist");
    fireEvent.change(checklistSelect, { target: { value: "checklist1" } });
    expect(screen.getByText("Checklist One ×")).toBeInTheDocument();
  });

  it("submits the form with valid data", async () => {
    renderTimesheetForm();

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2025-03-23" },
    });
    fireEvent.change(screen.getByLabelText("Time"), {
      target: { value: "14:00" },
    });
    fireEvent.change(screen.getByLabelText("Select a location"), {
      target: { value: "Location1" },
    });

    await waitFor(() => {
      fireEvent.change(screen.getByLabelText("Select an agent"), {
        target: { value: "agent1" },
      });
    });

    fireEvent.change(screen.getByLabelText("Select a reason"), {
      target: { value: "reason1" },
    });
    fireEvent.change(screen.getByLabelText("Select a checklist"), {
      target: { value: "checklist1" },
    });

    const submitButton = screen.getByText("Create Timesheet");
    expect(submitButton).not.toBeDisabled();
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(timesheetAPI.createTimesheet).toHaveBeenCalledWith(
        {
          weekNumber: 12,
          year: 2025,
          supervisorID: "user1",
          visits: [
            {
              date: "2025-03-23",
              time: "14:00:00",
              agentID: "agent1",
              reasons: [{ id: "reason1" }],
              checklists: [{ id: "checklist1" }],
            },
          ],
        },
        mockToken
      );
    });
  });

  it("redirects to login if user lacks permissions", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      token: mockToken,
      effectivePermissions: [],
      userRoles: [],
    });

    const mockNavigate = jest.fn();
    jest.mock("react-router-dom", () => ({
      ...jest.requireActual("react-router-dom"),
      useNavigate: () => mockNavigate,
    }));

    renderTimesheetForm();
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});
