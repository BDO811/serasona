import { useEffect, useRef, useState } from "react";
import { useMemberMotion } from "./MemberShell";

/** Decorative artwork. Never presents itself as a visualization of recorded audio. */
export function VoiceSculpture() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moving = useMemberMotion();
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0, visible = true, width = 0, height = 0;
    const draw = (ms: number) => {
      cancelAnimationFrame(frame);
      if (!width || !height) return;
      const t = moving ? ms * .00014 : 1.2;
      ctx.clearRect(0, 0, width, height);
      const scale = Math.min(width * .25, height * .245);
      const points: Array<{ x: number; y: number; z: number; color: string }> = [];
      for (let j = 0; j < 32; j++) for (let k = 0; k < 72; k++) {
        const a = j / 32 * Math.PI * 2, b = k / 72 * Math.PI * 2;
        const radius = 1.04 + .13 * Math.sin(a * 3 + t * 3);
        const ring = .36 + .08 * Math.sin(b * 4 + a * 3 + t * 4);
        const x = (radius + ring * Math.cos(b)) * Math.cos(a);
        const y = (radius + ring * Math.cos(b)) * Math.sin(a);
        const z = ring * Math.sin(b);
        const xx = x * Math.cos(t) + z * Math.sin(t);
        const zz = -x * Math.sin(t) + z * Math.cos(t);
        const yy = y * Math.cos(.85) - zz * Math.sin(.85);
        const depth = y * Math.sin(.85) + zz * Math.cos(.85);
        const perspective = 3.8 / (3.8 + depth);
        points.push({ x: width * .52 + xx * scale * perspective, y: height * .5 + yy * scale * perspective, z: depth, color: j < 11 ? "112,63,190" : j < 22 ? "232,107,65" : "62,100,212" });
      }
      points.sort((a, b) => b.z - a.z);
      for (const point of points) {
        ctx.fillStyle = `rgba(${point.color},${.38 + (1.5 - point.z) * .18})`;
        ctx.beginPath(); ctx.arc(point.x, point.y, 1.8, 0, Math.PI * 2); ctx.fill();
      }
      if (moving && visible && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const resize = () => {
      const box = canvas.getBoundingClientRect(), ratio = Math.min(devicePixelRatio || 1, 2);
      width = box.width; height = box.height;
      canvas.width = width * ratio; canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); draw(performance.now());
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) draw(performance.now()); else cancelAnimationFrame(frame); });
    observer.observe(canvas);
    const visibility = () => { if (document.hidden) cancelAnimationFrame(frame); else if (visible) draw(performance.now()); };
    document.addEventListener("visibilitychange", visibility);
    resize();
    return () => { cancelAnimationFrame(frame); resizeObserver.disconnect(); observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, [moving]);
  return <canvas ref={canvasRef} className="voice-sculpture" aria-hidden="true" />;
}

export function VoiceWave() {
  const ref = useRef<HTMLDivElement>(null);
  const moving = useMemberMotion();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let inView = false;
    const update = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update(); });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);
  return <div ref={ref} className="member-wave" aria-hidden="true">{Array.from({ length: 42 }, (_, i) => <i key={i} style={{ height: `${8 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * .12)) * 48}px`, animationDelay: `${i * -70}ms`, animationPlayState: visible && moving ? "running" : "paused" }} />)}</div>;
}
