import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import App from "./App";
import './index.css';
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css"; // Import the global theme CSS

// eslint-disable-next-line react-refresh/only-export-components
const Root: React.FC = () => {
  const { theme } = useTheme();
  React.useEffect(() => {
    document.body.className = theme; // Apply theme class to body
  }, [theme]);

  return <App />;
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  </React.StrictMode>
);