import { useEffect, useRef } from "react";

const COLORS = ["#e0493f", "#2ea35a", "#efb02a", "#2f7fd4", "#c06bd6", "#ffffff"];

// Full-screen confetti + fireworks on a canvas. Purely decorative: it ignores
// pointer events, stops by itself, and is not rendered at all when the person
// prefers reduced motion (the caller checks that).
export default function Celebration({ duration = 4200, fireworks = true }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    let width = 0;
    let height = 0;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const confetti = Array.from({ length: 130 }, () => ({
      x: Math.random() * width,
      y: -20 - Math.random() * height * 0.6,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      vx: -1.5 + Math.random() * 3,
      vy: 2 + Math.random() * 3.5,
      rot: Math.random() * Math.PI,
      vr: -0.2 + Math.random() * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
    const sparks = [];
    let nextBurst = 250;
    const start = performance.now();
    let frame = 0;

    const burst = () => {
      const cx = width * (0.15 + Math.random() * 0.7);
      const cy = height * (0.12 + Math.random() * 0.35);
      const color = COLORS[Math.floor(Math.random() * (COLORS.length - 1))];
      for (let i = 0; i < 44; i++) {
        const angle = (i / 44) * Math.PI * 2;
        const speed = 2 + Math.random() * 3.2;
        sparks.push({ x: cx, y: cy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color });
      }
    };

    const tick = (now) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, width, height);

      const fade = elapsed > duration - 700 ? Math.max(0, (duration - elapsed) / 700) : 1;
      ctx.globalAlpha = fade;

      for (const piece of confetti) {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.rot += piece.vr;
        if (piece.y > height + 20 && elapsed < duration - 1500) {
          piece.y = -20;
          piece.x = Math.random() * width;
        }
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rot);
        ctx.fillStyle = piece.color;
        ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
        ctx.restore();
      }

      if (fireworks && elapsed >= nextBurst && elapsed < duration - 1200) {
        burst();
        nextBurst += 480 + Math.random() * 380;
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const spark = sparks[i];
        spark.x += spark.vx;
        spark.y += spark.vy;
        spark.vy += 0.045;
        spark.vx *= 0.99;
        spark.life -= 0.014;
        if (spark.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, spark.life) * fade;
        ctx.fillStyle = spark.color;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      if (elapsed < duration) frame = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, width, height);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [duration, fireworks]);

  return <canvas ref={canvasRef} className="ludo-confetti" aria-hidden="true" data-testid="ludo-celebration" />;
}
