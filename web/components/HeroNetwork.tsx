"use client";

import { useEffect, useRef } from "react";

type Node = { x: number; y: number; vx: number; vy: number; r: number; tw: number };
type Pulse = { a: number; b: number; t: number; speed: number };

/**
 * The hero background: a quiet network of cores. Points drift, nearby ones are
 * linked, and now and then a pulse runs along a link like a verdict moving
 * through the network. One canvas, a few dozen points, paused off screen.
 */
export default function HeroNetwork() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0, visible = true, last = 0;
    let nodes: Node[] = [];
    const pulses: Pulse[] = [];
    const LINK = 170, REACH = 210;
    // the cursor joins the network: links reach toward it, points lean away, a click sends a wave
    const mouse = { x: -9999, y: -9999, on: false };
    const waves: { x: number; y: number; r: number }[] = [];
    const host = cv.parentElement?.parentElement ?? cv;
    const onMove = (e: PointerEvent) => {
      const b = cv.getBoundingClientRect();
      mouse.x = e.clientX - b.left;
      mouse.y = e.clientY - b.top;
      mouse.on = mouse.y >= 0 && mouse.y <= b.height;
    };
    const onLeave = () => (mouse.on = false);
    const onClick = (e: PointerEvent) => {
      const b = cv.getBoundingClientRect();
      if (e.clientY - b.top > b.height) return;
      waves.push({ x: e.clientX - b.left, y: e.clientY - b.top, r: 0 });
      // the wave lights a few links near the click
      for (let i = 0; i < nodes.length && pulses.length < 14; i++) {
        const n = nodes[i];
        if (Math.hypot(n.x - (e.clientX - b.left), n.y - (e.clientY - b.top)) < 160) {
          const j = nodes.findIndex((m, k) => k !== i && Math.hypot(m.x - n.x, m.y - n.y) < LINK);
          if (j >= 0) pulses.push({ a: i, b: j, t: 0, speed: 0.03 + Math.random() * 0.02 });
        }
      }
    };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    host.addEventListener("pointerdown", onClick);

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(90, Math.max(36, (w * h) / 16000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: Math.random() < 0.12 ? 2.2 : 1 + Math.random() * 0.8,
        tw: Math.random() * Math.PI * 2,
      }));
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || now - last < 1000 / 40) return; // 40 fps is plenty for slow drift
      const dt = Math.min(50, now - last || 16) / 16;
      last = now;
      ctx.clearRect(0, 0, w, h);

      for (const n of nodes) {
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        if (n.x < -20) n.x = w + 20;
        if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20;
        if (n.y > h + 20) n.y = -20;
        if (mouse.on) {
          const dx = n.x - mouse.x, dy = n.y - mouse.y, d = Math.hypot(dx, dy);
          if (d < 90 && d > 0.1) {
            n.x += (dx / d) * (90 - d) * 0.02 * dt;
            n.y += (dy / d) * (90 - d) * 0.02 * dt;
          }
        }
      }
      // links to the cursor
      if (mouse.on) {
        for (const n of nodes) {
          const d = Math.hypot(n.x - mouse.x, n.y - mouse.y);
          if (d > REACH) continue;
          ctx.strokeStyle = `rgba(255,255,255,${((1 - d / REACH) * 0.35).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
        const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 120);
        g.addColorStop(0, "rgba(255,255,255,0.08)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 120, 0, Math.PI * 2);
        ctx.fill();
      }
      // click waves
      for (let i = waves.length - 1; i >= 0; i--) {
        const wv = waves[i];
        wv.r += 7 * dt;
        const a = 1 - wv.r / 420;
        if (a <= 0) {
          waves.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(255,255,255,${(a * 0.4).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, wv.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      // links: brighter when close, fading toward the edges of the screen
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 > LINK * LINK) continue;
          const k = 1 - Math.sqrt(d2) / LINK;
          ctx.strokeStyle = `rgba(255,255,255,${(k * 0.16).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          if (!still && pulses.length < 6 && Math.random() < 0.00035 * dt) pulses.push({ a: i, b: j, t: 0, speed: 0.012 + Math.random() * 0.01 });
        }
      }
      // points, with a slow twinkle
      for (const n of nodes) {
        n.tw += 0.02 * dt;
        ctx.fillStyle = `rgba(255,255,255,${(0.45 + 0.35 * Math.sin(n.tw)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // pulses: a bright dot with a short glow running along a link
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i], a = nodes[p.a], b = nodes[p.b];
        p.t += p.speed * dt;
        if (p.t >= 1 || !a || !b) {
          pulses.splice(i, 1);
          continue;
        }
        const x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 14);
        g.addColorStop(0, "rgba(255,255,255,0.9)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    size();
    const ro = new ResizeObserver(size);
    ro.observe(cv);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(cv);
    const onVis = () => (visible = !document.hidden);
    document.addEventListener("visibilitychange", onVis);
    if (still) {
      visible = true;
      frame(performance.now() + 100);
      cancelAnimationFrame(raf);
    } else raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerdown", onClick);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div className="absolute inset-0" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(1100px_620px_at_70%_35%,rgba(255,255,255,0.09),transparent_70%),radial-gradient(800px_500px_at_15%_90%,rgba(255,255,255,0.05),transparent_70%)]" />
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.25),transparent_30%,transparent_70%,#000)]" />
    </div>
  );
}
