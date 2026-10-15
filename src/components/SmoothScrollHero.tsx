import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

export function SmoothScrollHero() {
  const heroRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
    lenis.on("scroll", ScrollTrigger.update);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // @ts-expect-error debug-only
    window.__debug = { lenis, gsap, raf };

    let split: SplitText | null = null;

    const ctx = gsap.context(() => {
      split = new SplitText(headlineRef.current, { type: "chars" });
      gsap.from(split.chars, {
        yPercent: 120,
        opacity: 0,
        stagger: 0.015,
        duration: 1,
        ease: "power4.out",
        delay: 0.15,
      });

      gsap.to(".hero-orb", {
        yPercent: 25,
        scale: 1.1,
        ease: "none",
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      gsap.to(".hero-scroll-cue", {
        opacity: 0,
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "12% top",
          scrub: true,
        },
      });

      // Pin the hero for one viewport height of scroll. Keep pinSpacing at
      // its default (true): turning it off shrinks the document's scroll
      // height the instant the pin engages, and Lenis watches content height
      // to recompute its own scroll limits — that resize-during-scroll fed
      // back into Lenis -> ScrollTrigger -> Lenis and pegged the main thread
      // (reproduced: every real wheel scroll froze the tab). pinSpacing:true
      // reserves the pin's space up front so the document height never
      // changes mid-scroll; the "next section rides up over the pinned hero"
      // look comes from the negative top margin on that section below instead.
      ScrollTrigger.create({
        trigger: heroRef.current,
        start: "top top",
        end: "bottom top",
        pin: true,
      });
    }, heroRef);

    return () => {
      // SplitText isn't tracked by gsap.context — revert it explicitly, before
      // ctx.revert(), or a React 18 StrictMode remount re-splits already-split
      // spans and corrupts the hero's measured height (collapses the pin to 0).
      split?.revert();
      ctx.revert();
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return (
    <div className="relative">
      <section
        ref={heroRef}
        className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-background"
      >
        <div className="hero-orb pointer-events-none absolute left-1/2 top-[-20%] h-[140%] w-[140%] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Daily voice check-in
        </p>
        <h1
          ref={headlineRef}
          className="mt-4 max-w-3xl px-6 text-center font-serif text-5xl font-semibold leading-[1.05] text-foreground sm:text-7xl"
        >
          Your voice already says how you're doing.
        </h1>
        <p className="mt-6 max-w-md px-6 text-center font-sans text-base text-muted-foreground">
          Serasona listens for stress, energy, and five other signals in under two minutes a day.
        </p>
        <div className="hero-scroll-cue absolute bottom-10 flex flex-col items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>Scroll</span>
          <span className="h-8 w-px bg-border" />
        </div>
      </section>

      <section className="relative z-10 -mt-[100vh] flex min-h-screen flex-col items-center justify-center gap-4 bg-card px-6 text-center">
        <h2 className="max-w-2xl font-serif text-3xl font-semibold text-foreground sm:text-4xl">
          Two minutes. Seven signals. One line to watch.
        </h2>
        <p className="max-w-md font-sans text-muted-foreground">
          Stress, mood, energy, confidence, mental fatigue, alertness, focus.
        </p>
      </section>
    </div>
  );
}
