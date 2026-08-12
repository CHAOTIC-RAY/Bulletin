import React, { useEffect, useRef, useState } from "react";
import { proxied } from "../lib/imgProxy";

interface AutoImageReelProps {
  images: string[];
  intervalMs?: number; // default 3500
  className?: string;
  grayscale?: boolean;
  paused?: boolean; // pause when slide expanded / off-screen
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Bulletin feature: when a news item has MULTIPLE images, auto-switch between them
 * with a crossfade (TikTok/Reels-style gallery). Falls back to a static first
 * image when prefers-reduced-motion is set, or when paused/hidden.
 */
export default function AutoImageReel({ images, intervalMs = 3500, className = "", grayscale = false, paused = false }: AutoImageReelProps) {
  const [index, setIndex] = useState(0);
  const [hidden, setHidden] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Respect tab visibility — pause timer when document hidden.
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const reduced = prefersReducedMotion();
  const showReel = images.length > 1 && !reduced && !paused && !hidden;

  useEffect(() => {
    if (!showReel) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [showReel, images.length, intervalMs]);

  // Build the displayed set: reel images, or just the first for static/reduced.
  const display = images.length ? (showReel ? images : [images[0]]) : [];

  return (
    <div ref={containerRef} className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      {display.length === 0 ? (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/25 to-neutral-900" />
      ) : (
        display.map((src, i) => (
          <img
            key={src + i}
            src={proxied(src) || src}
            alt=""
            referrerPolicy="no-referrer"
            loading={i === 0 ? "eager" : "lazy"}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ease-in-out ${
              showReel
                ? i === index
                  ? "opacity-100 scale-105 z-10"
                  : "opacity-0 scale-100 z-0"
                : "opacity-100 scale-100 z-10"
            } ${grayscale ? "grayscale" : ""}`}
          />
        ))
      )}

      {/* Dots indicator when multiple images are switching */}
      {showReel && images.length > 1 && (
        <div className="absolute bottom-24 left-0 right-0 z-30 flex justify-center gap-1.5">
          {images.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-white" : "w-1.5 bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
