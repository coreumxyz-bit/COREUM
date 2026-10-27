"use client";

import { useEffect } from "react";

// Glass cards lean toward the cursor (desktop only). One listener for the whole
// page; the angle goes into CSS variables, the transform runs on the GPU.
export default function MotionInit() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cur: HTMLElement | null = null, raf = 0, ev: PointerEvent | null = null;
    const reset = (el: HTMLElement) => {
      el.style.removeProperty("--rx");
      el.style.removeProperty("--ry");
      el.classList.remove("tilting");
    };
    const apply = () => {
      raf = 0;
      if (!ev) return;
      const el = (ev.target as Element | null)?.closest?.<HTMLElement>(".glass-fx:not(.float), .card-glow, .lift");
      if (cur && cur !== el) reset(cur);
      cur = el ?? null;
      if (!el) return;
      const b = el.getBoundingClientRect();
      if (b.width > 900) return; // whole-width panels stay flat
      const x = (ev.clientX - b.left) / b.width - 0.5, y = (ev.clientY - b.top) / b.height - 0.5;
      el.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(x * 8).toFixed(2)}deg`);
      el.classList.add("tilting");
    };
    const onMove = (e: PointerEvent) => {
      ev = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onOut = () => {
      if (cur) reset(cur);
      cur = null;
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onOut);
    window.addEventListener("blur", onOut);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onOut);
      window.removeEventListener("blur", onOut);
      cancelAnimationFrame(raf);
    };
  }, []);
  return <div className="scroll-progress" aria-hidden />;
}
