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
    // Real Bulletin launcher + notification icons generated from public/logo.svg
    // into android/app/src/main/res by `npx node scripts/gen-android-icon.cjs`.
    icon: "ic_launcher",
    roundIcon: "ic_launcher_round",
    adaptiveIconBackgroundColor: "#0E0E0C",
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_bulletin",
      iconColor: "#FFB000",
    },
  },
};

export default config;
