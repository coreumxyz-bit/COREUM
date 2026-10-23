"use client";

import { useEffect } from "react";

// Feeds the pointer position into the glass surface under it (--mx/--my),
// which its ::before spotlight follows. One listener for the whole page.
export default function PointerGlow() {
  useEffect(() => {
    const on = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(".glass-fx, .card-glow, .glass");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    window.addEventListener("pointermove", on, { passive: true });
    return () => window.removeEventListener("pointermove", on);
  }, []);
  return null;
}
