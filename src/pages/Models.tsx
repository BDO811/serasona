import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { asset } from "@/lib/asset";
import { useAuth } from "@/context/AuthContext";

import {
  ADDON_MODELS,
  ADDON_PRICE_CENTS,
  MODELS,
  addonPriceCents,
  bestPlanFor,
  money,
  planIncludes,
  type VoiceModel,
} from "@/lib/models";

/**
 * The model catalogue.
 *
 * One recording, read many ways — that is the whole proposition, and the page
 * is built to make it obvious rather than to list features. Each model gets a
 * photograph, its own colour, a paragraph of why you would want it, and the
 * exact signs the API returns for it.
 *
 * Two editorial rules are load-bearing here:
 *
 *   - The signs shown are the real ones. Nothing is listed that the model does
 *     not return, and no model's description promises a diagnosis.
 *   - Where the published evidence is unusually strong or unusually thin, the
 *     card says so. Breath is the strongest thing in the catalogue and Clarity
 *     the weakest, and a page that sells both at the same price while hiding
 *     that is a page that will eventually be screenshotted next to the papers.
 */

const Models = () => {
  const { subscription } = useAuth();
  const plan = subscription.planId;
  const included = planIncludes(plan);

  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const { chargeable, price, best } = useMemo(() => {
    // The plan's own allowance is consumed first, so the price only starts
    // climbing once you pass what you are already paying for.
    const chargeable = Math.max(selected.length - included, 0);
    return {
      chargeable,
      price: addonPriceCents(chargeable),
      // What this basket would cost on the cheapest plan that carries it.
      best: bestPlanFor(selected.length),
    };
  }, [selected, included]);

  // Only worth saying if the better plan is one they are not already on and
  // the saving is real.
  const upgrade =
    best.plan !== plan && best.savingCents > 0 && best.plan !== "free" ? best : null;

  return (
    <main className="min-h-screen bg-[#F2EFE9] text-black">
      {/* Hero */}
      <section className="mx-auto max-w-[1040px] px-6 pb-14 pt-16 text-center md:pt-20">
        <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-black/55">
          One recording. Many readers.
        </span>
        <h1 className="mx-auto mt-6 max-w-[760px] font-serif text-4xl leading-[1.05] tracking-tight md:text-6xl">
          Your voice carries more
          <br />
          <span className="italic">than one answer.</span>
        </h1>
        <p className="mx-auto mt-7 max-w-[600px] text-lg leading-relaxed text-black/70">
          Every check-in is the same twenty seconds. Each model you add reads
          that recording for something different, so you learn more without
          doing more.
        </p>
      </section>

      {/* What a basket costs each way. Three columns rather than a price
          ladder: the point is not that add-ons are cheap, it is that past the
          first one a plan is always the better buy. Plus and Executive spell
          out which models are in the basket and what each one costs on its
          own, so the included total reads as arithmetic you can check rather
          than a marketing claim. */}
      <section className="mx-auto max-w-[1040px] px-6 pb-16">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              name: "Core",
              price: 799,
              models: "Pulse only",
              lines: [] as VoiceModel[],
              extra: `Add any model for ${money(ADDON_PRICE_CENTS)} a month`,
              highlight: false,
            },
            {
              name: "Plus",
              price: 1499,
              // "Any three" is still the user's actual choice — these three are
              // the illustrative example, not a fixed basket.
              models: `Pulse + ${ADDON_MODELS.slice(0, 3).map((m) => m.name).join(", ")}`,
              lines: ADDON_MODELS.slice(0, 3),
              extra: `= ${money(ADDON_PRICE_CENTS * 3)} of models, included — or any 3 of ${ADDON_MODELS.length}`,
              highlight: true,
            },
            {
              name: "Executive",
              price: 1999,
              models: `Pulse + ${ADDON_MODELS.map((m) => m.name).join(", ")}`,
              lines: ADDON_MODELS,
              extra: `= ${money(ADDON_PRICE_CENTS * ADDON_MODELS.length)} of models, included`,
              highlight: false,
            },
          ].map((t) => (
            <div
              key={t.name}
              className="rounded-3xl px-6 py-7"
              style={{
                background: t.highlight ? "#111111" : "rgba(17, 17, 17,0.035)",
                color: t.highlight ? "#FFFFFF" : undefined,
              }}
            >
              <div
                className="font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ color: t.highlight ? "#FFFFFFaa" : "rgba(17, 17, 17,0.45)" }}
              >
                {t.name}
              </div>
              <div className="mt-2 font-serif text-3xl">{money(t.price)}</div>
              <div
                className="mt-3 text-[14px]"
                style={{ color: t.highlight ? "#FFFFFFcc" : "rgba(17, 17, 17,0.7)" }}
              >
                {t.models}
              </div>

              {t.lines.length > 0 ? (
                <div
                  className="mt-3 space-y-1 border-t pt-3"
                  style={{ borderColor: t.highlight ? "rgba(251,247,241,0.2)" : "rgba(17, 17, 17,0.1)" }}
                >
                  {t.lines.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between text-[12px]"
                      style={{ color: t.highlight ? "rgba(251,247,241,0.75)" : "rgba(17, 17, 17,0.55)" }}
                    >
                      <span>{m.name}</span>
                      <span>{money(ADDON_PRICE_CENTS)}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div
                className="mt-1.5 text-[13px]"
                style={{ color: t.highlight ? "#111111" : "rgba(17, 17, 17,0.45)" }}
              >
                {t.extra}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* The catalogue */}
      <section className="mx-auto max-w-[1040px] px-6 pb-24">
        <div className="grid gap-7 md:grid-cols-2">
          {/* Deliberately not wrapped in Reveal. These cards ARE the page —
              an entrance animation would make the catalogue's content depend
              on IntersectionObserver and requestAnimationFrame having run,
              and a product page that is blank to a crawler, a prerender or a
              backgrounded tab is worse than one that does not animate. */}
          {MODELS.map((m) => (
            <ModelCard
              key={m.id}
              model={m}
              selected={selected.includes(m.id)}
              coveredByPlan={!m.included && selected.indexOf(m.id) > -1 && selected.indexOf(m.id) < included}
              onToggle={() => toggle(m.id)}
            />
          ))}
        </div>
      </section>

      {/* Running total */}
      {chargeable > 0 || selected.length > 0 ? (
        <div className="sticky bottom-0 z-30 border-t border-black/10 bg-[#F2EFE9]/95 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/50">
                {selected.length} selected
                {included > 0 ? ` · ${Math.min(selected.length, included)} included with your plan` : ""}
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-serif text-2xl">
                  {chargeable === 0 ? "No extra charge" : `+${money(price)}/mo`}
                </span>
                {upgrade ? (
                  <span className="text-sm text-black/55">
                    or{" "}
                    <span className="capitalize text-[#111111]">{upgrade.plan}</span> at{" "}
                    {money(upgrade.totalCents)} and save {money(upgrade.savingCents)}
                  </span>
                ) : null}
              </div>
            </div>
            <Link
              to="/pricing"
              className="rounded-full px-7 py-3.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#FFFFFF] bg-[#111111] transition-transform hover:scale-[1.02]"
            >
              {upgrade ? `Switch to ${upgrade.plan}` : "Continue"}
            </Link>
          </div>
        </div>
      ) : null}

      <p className="mx-auto max-w-[760px] px-6 pb-16 text-center text-[12px] leading-relaxed text-black/45">
        Serasona reports wellness signals, not diagnoses. No model in this
        catalogue detects, diagnoses, treats or rules out any disease or
        condition.
      </p>
    </main>
  );
};

/* ------------------------------------------------------------------ card */

const ModelCard = ({
  model,
  selected,
  onToggle,
}: {
  model: VoiceModel;
  selected: boolean;
  coveredByPlan: boolean;
  onToggle: () => void;
}) => (
  <article
    className="flex h-full flex-col overflow-hidden rounded-3xl border transition-shadow"
    style={{
      borderColor: selected ? model.tone : "rgba(17, 17, 17,0.12)",
      boxShadow: selected ? `0 0 0 1px ${model.tone}` : undefined,
    }}
  >
    {/* Photo header, tinted to the model's own colour */}
    <div className="relative h-[168px] w-full overflow-hidden">
      <img
        src={asset(model.image)}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 mix-blend-multiply" style={{ background: model.tone, opacity: 0.55 }} />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
        <div>
          <h2 className="font-serif text-2xl text-[#FFFFFF]">{model.name}</h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#FFFFFF]/85">
            {model.tagline}
          </p>
        </div>
        {model.included ? (
          <span className="rounded-full bg-[#FFFFFF] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: model.tone }}>
            Included
          </span>
        ) : null}
      </div>
    </div>

    <div className="flex flex-1 flex-col px-6 py-6">
      <p className="text-[15px] leading-relaxed text-black/70">{model.body}</p>

      <div className="mt-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/45">
          What it reports
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {model.signs.map((s) => (
            <span
              key={s}
              className="rounded-full px-3 py-1.5 text-[12px]"
              style={{ background: `${model.tone}1a`, color: model.tone }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {model.evidence ? (
        <div
          className="mt-5 rounded-2xl border-l-2 px-4 py-3"
          style={{
            borderColor: model.evidence.strength === "strong" ? model.tone : "rgba(17, 17, 17,0.3)",
            background: "rgba(17, 17, 17,0.03)",
          }}
        >
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-black/45">
            {model.evidence.strength === "strong" ? "Strongest evidence here" : "Thinnest evidence here"}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-black/60">{model.evidence.note}</p>
        </div>
      ) : null}

      {model.sensitive ? (
        <div className="mt-5 rounded-2xl bg-black/[0.04] px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-black/45">
            Needs its own consent
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-black/60">{model.sensitive}</p>
        </div>
      ) : null}

      <div className="mt-auto pt-6">
        {model.included ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-black/40">
            In every plan
          </p>
        ) : (
          <button
            onClick={onToggle}
            aria-pressed={selected}
            className="w-full rounded-full px-5 py-3.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors"
            style={
              selected
                ? { background: model.tone, color: "#FFFFFF" }
                : { background: "transparent", color: model.tone, boxShadow: `inset 0 0 0 1px ${model.tone}66` }
            }
          >
            {selected ? "Added" : "Add to my plan"}
          </button>
        )}
      </div>
    </div>
  </article>
);

export default Models;
