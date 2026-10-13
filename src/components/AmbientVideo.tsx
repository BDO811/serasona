import { useEffect, useRef, useState } from "react";
import { asset } from "@/lib/asset";

/**
 * Full-bleed ambient footage behind the hero: two women in conversation,
 * shot in focus (licensed stock footage, Pexels clip 5252440). Legibility
 * against the hero copy comes from the wash overlay below, not from defocus,
 * so the footage itself is left sharp rather than pre-blurred in-camera.
 *
 * Mobile is the constraint this is built around:
 *
 *   - ~210 KB of H.264 and ~190 KB of VP9 at 960x540, with a ~24 KB poster.
 *     The poster paints immediately and the video replaces it when decoded,
 *     so the hero is never blank and never janks.
 *   - Nothing loads at all on a narrow screen or a metered connection. A
 *     background flourish is not worth a cellular download, so phones get the
 *     poster image and stop there.
 *   - Honoured prefers-reduced-motion, which for a decorative loop means not
 *     playing it.
 *
 * aria-hidden throughout: this carries no information, and a screen reader
 * announcing it would be noise.
 */
export const AmbientVideo = () => {
  const ref = useRef<HTMLVideoElement>(null);
  const [playable, setPlayable] = useState(false);

  useEffect(() => {
    const motionQ = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wideQ = window.matchMedia("(min-width: 768px)");

    const decide = () => {
      // Save-Data is the browser telling us the user is paying for this byte by
      // byte. navigator.connection is not in every engine, hence the cast.
      const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
        .connection;
      const metered = conn?.saveData === true || /^(slow-)?2g$/.test(conn?.effectiveType || "");
      // A zero width means the viewport has not been laid out yet (a hidden
      // tab, a prerender, the first paint in some embedders). Deciding on that
      // reading is how a desktop ends up permanently serving the phone
      // fallback, so treat it as "not yet known" and wait for a real value.
      const measured = window.innerWidth > 0;
      setPlayable(measured && wideQ.matches && !motionQ.matches && !metered);
    };

    decide();
    // Re-decide rather than deciding once: the viewport can be measured late,
    // and a window can be resized across the breakpoint after load.
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
    void ref.current?.play().catch(() => {});
  }, [playable]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* 80% transparent. Set as opacity on the footage itself rather than by
          stacking an opaque wash over it: a wash flattens the image toward one
          flat colour and kills the contrast inside it, where opacity keeps the
          picture intact and simply lets the paper through. */}
      <div className="absolute inset-0 opacity-20">
      {playable ? (
        <video
          ref={ref}
          className="h-full w-full object-cover"
          poster={asset("video/ambient-poster.jpg")}
          muted
          loop
          playsInline
          preload="none"
        >
          <source src={asset("video/ambient.webm")} type="video/webm" />
          <source src={asset("video/ambient.mp4")} type="video/mp4" />
        </video>
      ) : (
        <img
          src={asset("video/ambient-poster.jpg")}
          alt=""
          className="h-full w-full object-cover"
          loading="eager"
          decoding="async"
        />
      )}
      </div>

      {/* Only a bottom fade now. At 20% the footage is already quiet enough to
          sit under the headline, so the one job left is to land its bottom edge
          on paper rather than cutting the picture off mid-frame. */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#fbf7f1]" />
    </div>
  );
};
