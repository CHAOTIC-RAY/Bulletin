// Registers the service worker and drives silent auto-update.
// Flow:
//   1. register /sw.js, then poll for updates periodically.
//   2. when a new SW is waiting, tell it to skipWaiting -> it activates.
//   3. on "SW_UPDATED" message (or controllerchange) we call onUpdate() so the
//      app can show a toast and reload automatically.

type UpdateHandler = () => void;

let refreshing = false;

export function registerPWA(onUpdate?: UpdateHandler) {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  // Don't register in dev (Vite HMR owns the page) — only in production build.
  if (import.meta.env.DEV) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Check for updates on load + every 60s.
        const check = () => reg.update().catch(() => {});
        check();
        setInterval(check, 60_000);

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // A new version is ready — activate it.
              newWorker.postMessage("SKIP_WAITING");
            }
          });
        });
      })
      .catch(() => {});
  });

  // When the active controller changes, a new SW took over -> reload once.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    onUpdate?.();
    window.location.reload();
  });

  // The SW itself also posts SW_UPDATED when it activates.
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SW_UPDATED" && !refreshing) {
      refreshing = true;
      onUpdate?.();
      window.location.reload();
    }
  });
}
