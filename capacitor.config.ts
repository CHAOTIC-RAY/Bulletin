import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for the Bulletin Android APK.
 * Web assets are built into ./dist, then synced into the Android project.
 * News API / scraping is served from the Cloudflare Worker; relative /api/*
 * calls are rewritten at runtime to VITE_API_BASE_URL (production Worker).
 */
const config: CapacitorConfig = {
  appId: "com.chaoticray.bulletin",
  appName: "Bulletin",
  webDir: "dist",
  server: {
    androidScheme: "https",
    allowNavigation: [
      "*.workers.dev",
      "r.jina.ai",
      "api.github.com",
      "*.githubusercontent.com",
      "github.com",
    ],
  },
  android: {
    allowMixedContent: true,
    backgroundColor: "#18181B",
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#FFB000",
    },
  },
};

export default config;
