import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerPWA } from "./lib/pwa";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Installable PWA with silent auto-update. onUpdate fires right before reload
// so we can show a "New version — refreshing…" toast.
registerPWA(() => {
  const el = document.createElement("div");
  el.id = "pwa-update-toast";
  el.textContent = "New update available — refreshing…";
  el.style.cssText =
    "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;" +
    "background:#f59e0b;color:#000;font:600 13px system-ui,sans-serif;padding:10px 16px;" +
    "border:2px solid #000;box-shadow:3px 3px 0 #000;";
  document.body.appendChild(el);
});
