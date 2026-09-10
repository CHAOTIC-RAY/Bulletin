'use strict';
const sharp = require('sharp');
const path = require('path');
const fsPromises = require('fs').promises;

// ---- config -----------------------------------------------------------------
const ROOT = path.resolve(__dirname, '..');                   // bulletin project root
const SVG_IN = path.resolve(ROOT, 'public/logo.svg');
const OUT_BASE = path.resolve(ROOT, 'android/app/src/main/res');

// Android density buckets (px @mdpi = dp). For adaptive-icon foreground we use the
// 108dp safe-zone size scaled by density; legacy launcher + notification icons use the
// standard density sizes.
const DENSITY_SIZES = {
  mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 216,
};
const FG_DENSITY_SIZES = {
  mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432,
};

// Brand colors pulled from manifest.webmanifest + capacitor.config.ts + index.html.
const DARK_BG = { r: 0x0E, g: 0x0E, b: 0x0C, alpha: 255 }; // #0E0E0C
const ACCENT = { r: 0xFF, g: 0xB0, b: 0x00, alpha: 255 };  // #FFB000

// XML templates (raw strings, newline-escaped for a single-line source).
const XML = {
  bg: `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<shape xmlns:android="http://schemas.android.com/apk/res/android">` +
    `<solid android:color="#0E0E0C"/></shape>`,

  fgLayer: `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<layer-list xmlns:android="http://schemas.android.com/apk/res/android">` +
    `<item><bitmap android:gravity="center" android:src="@mipmap/ic_launcher_foreground"/></item>` +
    `</layer-list>`,

  adaptive: `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">` +
    `<background android:drawable="@mipmap/ic_launcher_background"/>` +
    `<foreground android:drawable="@mipmap/ic_launcher_foreground"/>` +
    `</adaptive-icon>`,

  // API 31+ monochrome mode uses the same foreground as the adaptive icon.
  monochrome: `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">` +
    `<background android:drawable="@mipmap/ic_launcher_background"/>` +
    `<foreground android:drawable="@mipmap/ic_launcher_foreground"/>` +
    `</adaptive-icon>`,
};

// ---- helpers ----------------------------------------------------------------
async function mkdirp(p) { await fsPromises.mkdir(p, { recursive: true }); }

/** White logo on transparent, resized to `size x size` with fill crop. */
function transparent(size) {
  return sharp(SVG_IN).resize(size, size, { fit: 'fill' }).png();
}

/** White logo flattened onto a solid background color, resized to `size x size`. */
function flattened(size, bg) {
  return sharp(SVG_IN).resize(size, size, { fit: 'fill' }).flatten({ ...bg }).png();
}

async function writeXml(p, text) { await fsPromises.writeFile(p, text, 'utf8'); }

// ---- main -------------------------------------------------------------------
async function main() {
  // Ensure resource directories exist.
  const dirs = [
    'mipmap-anydpi-v26', 'mipmap-mdpi', 'mipmap-hdpi',
    'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi', 'drawable',
  ];
  for (const d of dirs) await mkdirp(path.join(OUT_BASE, d));

  // --- Adaptive-icon BACKGROUND XML (solid brand color, API 26+). --------------
  // A color-shape drawable is enough: Android reads the solid color directly.
  // Do NOT also write ic_launcher_background.png — cap sync generates its own
  // 1x1 PNG there and the two collide as "Duplicate resources".
  await writeXml(
    path.join(OUT_BASE, 'mipmap-anydpi-v26/ic_launcher_background.xml'),
    XML.bg,
  );

  // --- FOREGROUND layer-list XML (vector drawable referencing the PNG). -------
  await writeXml(
    path.join(OUT_BASE, 'mipmap-anydpi-v26/ic_launcher_foreground.xml'),
    XML.fgLayer,
  );

  // --- Adaptive-icon XMLs (API 26+). Same XML reused for round + monochrome. --
  for (const name of ['ic_launcher', 'ic_launcher_round', 'ic_launcher_monochrome']) {
    await writeXml(
      path.join(OUT_BASE, 'mipmap-anydpi-v26', `${name}.xml`),
      XML.adaptive,
    );
  }

  // --- Adaptive-icon FOREGROUND PNGs (white logo on transparent). -------------
  for (const [n, size] of Object.entries(FG_DENSITY_SIZES)) {
    await transparent(size)
      .toFile(path.join(OUT_BASE, `mipmap-${n}/ic_launcher_foreground.png`));
  }

  // --- Monochrome PNGs (API 31+ monochrome mode, white logo on transparent). -
  for (const [n, size] of Object.entries(FG_DENSITY_SIZES)) {
    await transparent(size)
      .toFile(path.join(OUT_BASE, `mipmap-${n}/ic_launcher_monochrome.png`));
  }

  // --- LEGACY launcher PNGs (pre-API-26 fallback: white logo on accent bg). --
  for (const [n, size] of Object.entries(DENSITY_SIZES)) {
    await flattened(size, ACCENT)
      .toFile(path.join(OUT_BASE, `mipmap-${n}/ic_launcher.png`));
    await flattened(size, ACCENT)
      .toFile(path.join(OUT_BASE, `mipmap-${n}/ic_launcher_round.png`));
  }

  // --- NOTIFICATION icons (white logo on transparent, per-density + drawable). -
  for (const [n, size] of Object.entries(DENSITY_SIZES)) {
    await transparent(size)
      .toFile(path.join(OUT_BASE, `mipmap-${n}/ic_stat_bulletin.png`));
    await transparent(size)
      .toFile(path.join(OUT_BASE, `mipmap-${n}/ic_stat_bulletin_round.png`));
  }
  await transparent(24)
    .toFile(path.join(OUT_BASE, 'drawable/ic_stat_bulletin.png'));
  await transparent(24)
    .toFile(path.join(OUT_BASE, 'drawable/ic_stat_bulletin_round.png'));

  // --- report -----------------------------------------------------------------
  const rel = p => path.relative(ROOT, p).replace(/\\/g, '/');
  console.log('Wrote Android icon assets into', rel(OUT_BASE));
  for (const e of await fsPromises.readdir(OUT_BASE, { withFileTypes: true })) {
    console.log(' ', rel(path.join(OUT_BASE, e.name)));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
