/**
 * Capacitor / Android runtime helpers for the Bulletin APK.
 * Provides native platform detection, notification scheduling, and a fetch
 * shim so relative /api/* calls reach the Cloudflare Worker when running
 * inside the Capacitor WebView (file:// / localhost origin).
 */

import { Capacitor } from "@capacitor/core";

export function isNativeAndroid(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Production Worker / API origin for Capacitor builds (no trailing slash). */
export function getApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (isNativeApp()) return "https://ticstudio.workers.dev";
  return "";
}

/** Prefix relative /api paths when the SPA is bundled inside the APK. */
export function resolveApiUrl(input: string): string {
  if (!input) return input;
  const base = getApiBaseUrl();
  if (!base) return input;
  if (input.startsWith("/api/") || input === "/api") {
    return `${base}${input}`;
  }
  try {
    const u = new URL(input, typeof window !== "undefined" ? window.location.origin : "https://localhost");
    if (u.pathname.startsWith("/api/")) {
      return `${base}${u.pathname}${u.search}${u.hash}`;
    }
  } catch {
    /* ignore */
  }
  return input;
}

/** Patch global fetch so relative /api/* calls reach the Worker inside the APK. */
export function installCapacitorApiFetchShim(): void {
  if (typeof window === "undefined") return;
  if (!isNativeApp()) return;
  const base = getApiBaseUrl();
  if (!base) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    try {
      if (typeof input === "string") return originalFetch(resolveApiUrl(input), init);
      if (input instanceof URL) return originalFetch(resolveApiUrl(input.toString()), init);
      if (input instanceof Request) {
        const nextUrl = resolveApiUrl(input.url);
        if (nextUrl !== input.url) return originalFetch(new Request(nextUrl, input), init);
      }
    } catch {
      /* ignore */
    }
    return originalFetch(input as RequestInfo, init);
  }) as typeof fetch;
}

/** Schedule / show a local notification (update available, daily brief). */
export async function showNativeNotification(opts: {
  title: string;
  body: string;
  id?: number;
  extra?: Record<string, unknown>;
}): Promise<void> {
  if (!isNativeAndroid()) {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(opts.title, { body: opts.body });
      }
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.schedule({
      notifications: [
        {
          id: opts.id ?? Math.floor(Date.now() % 1_000_000_000),
          title: opts.title,
          body: opts.body,
          schedule: { at: new Date(Date.now() + 250) },
          extra: opts.extra,
          channelId: "bulletin_default",
        },
      ],
    });
  } catch {
    /* ignore */
  }
}

/** Ensure notification channel exists (Android 8+). */
export async function ensureNotificationChannel(): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.createChannel({
      id: "bulletin_default",
      name: "Bulletin",
      description: "App updates and daily news briefs",
      importance: 5,
      visibility: 1,
      sound: "default",
      vibration: true,
      lights: true,
    });
  } catch {
    /* ignore */
  }
}
