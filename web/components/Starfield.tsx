"use client";

import { useEffect, useRef } from "react";

const PALETTE = [
  "#ffffff",
  "#d9d9d9",
  "#9a9a9a",
  "#bdbdbd",
  "#ffffff",
  "#6f6f6f",
  "#efefef",
];

type Particle = {
  x: number;
  y: number;
  size: number;
  color: string;
  alpha: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  phase: number;
  drift: number;
};

/**
 * Signature brand visual: a dense brain-shaped cloud of tiny outlined
 * triangles in a vivid chromatic spectrum, glowing on pure black.
 */
export default function Starfield({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let particles: Particle[] = [];
    let lines: [number, number][] = [];
    let raf = 0;
    let width = 0;
    let height = 0;
    let t0 = 0;

    // Organic brain silhouette in normalized coords centered at (0,0).
    function inBrain(px: number, py: number): boolean {
      const theta = Math.atan2(py / 0.82, px);
      const r = Math.sqrt(px * px + (py / 0.82) * (py / 0.82));

      // Bumpy outline — folds of the cortex
      const bumps =
        0.66 +
        0.055 * Math.sin(theta * 5 + 0.7) +
        0.04 * Math.sin(theta * 9 - 1.2) +
        0.028 * Math.sin(theta * 14 + 2.4);

      if (r > bumps) {
        // allow the cerebellum lobe to extend past the main outline
        const cx = px / 0.3;
        const cy = (py - 0.62) / 0.22;
        if (cx * cx + cy * cy >= 1) return false;
      }

      // Central fissure — vertical split
      const fis = 0.03 + 0.018 * Math.sin(py * 11);
      if (Math.abs(px) < fis && py < 0.35 && py > -0.7) return false;

      // Lateral sulcus hints — two shallow carved lines
      const s1 = Math.abs(py - (0.18 * Math.sign(px) - 0.1));
      if (s1 < 0.03 && Math.abs(px) > 0.22 && Math.abs(px) < 0.55) return false;
      const s2 = Math.abs(py + 0.32 - 0.1 * Math.sin(px * 4));
      if (s2 < 0.025 && Math.abs(px) > 0.15 && Math.abs(px) < 0.5) return false;

      return true;
    }

    function build() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas!.getBoundingClientRect();
      width = Math.max(rect.width, 1);
      height = Math.max(rect.height, 1);
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cx = width / 2;
      const cy = height / 2;
      const scale = Math.min(width, height) * 0.46;

      // Dense core cloud
      const count = Math.min(2600, Math.floor((width * height) / 95));
      const next: Particle[] = [];
      let attempts = 0;

      while (next.length < count && attempts < count * 8) {
        attempts++;
        const px = Math.random() * 2 - 1;
        const py = Math.random() * 2 - 1;
        if (!inBrain(px, py)) continue;

        const x = cx + px * scale;
        const y = cy + py * scale;

        next.push({
          x,
          y,
          size: 2.5 + Math.random() * 5.5,
          color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
          alpha: 0.35 + Math.random() * 0.65,
          vx: (Math.random() - 0.5) * 0.1,
          vy: (Math.random() - 0.5) * 0.1,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.008,
          phase: Math.random() * Math.PI * 2,
          drift: 1.5 + Math.random() * 2.5,
        });
      }

      // Ambient scatter around the brain
      const ambient = Math.floor(count * 0.12);
      for (let i = 0; i < ambient; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = scale * (1.1 + Math.random() * 0.9);
        next.push({
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist * 0.85,
          size: 1.5 + Math.random() * 3,
          color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
          alpha: 0.1 + Math.random() * 0.3,
          vx: (Math.random() - 0.5) * 0.14,
          vy: (Math.random() - 0.5) * 0.14,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.012,
          phase: Math.random() * Math.PI * 2,
          drift: 3 + Math.random() * 5,
        });
      }

      particles = next;

      // connective lines between close core particles
      lines = [];
      const maxLines = 420;
      for (let i = 0; i < particles.length && lines.length < maxLines; i += 2) {
        const a = particles[i];
        for (let j = i + 1; j < Math.min(i + 40, particles.length); j += 3) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 2100 && a.alpha > 0.5 && b.alpha > 0.5) {
            lines.push([i, j]);
            break;
          }
        }
      }
    }

    function drawTriangle(x: number, y: number, s: number, rot: number, color: string, alpha: number) {
      ctx!.globalAlpha = alpha;
      ctx!.strokeStyle = color;
      ctx!.lineWidth = 1.2;
      ctx!.save();
      ctx!.translate(x, y);
      ctx!.rotate(rot);
      ctx!.beginPath();
      ctx!.moveTo(0, -s);
      ctx!.lineTo(s * 0.87, s * 0.5);
      ctx!.lineTo(-s * 0.87, s * 0.5);
      ctx!.closePath();
      ctx!.stroke();
      ctx!.restore();
    }

    function frame(t: number) {
      if (!t0) t0 = t;
      const elapsed = (t - t0) / 1000;

      ctx!.clearRect(0, 0, width, height);

      // Drift particles
      for (const p of particles) {
        p.x += p.vx + Math.sin(elapsed * 0.4 + p.phase) * 0.04;
        p.y += p.vy + Math.cos(elapsed * 0.33 + p.phase) * 0.04;
        p.rot += p.vr;
      }

      // connective lines
      ctx!.globalAlpha = 0.09;
      ctx!.strokeStyle = "#ffffff";
      ctx!.lineWidth = 0.7;
      ctx!.beginPath();
      for (const [i, j] of lines) {
        const a = particles[i];
        const b = particles[j];
        if (!a || !b) continue;
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
      }
      ctx!.stroke();

      // Particles with soft pulse
      for (const p of particles) {
        const pulse = 0.7 + 0.3 * Math.sin(elapsed * 1.1 + p.phase);
        const a = p.alpha * pulse;
        // soft halo pass for larger particles
        if (p.size > 5) {
          drawTriangle(p.x, p.y, p.size * 1.8, p.rot, p.color, a * 0.08);
        }
        drawTriangle(p.x, p.y, p.size, p.rot, p.color, a);
      }

      ctx!.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }

    build();
    raf = requestAnimationFrame(frame);

    const onResize = () => {
      cancelAnimationFrame(raf);
      build();
      t0 = 0;
      raf = requestAnimationFrame(frame);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className={className} style={{ position: "relative" }}>
      {/* Ambient violet glow behind the cloud */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "8%",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.07) 45%, transparent 70%)",
          filter: "blur(28px)",
          pointerEvents: "none",
        }}
      />
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        aria-hidden
      />
    </div>
  );
}
