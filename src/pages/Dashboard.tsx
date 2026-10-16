import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useVoiceHistory } from "@/hooks/use-voice-history";
import { MODELS, planIncludes } from "@/lib/models";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { computeSerasonaScore, type ScoreGroup } from "@/lib/serasona-score";
import { bandForSignal, bandColorForSignal } from "@/lib/signal-band";
import { ScoreDial } from "@/components/report/ScoreDial";
import { Sparkline } from "@/components/dashboard-sparkline";
import { MicIcon, PhoneIcon, StressIcon, WellnessIcon, ClarityIcon } from "@/components/dashboard-icons";

const SCORE_BAND_COLOR = { clear: "#0d6a76", watch: "#9c5600", strained: "#a32020" } as const;
const GROUP_COLOR: Record<ScoreGroup, string> = {
  stress: "#7b2d5e",
  wellness: "#8a6a12",
  clarity: "#1d5fa8",
};
const GROUP_DESCRIPTION: Record<ScoreGroup, string> = {
  stress: "Tension read from pitch, pause length and vocal strain.",
  wellness: "Fatigue, cardiovascular and general-health signs, read together.",
  clarity: "Cognitive signs: attention, mental load and head impact.",
};
const GROUP_ICON: Record<ScoreGroup, (props: { className?: string; color?: string }) => JSX.Element> = {
  stress: StressIcon,
  wellness: WellnessIcon,
  clarity: ClarityIcon,
};

/** Hex + alpha suffix, the same tint technique "Models on your plan" already
 * uses (`${m.tone}1a`) — kept as one helper so every new tinted surface below
 * uses the identical formula rather than a parallel set of "soft" hex
 * constants. */
const tint = (hex: string, alpha: "0a" | "14" | "1a" | "26" = "1a") => `${hex}${alpha}`;

/**
 * Where everyone lands after signing in.
 *
 * It used to render "No assessment data available" and nothing else — no way
 * to start a check-in, no link anywhere. Every new account arrived at a dead
 * end immediately after paying, which made the first screen of the product
 * its worst one.
 *
 * So the way to do a check-in is always the first thing on the page, whether
 * or not there is any history to show. Results come second, because on day
 * one there are none.
 */

const Dashboard = () => {
  /*
    What this person told us about themselves, shown as context on the reading.

    Serasona holds these; the model is not given them. The Amplifier v2 API
    accepts no demographic parameters and returns none — confirmed against its
    schemas and against docs.amplifierhealth.com. It compares a recording to
    that subject's OWN history rather than to a population band, which is why
    it does not ask. Wording this as "you told us" rather than implying the
    analysis used it is the difference between context and a claim the API
    cannot support.
  */
  const [demographics, setDemographics] = useState<{ sex?: string; age?: string }>({});
  useEffect(() => {
    const uid = auth?.currentUser?.uid;
    if (!uid || !db) return;
    let cancelled = false;
    void getDoc(doc(db, "users", uid))
      .then((snap) => {
        if (cancelled) return;
        const d = snap.data() || {};
        setDemographics({ sex: d.biologicalSex, age: d.ageRange });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const AGE_LABEL: Record<string, string> = {
    under30: "Under 30", "30-45": "30 to 45", "46-60": "46 to 60", "60+": "60 and over",
  };
  const demoLine = [
    demographics.sex ? demographics.sex[0].toUpperCase() + demographics.sex.slice(1) : null,
    demographics.age ? AGE_LABEL[demographics.age] : null,
  ].filter(Boolean).join(" · ");

  const { user, subscription } = useAuth();
  const { loading, sessions } = useVoiceHistory();

  const plan = subscription.planId;
  const canCall = plan === "plus" || plan === "executive";
  const latest = sessions[0] ?? null;

  // Which models this plan actually reads: Pulse is in every plan, the rest
  // are whatever the plan's allowance covers.
  const activeModels = useMemo(() => {
    const allowance = planIncludes(plan);
    return MODELS.filter((m) => m.included).concat(
      MODELS.filter((m) => !m.included).slice(0, allowance)
    );
  }, [plan]);

  const firstName = (user?.displayName || user?.email || "").split(/[@ ]/)[0];

  // The Serasona Score: one composite across whatever signs the plan's
  // models actually returned on the most recent check-in. See
  // src/lib/serasona-score.ts for the weighting and why it reads band, not
  // raw score.
  const today = latest ? computeSerasonaScore(latest.signals) : null;

  // The same composite computed per past session, oldest first, so the hero
  // and each group tile can draw a real trend rather than a static number.
  // Capped at the last 10 so a long history doesn't flatten the line.
  const scoreHistory = useMemo(() => {
    const chronological = [...sessions].reverse().slice(-10);
    return chronological
      .map((s) => computeSerasonaScore(s.signals))
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }, [sessions]);

  const overallSparkline = scoreHistory
    .map((r) => r.score)
    .filter((s): s is number => s !== null);

  const groupSparkline = (group: ScoreGroup) =>
    scoreHistory
      .map((r) => r.groups.find((g) => g.group === group)?.index)
      .filter((v): v is number => v != null);

  return (
    <main className="min-h-screen bg-[#fbf7f1] text-black">
      <div className="mx-auto max-w-[940px] px-6 pb-24 pt-12">
        <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-black/10 pb-5">
          <h1 className="font-serif text-2xl md:text-3xl">
            {firstName ? `Hello, ${firstName}` : "Your check-ins"}
          </h1>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-black/45">
            {plan === "free" ? "Free" : plan} plan
            {sessions.length ? ` · ${sessions.length} check-in${sessions.length === 1 ? "" : "s"}` : ""}
          </span>
        </header>

        {/* Always first. On day one this is the only thing worth showing. */}
        <section className="pt-10">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-black/55">
            Do a new assessment
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Link
              to="/checkin"
              className="group relative overflow-hidden rounded-3xl bg-[#1b1510] px-7 py-8 text-[#fbf7f1] transition-transform hover:scale-[1.01]"
            >
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-2xl"
                style={{ background: "radial-gradient(circle, #c2410c66, transparent 70%)" }}
              />
              <span
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ background: tint("#c2410c", "26") }}
              >
                <MicIcon color="#c2410c" />
              </span>
              <div className="relative mt-4 font-serif text-2xl">Speak now</div>
              <p className="relative mt-2 text-[14px] leading-relaxed text-[#fbf7f1]/70">
                Twenty seconds in your browser. Results in about a minute.
              </p>
              <span className="relative mt-6 inline-block font-mono text-[10px] uppercase tracking-[0.18em] text-[#c2410c]">
                Start →
              </span>
            </Link>

            {canCall ? (
              <Link
                to="/checkin/phone"
                className="relative overflow-hidden rounded-3xl border px-7 py-8 transition-colors"
                style={{ borderColor: tint("#0d6a76", "26"), background: tint("#0d6a76", "0a") }}
              >
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ background: tint("#0d6a76", "1a") }}
                >
                  <PhoneIcon color="#0d6a76" />
                </span>
                <div className="mt-4 font-serif text-2xl">Check in by phone</div>
                <p className="mt-2 text-[14px] leading-relaxed text-black/60">
                  Any phone, including a landline. No app needed.
                </p>
                <span className="mt-6 inline-block font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "#0d6a76" }}>
                  Set it up →
                </span>
              </Link>
            ) : (
              <Link
                to="/pricing"
                className="rounded-3xl border border-dashed border-black/20 px-7 py-8 transition-colors hover:border-black/40"
              >
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ background: "#0000000a" }}
                >
                  <PhoneIcon color="rgba(0,0,0,0.4)" />
                </span>
                <div className="mt-4 font-serif text-2xl text-black/70">Check in by phone</div>
                <p className="mt-2 text-[14px] leading-relaxed text-black/50">
                  Serasona calls you instead. Included from Plus.
                </p>
                <span className="mt-6 inline-block font-mono text-[10px] uppercase tracking-[0.18em] text-[#c2410c]">
                  See plans →
                </span>
              </Link>
            )}
          </div>
        </section>

        {/* Results */}
        <section className="pt-14">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-black/55">
              My results
            </h2>
            {sessions.length > 1 ? (
              <Link
                to="/history"
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-black/45 underline underline-offset-4 hover:text-black/75"
              >
                See the full trend
              </Link>
            ) : null}
          </div>

          {loading ? (
            <p className="mt-6 text-[15px] text-black/50">Loading your history…</p>
          ) : !latest ? (
            <div className="mt-6 rounded-3xl bg-black/[0.035] px-7 py-10 text-center">
              <p className="font-serif text-xl">No check-ins yet</p>
              <p className="mx-auto mt-2 max-w-[420px] text-[15px] leading-relaxed text-black/60">
                Your first one takes twenty seconds. After that every reading is
                placed against your own history rather than anyone else's.
              </p>
            </div>
          ) : (
            <>
              <div
                className="mt-6 flex flex-col items-center gap-6 rounded-3xl px-7 py-8 sm:flex-row sm:items-center sm:justify-between"
                style={{
                  background: today?.band
                    ? `linear-gradient(135deg, ${tint(SCORE_BAND_COLOR[today.band], "14")}, ${tint(SCORE_BAND_COLOR[today.band], "0a")})`
                    : "rgba(0,0,0,0.035)",
                }}
              >
                <div className="flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/45">
                    Most recent · {new Date(latest.capturedAt).toLocaleDateString()}
                  </div>
                  <div className="mt-2 font-serif text-3xl capitalize">
                    {latest.summary?.overallLevel ?? "Recorded"}
                  </div>
                  {demoLine ? (
                    <p className="mt-2 text-[13px] text-black/45">
                      {demoLine} · as you told us. Readings are compared against
                      your own history, not a population average.
                    </p>
                  ) : null}
                  {latest.summary?.flaggedCount != null && latest.summary?.totalSignals != null ? (
                    <p className="mt-2 text-[14px] text-black/55">
                      {latest.summary.flaggedCount} of {latest.summary.totalSignals} signals flagged
                    </p>
                  ) : null}

                  {overallSparkline.length > 1 && today?.band && (
                    <div className="mt-4 max-w-[220px]">
                      <Sparkline values={overallSparkline} color={SCORE_BAND_COLOR[today.band]} />
                      <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-black/35">
                        Last {overallSparkline.length} check-ins
                      </div>
                    </div>
                  )}
                </div>

                {today?.score !== null && today?.score !== undefined && (
                  <ScoreDial value={today.score} color={SCORE_BAND_COLOR[today.band!]} size={140} strokeWidth={11}>
                    <div className="font-serif text-[36px] font-bold leading-none text-black">{today.score}</div>
                    <span
                      className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                      style={{ color: SCORE_BAND_COLOR[today.band!], backgroundColor: tint(SCORE_BAND_COLOR[today.band!], "1a") }}
                    >
                      {today.bandLabel}
                    </span>
                  </ScoreDial>
                )}
              </div>

              {today && today.groups.length > 0 && (
                <div
                  className="mt-5 grid gap-3"
                  style={{ gridTemplateColumns: `repeat(${today.groups.length}, minmax(0, 1fr))` }}
                >
                  {today.groups.map((group) => {
                    const color = GROUP_COLOR[group.group];
                    const Icon = GROUP_ICON[group.group];
                    const trend = groupSparkline(group.group);
                    return (
                      <div
                        key={group.group}
                        className="flex flex-col rounded-2xl px-5 py-4"
                        style={{ background: tint(color, "0a"), border: `1px solid ${tint(color, "1a")}` }}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl"
                            style={{ background: tint(color, "1a") }}
                          >
                            <Icon color={color} className="h-[18px] w-[18px]" />
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-black/50">
                            {group.label}
                          </span>
                        </div>
                        <div className="mt-2 font-serif text-2xl" style={{ color }}>
                          {group.index ?? "—"}
                        </div>
                        <p className="mt-1 text-[12px] leading-snug text-black/55">
                          {GROUP_DESCRIPTION[group.group]}
                        </p>
                        {trend.length > 1 && (
                          <div className="mt-3">
                            <Sparkline values={trend} color={color} height={22} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {latest.signals.map((s) => {
                  const band = bandForSignal(s.name, s.level, s.score);
                  const color = bandColorForSignal(s.name, band, "light");
                  return (
                    <div
                      key={s.name}
                      className="flex items-center gap-3 rounded-2xl border border-black/10 px-5 py-4"
                    >
                      <span
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] capitalize text-black/50">
                          {String(s.name).replace(/[-_]/g, " ")}
                        </div>
                        <div className="mt-0.5 text-[16px] capitalize" style={{ color }}>
                          {s.level ?? "—"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* What this plan reads, and what it does not */}
        <section className="pt-14">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-black/55">
            Models on your plan
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeModels.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
                style={{ background: tint(m.tone, "0a"), border: `1px solid ${tint(m.tone, "1a")}` }}
              >
                <span
                  className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl font-serif text-sm font-bold"
                  style={{ background: tint(m.tone, "1a"), color: m.tone }}
                >
                  {m.name.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium" style={{ color: m.tone }}>
                    {m.name}
                  </div>
                  <div className="truncate text-[11px] text-black/50">{m.tagline}</div>
                </div>
              </div>
            ))}
            {activeModels.length < MODELS.length ? (
              <Link
                to="/models"
                className="flex items-center justify-center rounded-2xl border border-dashed border-black/25 px-4 py-3.5 text-[13px] text-black/55 transition-colors hover:border-black/45 hover:text-black/80"
              >
                + {MODELS.length - activeModels.length} more available
              </Link>
            ) : null}
          </div>
        </section>

        <p className="mt-16 text-[12px] leading-relaxed text-black/40">
          Serasona reports wellness signals, not diagnoses. If something feels
          wrong, talk to a clinician.
        </p>
      </div>
    </main>
  );
};

export default Dashboard;
