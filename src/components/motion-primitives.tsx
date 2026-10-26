import { ReactNode, useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion";

/**
 * The moving parts the marketing pages are built from.
 *
 * Two rules hold across all of them:
 *
 *   1. Motion is decoration, never the thing that makes content visible. Every
 *      primitive here renders its children in their final state when the user
 *      prefers reduced motion, and none of them gates text behind an animation
 *      that might not run. A headline that needs requestAnimationFrame to
 *      appear is a headline that is missing in a background tab and to a
 *      crawler.
 *   2. Scroll work is transform and opacity only. Animating layout properties
 *      on scroll is what makes a page feel heavy on a phone.
 */

/** Fades and lifts its children the first time they reach the viewport. */
export const Reveal = ({
  children,
  delay = 0,
  y = 22,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  // once: the section should settle, not re-animate every time it is scrolled
  // past. margin pulls the trigger up so it fires just before the edge.
  const inView = useInView(ref, { once: true, margin: "-12% 0px -12% 0px" });

  // The safety net. useInView is an IntersectionObserver, and an observer
  // against a viewport with no measurable size never reports anything as
  // visible — a hidden tab, a prerender, an embedder that lays out at zero.
  // Without this the content stays at opacity 0 forever, which is the one
  // outcome this file exists to prevent. If the observer has not fired
  // shortly after mount, show the content regardless and let the animation go.
  const [escaped, setEscaped] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setEscaped(true), 1200);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      animate={reduce || inView || escaped ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
};

/** Staggers its direct children into view one after another. */
export const RevealGroup = ({
  children,
  className,
  stagger = 0.09,
}: {
  children: ReactNode[];
  className?: string;
  stagger?: number;
}) => (
  <div className={className}>
    {children.map((child, i) => (
      <Reveal key={i} delay={i * stagger}>
        {child}
      </Reveal>
    ))}
  </div>
);

/**
 * Counts a number up when it first appears.
 *
 * Takes the display string ("2.4M", "14,000", "75+") and animates only the
 * numeric part, so the suffix and separators survive. The final string is
 * rendered immediately for reduced-motion users, and the animation always ends
 * on the exact input rather than on a rounded reconstruction.
 */
export const CountUp = ({ value, className }: { value: string; className?: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  const [shown, setShown] = useState(reduce ? value : null);

  const match = value.match(/^([\d.,]+)(.*)$/);
  const target = match ? parseFloat(match[1].replace(/,/g, "")) : null;
  const suffix = match ? match[2] : "";
  const decimals = match && match[1].includes(".") ? match[1].split(".")[1].length : 0;
  const grouped = match ? match[1].includes(",") : false;

  useEffect(() => {
    if (reduce || target === null || !inView) return;
    const DURATION = 1100;
    let raf = 0;
    let start: number | null = null;

    const tick = (t: number) => {
      start ??= t;
      const p = Math.min((t - start) / DURATION, 1);
      // easeOutExpo: fast settle, so the number is readable almost at once.
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      const n = target * eased;
      setShown(
        p === 1
          ? value
          : (grouped
              ? Math.round(n).toLocaleString("en-US")
              : n.toFixed(decimals)) + suffix
      );
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, target, value, suffix, decimals, grouped]);

  // Before the animation runs the final string is still what is in the DOM,
  // so the value is never missing to a crawler or a stalled frame loop.
  return (
    <span ref={ref} className={className}>
      {shown ?? value}
    </span>
  );
};

/**
 * A full-bleed image band that drifts against the scroll.
 *
 * The movement is small on purpose. Large parallax offsets have to be paid for
 * with an oversized image and they read as a gimmick; a few percent of travel
 * is enough to stop a static band feeling pasted on.
 */
export const ParallaxBand = ({
  src,
  children,
  height = "min-h-[62vh]",
}: {
  src: string;
  children?: ReactNode;
  height?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);

  return (
    <div ref={ref} className={`relative w-full overflow-hidden ${height}`}>
      <motion.img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-[118%] w-full object-cover"
        style={reduce ? undefined : { y }}
      />
      <div className="absolute inset-0 bg-[#111111]/35" />
      {children ? (
        <div className="relative flex min-h-[inherit] items-center justify-center px-6 py-24">
          {children}
        </div>
      ) : null}
    </div>
  );
};

/**
 * The CTA that follows you down the page.
 *
 * Appears only after the hero's own call to action has scrolled away, so the
 * page never shows two competing buttons at once.
 */
export const StickyCta = ({ onStart, afterPx = 900 }: { onStart: () => void; afterPx?: number }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // The home page scrolls an inner container rather than the window, so the
    // listener is attached to whichever element is actually scrolling.
    const scroller =
      document.querySelector<HTMLElement>(".overflow-y-auto") ?? (document.scrollingElement as HTMLElement);
    if (!scroller) return;
    const onScroll = () => setShow((scroller.scrollTop || window.scrollY) > afterPx);
    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
    };
  }, [afterPx]);

  return (
    <motion.div
      initial={false}
      animate={{ y: show ? 0 : 120, opacity: show ? 1 : 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-5"
    >
      <button
        onClick={onStart}
        tabIndex={show ? 0 : -1}
        aria-hidden={!show}
        className="pointer-events-auto min-h-[52px] whitespace-nowrap rounded-full bg-primary px-7 text-[15px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(17,17,17,0.12)] transition-colors hover:bg-bone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Try a free check-in
      </button>
    </motion.div>
  );
};
