import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { ErrorProvider } from '../context/ErrorContext';

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
    user: { id: 1, name: 'Test User' },
    token: 'fake-token',
    effectivePermissions: ['access_supervisor_timesheets'],
    permissionsLoaded: true,
    userRoles: ['admin'],
    login: vi.fn(),
    logout: vi.fn(),
};

// Custom render with providers and routing
const renderWithProviders = (
    initialRoute: string,
    authValue = mockAuthContext
) => {
    return render(
        <MemoryRouter initialEntries={[initialRoute]}>
            <ThemeProvider>
                <AuthProvider value={authValue}>
                    <ErrorProvider>
                        <App />
                    </ErrorProvider>
                </AuthProvider>
            </ThemeProvider>
        </MemoryRouter>
    );
};

describe('App', () => {
    it('redirects to /login when unauthenticated', async () => {
        renderWithProviders('/');
        await waitFor(() => {
            expect(screen.getByText(/Login/i)).toBeInTheDocument();
        }, { timeout: 2000 });
    });

    it('renders Timesheets page with proper permissions', async () => {
        renderWithProviders('/timesheet', mockAuthenticatedContext);
        await waitFor(() => {
            expect(screen.getByText(/Timesheets/i)).toBeInTheDocument();
        }, { timeout: 2000 });
    });

    it('redirects to /access-denied without permissions', async () => {
        renderWithProviders('/timesheet', {
            ...mockAuthenticatedContext,
            effectivePermissions: [],
        });
        await waitFor(() => {
            expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
        }, { timeout: 2000 });
    });

    it('renders AdminDashboard with admin role', async () => {
        renderWithProviders('/admin', mockAuthenticatedContext);
        await waitFor(() => {
            expect(screen.getByText(/Admin Dashboard/i)).toBeInTheDocument();
        }, { timeout: 2000 });
    });

    it('redirects to /access-denied without admin role', async () => {
        renderWithProviders('/admin', {
            ...mockAuthenticatedContext,
            userRoles: [],
        });
        await waitFor(() => {
            expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
        }, { timeout: 2000 });
    });

    it('shows loading when permissions are not loaded', async () => {
        renderWithProviders('/timesheet', {
            ...mockAuthenticatedContext,
            permissionsLoaded: false,
        });
        expect(screen.getByText(/Loading permissions.../i)).toBeInTheDocument();
    });

    it('renders PageNotFound for unknown routes', async () => {
        renderWithProviders('/unknown');
        await waitFor(() => {
            screen.debug(); // Debug output
            expect(screen.getByText(/Page Not Found/i)).toBeInTheDocument();
        }, { timeout: 2000 });
    });
});