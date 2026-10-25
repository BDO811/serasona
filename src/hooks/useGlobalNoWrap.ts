import { useEffect } from "react";

// Keeps every leaf text element on one line by shrinking its font-size until
// it fits, instead of letting it wrap. Floors at MIN_SCALE of the element's
// own base size; if it still doesn't fit there, falls back to wrapping
// rather than clipping or rendering illegibly small text.
//
// MIN_SCALE is deliberately tight (not e.g. 0.55). A short phrase that's
// only slightly too wide (a heading, a button label) reads fine nudged down
// 10-15%. A multi-line paragraph or list item that would need to shrink much
// further than that to force itself onto one line just reads as broken —
// tested on the pricing page, where body copy designed to wrap across 2-3
// lines was shrinking to ~67% of its size (9px body text) to satisfy nowrap.
// Past this floor, wrapping is the better outcome, not a worse one.
const MIN_SCALE = 0.88;
const SHRINK_STEP = 0.96;
const MAX_ITERATIONS = 40;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "BR", "SVG", "PATH", "IMG", "CANVAS"]);

function hasLineClampOrTruncate(el: HTMLElement) {
  if (el.classList.contains("truncate")) return true;
  for (const cls of el.classList) if (cls.startsWith("line-clamp")) return true;
  const clamp = getComputedStyle(el).getPropertyValue("-webkit-line-clamp");
  return !!clamp && clamp !== "none";
}

function isCandidate(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (SKIP_TAGS.has(el.tagName)) return false;
  if (el.children.length > 0) return false; // only pure-text leaves; containers are handled via their leaf children
  if (el.isContentEditable) return false;
  if (el.closest("[data-allow-wrap]")) return false;
  if (hasLineClampOrTruncate(el)) return false;
  const text = el.textContent?.trim();
  if (!text) return false;
  return true;
}

function fitOne(el: HTMLElement) {
  const base = el.dataset.nowrapBase ? parseFloat(el.dataset.nowrapBase) : parseFloat(getComputedStyle(el).fontSize);
  if (!el.dataset.nowrapBase) el.dataset.nowrapBase = String(base);
  if (!Number.isFinite(base) || base <= 0) return;

  // Reset to the natural, wrapping layout FIRST so we measure the real
  // available width. Flex/grid items default to min-width:auto, so once
  // white-space:nowrap is applied their box grows to fit the content instead
  // of staying put — measuring clientWidth after that point is meaningless
  // (it just tracks scrollWidth and "fitting" looks true while the element
  // visibly overflows its container). The available width must be captured
  // before nowrap changes the box.
  el.style.whiteSpace = "";
  el.style.fontSize = `${base}px`;
  const availableWidth = el.clientWidth;
  if (availableWidth <= 0) return; // not laid out yet / detached; try again next sweep

  el.style.whiteSpace = "nowrap";
  const fullWidth = el.scrollWidth;
  if (fullWidth <= availableWidth + 1) return; // already fits on one line, nothing to do

  let size = base;
  const target = base * (availableWidth / fullWidth);
  if (target < base * MIN_SCALE) {
    // Can't fit even at the floor size: fall back to wrapping rather than
    // clipping or shrinking text to the point of being unreadable.
    el.style.whiteSpace = "";
    return;
  }

  size = target;
  el.style.fontSize = `${size}px`;

  // The width/font-size relationship isn't perfectly linear (kerning,
  // ligatures), so nudge down a little further if still short.
  let guard = 0;
  while (el.scrollWidth > availableWidth + 1 && size > base * MIN_SCALE && guard < MAX_ITERATIONS) {
    size *= SHRINK_STEP;
    el.style.fontSize = `${size}px`;
    guard += 1;
  }

  if (el.scrollWidth > availableWidth + 1) {
    el.style.whiteSpace = "";
    el.style.fontSize = `${base}px`;
  }
}

export function useGlobalNoWrap() {
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    const settleTimers: ReturnType<typeof setTimeout>[] = [];

    const sweep = () => {
      if (running) return; // our own style writes don't trigger this observer,
      running = true;       // but guard anyway against reentrancy from nested calls.
      try {
        document.querySelectorAll("body *").forEach((el) => {
          if (isCandidate(el)) fitOne(el);
        });
      } finally {
        running = false;
      }
    };

    const schedule = (delay = 150) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(sweep, delay);
    };

    // Entrance animations (framer-motion opacity/scale/translate transitions)
    // can still be mid-flight at mount, so an immediate measurement can lock
    // in a width from a not-yet-settled layout. Re-sweep a couple of times as
    // those animations finish — these run independently of the debounced
    // `schedule` above so they can't cancel each other out.
    settleTimers.push(setTimeout(sweep, 0), setTimeout(sweep, 500), setTimeout(sweep, 1200));

    // Re-measure once web fonts finish swapping in: metrics measured against
    // a fallback font can be wrong once the real font loads and reflows text.
    document.fonts?.ready?.then(() => schedule(0));

    const onResize = () => schedule();
    // Window resize only — NOT a ResizeObserver on document.body, which would
    // re-fire every time our own font-size writes change an element's box
    // size, creating a self-sustaining loop that starves the main thread.
    window.addEventListener("resize", onResize);

    // Mutation observer watches structural DOM changes only (not attributes),
    // so the inline styles we write here never re-trigger this observer.
    const mutationObserver = new MutationObserver(() => schedule());
    mutationObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      if (timeout) clearTimeout(timeout);
      settleTimers.forEach(clearTimeout);
      window.removeEventListener("resize", onResize);
      mutationObserver.disconnect();
    };
  }, []);
}
