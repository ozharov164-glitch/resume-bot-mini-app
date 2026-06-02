import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { ensureMaterialIconsReady } from "./lib/materialIcons";
import { applyLockedLightTheme } from "./lib/theme";
import { initTelegramTheme } from "./telegram";
import "./styles/globals.css";

async function boot() {
  applyLockedLightTheme();
  initTelegramTheme();
  await ensureMaterialIconsReady();

  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    const base = import.meta.env.BASE_URL || "/";
    navigator.serviceWorker.register(`${base}sw.js`).catch(() => undefined);
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void boot();
