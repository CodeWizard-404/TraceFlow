import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import AuthProvider from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import App from './App';
import './index.css';
import './i18n';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

// Render the app with Router and other providers
createRoot(document.getElementById('root')!).render(
  <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  </Router>
);