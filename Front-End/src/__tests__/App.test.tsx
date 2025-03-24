import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "../App";
import { ThemeProvider } from "../context/ThemeContext";
import { AuthProvider } from "../context/AuthContext";
import { ErrorProvider } from "../context/ErrorContext";

// Mock context values
const mockAuthContext = {
  user: null,
  token: null,
  effectivePermissions: [],
  permissionsLoaded: true,
  userRoles: [],
  login: vi.fn(),
  logout: vi.fn(),
};

const mockAuthenticatedContext = {
  user: { id: 1, name: "Test User" },
  token: "fake-token",
  effectivePermissions: [{ name: "access_supervisor_timesheets" }],
  permissionsLoaded: true,
  userRoles: [{ name: "admin" }],
  login: vi.fn(),
  logout: vi.fn(),
};

// Mock useNavigate to control navigation in tests
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(), // Mock navigate function
  };
});

// Custom render with providers
const renderWithProviders = (authValue = mockAuthContext) => {
  return render(
    <ThemeProvider>
      <AuthProvider value={authValue}>
        <ErrorProvider>
          <App />
        </ErrorProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

describe("App", () => {
  it("redirects to /login when unauthenticated", async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText(/Login/i)).toBeInTheDocument();
    });
  });

  it("renders Timesheets page with proper permissions", async () => {
    vi.mock("react-router-dom", async () => {
      const actual = await vi.importActual("react-router-dom");
      return {
        ...actual,
        useLocation: () => ({ pathname: "/timesheet" }), // Mock location
        useNavigate: () => vi.fn(),
      };
    });
    renderWithProviders(mockAuthenticatedContext);
    await waitFor(() => {
      expect(screen.getByText(/Timesheets/i)).toBeInTheDocument(); // Adjust based on Timesheets.tsx
    });
  });

  it("redirects to /access-denied without permissions", async () => {
    vi.mock("react-router-dom", async () => {
      const actual = await vi.importActual("react-router-dom");
      return {
        ...actual,
        useLocation: () => ({ pathname: "/timesheet" }),
        useNavigate: () => vi.fn(),
      };
    });
    renderWithProviders({
      ...mockAuthenticatedContext,
      effectivePermissions: [],
    });
    await waitFor(() => {
      expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
    });
  });

  it("renders AdminDashboard with admin role", async () => {
    vi.mock("react-router-dom", async () => {
      const actual = await vi.importActual("react-router-dom");
      return {
        ...actual,
        useLocation: () => ({ pathname: "/admin" }),
        useNavigate: () => vi.fn(),
      };
    });
    renderWithProviders(mockAuthenticatedContext);
    await waitFor(() => {
      expect(screen.getByText(/Admin Dashboard/i)).toBeInTheDocument(); // Adjust based on AdminDashboard.tsx
    });
  });

  it("redirects to /access-denied without admin role", async () => {
    vi.mock("react-router-dom", async () => {
      const actual = await vi.importActual("react-router-dom");
      return {
        ...actual,
        useLocation: () => ({ pathname: "/admin" }),
        useNavigate: () => vi.fn(),
      };
    });
    renderWithProviders({
      ...mockAuthenticatedContext,
      userRoles: [],
    });
    await waitFor(() => {
      expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
    });
  });

  it("shows loading when permissions are not loaded", async () => {
    vi.mock("react-router-dom", async () => {
      const actual = await vi.importActual("react-router-dom");
      return {
        ...actual,
        useLocation: () => ({ pathname: "/timesheet" }),
        useNavigate: () => vi.fn(),
      };
    });
    renderWithProviders({
      ...mockAuthenticatedContext,
      permissionsLoaded: false,
    });
    expect(screen.getByText(/Loading permissions.../i)).toBeInTheDocument();
  });

  it("renders PageNotFound for unknown routes", async () => {
    vi.mock("react-router-dom", async () => {
      const actual = await vi.importActual("react-router-dom");
      return {
        ...actual,
        useLocation: () => ({ pathname: "/unknown" }),
        useNavigate: () => vi.fn(),
      };
    });
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText(/Page Not Found/i)).toBeInTheDocument(); // Adjust based on PageNotFound.tsx
    });
  });
});
