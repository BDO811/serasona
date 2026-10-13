import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { asset } from "@/lib/asset";
import { useAuth } from "@/context/AuthContext";

import {
  ADDON_MODELS,
  MODELS,
  addonListPriceCents,
  addonPriceCents,
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

  const { chargeable, price, list, saving } = useMemo(() => {
    // The plan's own allowance is consumed first, so the price only starts
    // climbing once you pass what you are already paying for.
    const chargeable = Math.max(selected.length - included, 0);
    const price = addonPriceCents(chargeable);
    const list = addonListPriceCents(chargeable);
    return { chargeable, price, list, saving: list - price };
  }, [selected, included]);

  return (
    <main className="min-h-screen bg-[#fbf7f1] text-black">
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

      {/* The price ladder */}
      <section className="mx-auto max-w-[1040px] px-6 pb-16">
        <div className="rounded-3xl bg-black/[0.035] px-6 py-8 md:px-10">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.2em] text-black/55">
            Add-ons get cheaper as you add them
          </p>
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => {
              const each = addonPriceCents(n) / n;
              return (
                <div
                  key={n}
                  className="rounded-2xl bg-[#fbf7f1] px-3 py-4 text-center"
                >
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-black/45">
                    {n} model{n === 1 ? "" : "s"}
                  </div>
                  <div className="mt-2 font-serif text-xl">{money(addonPriceCents(n))}</div>
                  <div className="mt-1 text-[11px] text-black/45">
                    {money(Math.round(each))} each
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-center text-sm leading-relaxed text-black/60">
            Plus includes two models. Executive includes all seven.
          </p>
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
        <div className="sticky bottom-0 z-30 border-t border-black/10 bg-[#fbf7f1]/95 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/50">
                {selected.length} selected
                {included > 0 ? ` · ${Math.min(selected.length, included)} included with your plan` : ""}
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="font-serif text-2xl">
                  {chargeable === 0 ? "No extra charge" : `${money(price)}/mo`}
                </span>
                {saving > 0 ? (
                  <span className="text-sm text-black/45">
                    <span className="line-through">{money(list)}</span>{" "}
                    <span className="text-[#c2410c]">save {money(saving)}</span>
                  </span>
                ) : null}
              </div>
            </div>
            <Link
              to="/pricing"
              className="rounded-full bg-black px-7 py-3.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#fbf7f1] transition-transform hover:scale-[1.02]"
            >
              Continue
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
      borderColor: selected ? model.tone : "rgba(27,21,16,0.12)",
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
          <h2 className="font-serif text-2xl text-[#fbf7f1]">{model.name}</h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#fbf7f1]/85">
            {model.tagline}
          </p>
        </div>
        {model.included ? (
          <span className="rounded-full bg-[#fbf7f1] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: model.tone }}>
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
            borderColor: model.evidence.strength === "strong" ? model.tone : "rgba(27,21,16,0.3)",
            background: "rgba(27,21,16,0.03)",
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
                ? { background: model.tone, color: "#fbf7f1" }
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
