import { motion, useReducedMotion } from "framer-motion";

/**
 * The figure beside the check-in, and the arrows that change it.
 *
 * Drawn rather than photographed. Two silhouettes that have to read as "this
 * is you" at a glance, in brand colour, at any size, for about a kilobyte —
 * a photograph would need two licensed models, would date, and would make one
 * body the default idea of a person.
 *
 * The arrows exist because the stored value is a guess until someone corrects
 * it. Nothing about the reading changes when it is switched; the model does
 * not take sex as an input here. It changes which drawing someone sees of
 * themselves, which is worth getting right and is cheap to let them fix.
 */

export type BiologicalSex = "male" | "female";
export type AgeBand = "under30" | "30-45" | "46-60" | "60+";

const AGE_RANGES: Array<{ id: AgeBand; label: string }> = [
  { id: "under30", label: "<30" },
  { id: "30-45", label: "30-45" },
  { id: "46-60", label: "46-60" },
  { id: "60+", label: "60+" },
];

const Figure = ({ sex, tone }: { sex: BiologicalSex; tone: string }) => (
  <svg viewBox="0 0 120 260" width="100%" height="100%" aria-hidden="true">
    {/* head */}
    <circle cx="60" cy="34" r="22" fill={tone} opacity="0.18" />
    <circle cx="60" cy="34" r="22" fill="none" stroke={tone} strokeWidth="1.5" opacity="0.5" />

    {sex === "male" ? (
      <>
        {/* shoulders wider than hips */}
        <path
          d="M60 62 C34 62 24 74 22 96 L18 150 L34 150 L36 118 L36 236 L54 236 L56 160 L64 160 L66 236 L84 236 L84 118 L86 150 L102 150 L98 96 C96 74 86 62 60 62 Z"
          fill={tone}
          opacity="0.18"
        />
        <path
          d="M60 62 C34 62 24 74 22 96 L18 150 L34 150 L36 118 L36 236 L54 236 L56 160 L64 160 L66 236 L84 236 L84 118 L86 150 L102 150 L98 96 C96 74 86 62 60 62 Z"
          fill="none"
          stroke={tone}
          strokeWidth="1.5"
          opacity="0.5"
        />
      </>
    ) : (
      <>
        {/* narrower shoulders, fuller through the hip */}
        <path
          d="M60 62 C38 62 30 74 28 94 L22 148 L37 148 L40 120 C34 142 32 158 34 172 C44 178 76 178 86 172 C88 158 86 142 80 120 L83 148 L98 148 L92 94 C90 74 82 62 60 62 Z"
          fill={tone}
          opacity="0.18"
        />
        <path
          d="M60 62 C38 62 30 74 28 94 L22 148 L37 148 L40 120 C34 142 32 158 34 172 C44 178 76 178 86 172 C88 158 86 142 80 120 L83 148 L98 148 L92 94 C90 74 82 62 60 62 Z"
          fill="none"
          stroke={tone}
          strokeWidth="1.5"
          opacity="0.5"
        />
        <path d="M40 176 L46 236 L58 236 L60 182 L62 236 L74 236 L80 176 Z" fill={tone} opacity="0.18" />
        <path
          d="M40 176 L46 236 L58 236 L60 182 L62 236 L74 236 L80 176 Z"
          fill="none"
          stroke={tone}
          strokeWidth="1.5"
          opacity="0.5"
        />
      </>
    )}
  </svg>
);

export const SpeakerFigure = ({
  sex,
  onChange,
  age,
  onAgeChange,
  speaking = false,
  tone = "#111111",
}: {
  sex: BiologicalSex;
  onChange: (next: BiologicalSex) => void;
  /** Omit both to hide the age band entirely. */
  age?: AgeBand;
  onAgeChange?: (next: AgeBand) => void;
  /** Breathes gently while the microphone is open. */
  speaking?: boolean;
  tone?: string;
}) => {
  const reduce = useReducedMotion();
  const flip = () => onChange(sex === "male" ? "female" : "male");

  return (
    <div className="flex select-none flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={flip}
          aria-label="Show the other figure"
          className="rounded-full px-2 py-6 text-black/35 transition-colors hover:text-black/70"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3 L5 8 L10 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <motion.div
          className="h-[200px] w-[92px]"
          animate={reduce || !speaking ? { scale: 1 } : { scale: [1, 1.025, 1] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* key on sex so the swap is a cross-fade rather than a redraw */}
          <motion.div
            key={sex}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="h-full w-full"
          >
            <Figure sex={sex} tone={tone} />
          </motion.div>
        </motion.div>

        <button
          type="button"
          onClick={flip}
          aria-label="Show the other figure"
          className="rounded-full px-2 py-6 text-black/35 transition-colors hover:text-black/70"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 3 L11 8 L6 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-black/40">
        {sex}
      </span>

      {/* Age band, when the caller wants it collected here too. Bands rather
          than a birth date: the reading does not need a number, and a band is
          far less identifying to hold against a voice recording. */}
      {age !== undefined && onAgeChange ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
          {AGE_RANGES.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onAgeChange(a.id)}
              aria-pressed={age === a.id}
              className="rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors"
              style={
                age === a.id
                  ? { background: tone, color: "#FFFFFF" }
                  : { color: "rgba(27,21,16,0.45)", boxShadow: "inset 0 0 0 1px rgba(27,21,16,0.15)" }
              }
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
