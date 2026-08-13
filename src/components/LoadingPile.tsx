import React from "react";

/**
 * LoadingPile — a newspaper-pile drop animation used while the feed loads or
 * refreshes. Four "papers" (Bulletin masthead copies) drop in with staggered
 * timing and the whole stack sweeps down + blurs on a 4s loop, looping forever.
 * Adapted from the AI Studio reference; theme-aware via currentColor.
 */
const BULLETIN_LOGO =
  "M194.16,54.97l-6.1,32.94-27.9,24.53,33.82,28.24.03,61.02-33.94,31-141.93.06,36.14-31.52-54.28-.27V.32s130.88-.14,130.88-.14l-.02,31.91-96.06.02.13,141.1L173.69,55.24l-33.37-.25.34-54.99,53.5,54.97ZM159.38,200.81l-.08-87.68-103.43,87.66,103.51.03Z";

const Paper = ({ variant }: { variant: "p1" | "p2" | "p3" | "p4" }) => (
  <div className={`lp-paper lp-${variant}`}>
    <svg className="lp-logo" viewBox="0 0 194.16 232.77" aria-hidden="true">
      <path d={BULLETIN_LOGO} />
    </svg>
    <div className="lp-rule" />
    <div className="lp-text" />
  </div>
);

export default function LoadingPile({ label, bare = false }: { label?: string; bare?: boolean }) {
  const scene = (
    <>
      <div className="lp-scene">
        <div className="lp-stack">
          <Paper variant="p1" />
          <Paper variant="p2" />
          <Paper variant="p3" />
          <Paper variant="p4" />
        </div>
      </div>
      {label ? <div className="lp-label">{label}</div> : null}
    </>
  );

  if (bare) {
    // Inline variant: caller positions/sizes the container (e.g. refresh overlay).
    return <div className="lp-bare flex flex-col items-center justify-center gap-7">{scene}</div>;
  }

  return (
    <div className="lp-root">
      <style>{`
        .lp-root {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background: #dcdcd8;
          gap: 28px;
        }
        .lp-scene {
          perspective: 1500px;
          width: 320px;
          height: 320px;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .lp-stack {
          position: relative;
          width: 150px;
          height: 195px;
          transform-style: preserve-3d;
          animation: lp-sweep 4s infinite cubic-bezier(0.45, 0, 0.55, 1);
        }
        .lp-paper {
          position: absolute;
          width: 100%;
          height: 100%;
          background: #ffffff;
          padding: 13px;
          box-sizing: border-box;
          border: 1px solid #ddd;
          box-shadow: 0 4px 10px rgba(0,0,0,0.1);
          opacity: 0;
          transform-origin: center center;
          backface-visibility: hidden;
        }
        .lp-logo { width: 52px; margin-bottom: 9px; display: block; fill: #1a1a1a; }
        .lp-rule { height: 4px; background: #1a1a1a; width: 100%; margin-bottom: 9px; }
        .lp-text {
          height: 78px;
          width: 100%;
          background: repeating-linear-gradient(transparent 0 4px, #e0e0e0 4px 6px);
        }
        @keyframes lp-paperDrop {
          0% { transform: translateZ(800px) translateY(-100px) rotateX(-30deg) rotate(20deg); opacity: 0; }
          15% { transform: translateZ(0) translateY(0) rotateX(0) rotate(var(--r)); opacity: 1; box-shadow: 0 15px 30px rgba(0,0,0,0.2); }
          80% { opacity: 1; transform: translateZ(0) translateY(0) rotate(var(--r)); }
          90% { opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes lp-sweep {
          0%, 75% { transform: translateY(0) rotateX(0deg); filter: blur(0); }
          85% { transform: translateY(600px) rotateX(30deg); filter: blur(4px); opacity: 1; }
          86%, 100% { transform: translateY(600px); opacity: 0; }
        }
        .lp-p1 { --r: -4deg; animation: lp-paperDrop 4s infinite 0.0s; z-index: 1; }
        .lp-p2 { --r: 3deg;  animation: lp-paperDrop 4s infinite 0.6s; z-index: 2; top: 4px; left: 4px; }
        .lp-p3 { --r: -2deg; animation: lp-paperDrop 4s infinite 1.2s; z-index: 3; top: -4px; left: 8px; }
        .lp-p4 { --r: 1deg;  animation: lp-paperDrop 4s infinite 1.8s; z-index: 4; top: 8px; left: -2px; }
        .lp-label {
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: #4b4b47;
          text-transform: uppercase;
        }
        @media (prefers-reduced-motion: reduce) {
          .lp-stack, .lp-paper { animation: none; }
          .lp-paper { opacity: 1; position: relative; transform: rotate(var(--r)); margin-top: 8px; }
          .lp-p1, .lp-p2, .lp-p3, .lp-p4 { top: 0; left: 0; }
        }
      `}</style>
      {scene}
    </div>
  );
}
