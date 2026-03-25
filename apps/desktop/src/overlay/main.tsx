import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./overlay.css";

ReactDOM.createRoot(document.getElementById("overlay-root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

