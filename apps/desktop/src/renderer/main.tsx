import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { BootstrapErrorBoundary } from "./BootstrapErrorBoundary";
import "./styles/app.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BootstrapErrorBoundary>
      <App />
    </BootstrapErrorBoundary>
  </React.StrictMode>
);
