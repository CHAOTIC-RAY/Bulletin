import React, { useMemo } from "react";

/**
 * NoImageArt — animated backdrop for news cards that have no image.
 * Evokes the LoadingPile "newspaper drop" motif but is UNIQUE each mount:
 * paper count, rotation, tint, drift direction and motion variant are derived
 * from a seed (item id) XOR a random nonce, so every time a card mounts it
 * looks a little different. Perpetual, GPU-friendly (transform/opacity only).
 */

const BULLETIN_LOGO =
  "M194.16,54.97l-6.1,32.94-27.9,24.53,33.82,28.24.03,61.02-33.94,31-141.93.06,36.14-31.52-54.28-.27V.32s130.88-.14,130.88-.14l-.02,31.91-96.06.02.13,141.1L173.69,55.24l-33.37-.25.34-54.99,53.5,54.97ZM159.38,200.81l-.08-87.68-103.43,87.66,103.51.03Z";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) >>> 0;
}

type Variant = "pile" | "scatter" | "orbit" | "sweep";

interface Paper {
  rot: number;
  x: number;
  y: number;
  scale: number;
  delay: number;
  tint: string;
  size: number;
}

export default function NoImageArt({ seed }: { seed: string }) {
  const { variant, dur, papers, styleId } = useMemo(() => {
    const nonce = Math.floor(Math.random() * 1e9);
    const n = (hash(seed) ^ nonce) >>> 0;
    const rnd = (k: number) => {
      const x = Math.sin((n + k * 9301) * 0.000137) * 10000;
      return x - Math.floor(x);
    };
    const variants: Variant[] = ["pile", "scatter", "orbit", "sweep"];
    const v = variants[Math.floor(rnd(1) * variants.length)];
    const count = 3 + Math.floor(rnd(2) * 3); // 3..5
    const duration = 3.4 + rnd(3) * 2.2; // 3.4..5.6s
    const tints = ["#f59e0b", "#fbbf24", "#e5e5e5", "#a3a3a3", "#d97706"];
    const ps: Paper[] = Array.from({ length: count }, (_, i) => ({
      rot: (rnd(10 + i) - 0.5) * 46,
      x: (rnd(20 + i) - 0.5) * 70,
      y: (rnd(30 + i) - 0.5) * 46,
      scale: 0.7 + rnd(40 + i) * 0.55,
      delay: rnd(50 + i) * (v === "pile" ? 2.4 : 1.3),
      tint: tints[Math.floor(rnd(60 + i) * tints.length)],
      size: 70 + Math.floor(rnd(70 + i) * 60),
    }));
    return { variant: v, dur: duration, papers: ps, styleId: `nia-${n.toString(36)}` };
  }, [seed]);

  const keyframes: Record<Variant, string> = {
    pile: `
      @keyframes nia-pile-${styleId} {
        0% { transform: translateY(-150%) rotate(var(--r)) scale(var(--s)); opacity: 0; }
        14% { transform: translateY(0) rotate(var(--r)) scale(var(--s)); opacity: 1; }
        68% { transform: translateY(0) rotate(var(--r)) scale(var(--s)); opacity: 1; }
        86% { transform: translateY(70%) rotate(calc(var(--r) * 1.4)) scale(var(--s)); opacity: 0; filter: blur(3px); }
        100% { transform: translateY(-150%) rotate(var(--r)) scale(var(--s)); opacity: 0; }
      }`,
    scatter: `
      @keyframes nia-scatter-${styleId} {
        0% { transform: translate(calc(var(--x) * -1.4), calc(var(--y) * -1.4)) rotate(var(--r)) scale(var(--s)); opacity: 0; }
        18% { opacity: 1; }
        50% { transform: translate(calc(var(--x) * 0.5), calc(var(--y) * 0.5)) rotate(calc(var(--r) * -0.6)) scale(var(--s)); opacity: 1; }
        82% { opacity: 1; }
        100% { transform: translate(var(--x), var(--y)) rotate(var(--r)) scale(var(--s)); opacity: 0; }
      }`,
    orbit: `
      @keyframes nia-orbit-${styleId} {
        0% { transform: rotate(0deg) translateX(46px) rotate(calc(var(--r) * -1)) scale(var(--s)); opacity: 0; }
        12% { opacity: 1; }
        88% { opacity: 1; }
        100% { transform: rotate(360deg) translateX(46px) rotate(calc(var(--r) * -1 - 360deg)) scale(var(--s)); opacity: 0; }
      }`,
    sweep: `
      @keyframes nia-sweep-${styleId} {
        0% { transform: translateX(-160%) rotate(var(--r)) scale(var(--s)); opacity: 0; }
        15% { transform: translateX(0) rotate(var(--r)) scale(var(--s)); opacity: 1; }
        70% { transform: translateX(0) rotate(var(--r)) scale(var(--s)); opacity: 1; }
        90% { transform: translateX(160%) rotate(var(--r)) scale(var(--s)); opacity: 0; }
        100% { transform: translateX(-160%) rotate(var(--r)) scale(var(--s)); opacity: 0; }
      }`,
  };

  const animName = `nia-${variant}-${styleId}`;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-gradient-to-br from-amber-600/30 to-neutral-950">
      <style>{keyframes[variant]}</style>
      <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: "1200px" }}>
        {papers.map((p, i) => (
          <div
            key={i}
            className="absolute"
            style={
              {
                width: p.size,
                height: p.size * 1.3,
                background: "#ffffff",
                border: "1px solid #ddd",
                boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
                borderRadius: 2,
                opacity: 0,
                ["--r" as any]: `${p.rot}deg`,
                ["--s" as any]: p.scale,
                ["--x" as any]: `${p.x}px`,
                ["--y" as any]: `${p.y}px`,
                animation: `${animName} ${dur}s cubic-bezier(0.45,0,0.55,1) ${p.delay}s infinite`,
                transformOrigin: "center center",
              } as React.CSSProperties
            }
          >
            <svg
              viewBox="0 0 194.16 232.77"
              className="w-1/2 mx-auto mt-2 block"
              style={{ fill: p.tint }}
              aria-hidden="true"
            >
              <path d={BULLETIN_LOGO} />
            </svg>
            <div className="h-1 mx-2 mt-1.5 bg-neutral-900/80" />
            <div
              className="mx-2 mt-1.5 bg-neutral-200"
              style={{ height: p.size * 0.5, backgroundImage: "repeating-linear-gradient(transparent 0 4px, #e5e5e5 4px 6px)" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
