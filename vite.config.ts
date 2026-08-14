import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import { defineConfig } from "vite";
import compression from "vite-plugin-compression2";

// Performance parity with Kora:
//  - Bake a stable version.json (semver from package.json) so the APK update
//    banner compares real versions, not a random per-build id.
//  - Emit a precache-manifest.json of hashed assets so a service worker (or the
//    Capacitor WebView) can warm the entry chunk + tab chunks on cold start.
//  - Brotli (.br) companions for static assets.
//  - cssCodeSplit:false + crossOrigin:false → inline CSS into JS and drop
//    crossorigin attrs, which prevents the Android WebView white-screen failure
//    mode when assets are served from file:// (APK) or a CDN.
//  - Keep framework code in the entry chunk (no vendor-react split) to avoid
//    ES-module TDZ boot bugs; only leaf/Worker-only libs (scraper) are split.

const buildId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const builtAt = new Date().toISOString();
const appChannel = process.env.VITE_APP_CHANNEL === "beta" ? "beta" : "production";

let pkgVersion = "0.0.0";
try {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));
  if (pkg?.version) pkgVersion = String(pkg.version);
} catch {
  /* keep default */
}

function manualChunks(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;
  // Worker-only / non-boot leaf libraries are safe to isolate.
  if (id.includes("linkedom") || id.includes("readability")) return "vendor-scraper";
  return undefined;
}

export default defineConfig(() => {
  return {
    define: {
      __BULLETIN_BUILD_ID__: JSON.stringify(buildId),
      __BULLETIN_VERSION__: JSON.stringify(pkgVersion),
    },
    envPrefix: ["VITE_"],
    plugins: [
      react(),
      // Brotli companions for static assets (skips already-compressed binaries).
      compression({
        algorithms: ["brotliCompress"],
        exclude: [/\.(?:png|jpe?g|gif|webp|svg|woff2?)$/i],
      }),
      {
        name: "bulletin-precache-manifest",
        writeBundle(_options: any, bundle: Record<string, any>) {
          const outDir = path.resolve(__dirname, "dist");
          const EXCLUDE = /(vendor-scraper)/;
          const files = Object.keys(bundle)
            .filter((f) => /\.(?:js|css)$/.test(f))
            .filter((f) => !EXCLUDE.test(f))
            .map((f) => `/${f}`);
          const manifest = {
            buildId,
            version: pkgVersion,
            assets: files.sort(),
            generatedAt: builtAt,
          };
          fs.mkdirSync(outDir, { recursive: true });
          fs.writeFileSync(
            path.join(outDir, "precache-manifest.json"),
            JSON.stringify(manifest, null, 2)
          );
          console.log(`[bulletin-precache-manifest] ${files.length} hashed assets`);
        },
      },
      {
        name: "bulletin-version-json",
        writeBundle() {
          const outDir = path.resolve(__dirname, "dist");
          fs.mkdirSync(outDir, { recursive: true });
          fs.writeFileSync(
            path.join(outDir, "version.json"),
            JSON.stringify({ buildId, version: pkgVersion, builtAt, channel: appChannel }, null, 2)
          );
          // Stamp sw.js so the browser always sees a byte change after redeploy.
          const swPath = path.join(outDir, "sw.js");
          if (fs.existsSync(swPath)) {
            fs.appendFileSync(swPath, `\n// bulletin-build ${buildId} ${builtAt}\n`);
          }
        },
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    build: {
      target: "es2020",
      // APK/WebView CRITICAL: inline all CSS into the JS bundle.
      cssCodeSplit: false,
      reportCompressedSize: true,
      chunkSizeWarningLimit: 900,
      // Remove crossorigin attrs from <script>/<link> (file:// origin in APK).
      crossOrigin: false,
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
    server: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: "all",
    },
  };
});
