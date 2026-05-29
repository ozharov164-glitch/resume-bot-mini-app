import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { applyLockedLightTheme } from "./lib/theme";
import { initTelegramTheme } from "./telegram";
import "./styles/globals.css";

applyLockedLightTheme();
initTelegramTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
