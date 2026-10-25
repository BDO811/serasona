import { useEffect, useRef, useState } from "react";
import { asset } from "@/lib/asset";

/**
 * Quiet workout footage behind the score banner's glass cards, on the same
 * terms as the marketing hero's AmbientVideo: desktop and a non-metered
 * connection only, off entirely under prefers-reduced-motion (a still poster
 * takes its place), muted, looped, and never competing with the score cards
 * sitting on top of it.
 */
export function ScoreBannerVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playable, setPlayable] = useState(false);

  useEffect(() => {
    const motionQ = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wideQ = window.matchMedia("(min-width: 768px)");
    const decide = () => {
      const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
      const metered = conn?.saveData === true || /^(slow-)?2g$/.test(conn?.effectiveType || "");
      const measured = window.innerWidth > 0;
      setPlayable(measured && wideQ.matches && !motionQ.matches && !metered);
    };
    decide();
    motionQ.addEventListener("change", decide);
    wideQ.addEventListener("change", decide);
    window.addEventListener("resize", decide);
    return () => {
      motionQ.removeEventListener("change", decide);
      wideQ.removeEventListener("change", decide);
      window.removeEventListener("resize", decide);
    };
  }, []);

  useEffect(() => {
    if (!playable) return;
    ref.current?.play()?.catch(() => {});
  }, [playable]);

  return <div className="dv-score-backdrop" aria-hidden="true">
    {playable ? (
      <video ref={ref} className="dv-score-backdrop-media" poster={asset("video/workout-poster.jpg")} muted loop playsInline preload="none">
        <source src={asset("video/workout.webm")} type="video/webm" />
        <source src={asset("video/workout.mp4")} type="video/mp4" />
      </video>
    ) : (
      <img src={asset("video/workout-poster.jpg")} alt="" className="dv-score-backdrop-media" loading="eager" decoding="async" />
    )}
  </div>;
}
