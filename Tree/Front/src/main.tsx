import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import App from "./App";
import "./index.css";
import "./i18n";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";

// Memoized Root component
const Root: React.FC = React.memo(() => {
  const { theme } = useTheme();
  React.useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  return <App />;
});

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <Root />
  </ThemeProvider>
);