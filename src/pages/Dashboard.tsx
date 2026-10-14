import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useVoiceHistory } from "@/hooks/use-voice-history";
import { MODELS, planIncludes } from "@/lib/models";

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
              className="rounded-3xl bg-[#1b1510] px-7 py-8 text-[#fbf7f1] transition-transform hover:scale-[1.01]"
            >
              <div className="font-serif text-2xl">Speak now</div>
              <p className="mt-2 text-[14px] leading-relaxed text-[#fbf7f1]/70">
                Twenty seconds in your browser. Results in about a minute.
              </p>
              <span className="mt-6 inline-block font-mono text-[10px] uppercase tracking-[0.18em] text-[#c2410c]">
                Start →
              </span>
            </Link>

            {canCall ? (
              <Link
                to="/checkin/phone"
                className="rounded-3xl border border-black/12 px-7 py-8 transition-colors hover:border-black/30"
              >
                <div className="font-serif text-2xl">Check in by phone</div>
                <p className="mt-2 text-[14px] leading-relaxed text-black/60">
                  Any phone, including a landline. No app needed.
                </p>
                <span className="mt-6 inline-block font-mono text-[10px] uppercase tracking-[0.18em] text-black/45">
                  Set it up →
                </span>
              </Link>
            ) : (
              <Link
                to="/pricing"
                className="rounded-3xl border border-dashed border-black/20 px-7 py-8 transition-colors hover:border-black/40"
              >
                <div className="font-serif text-2xl text-black/70">Check in by phone</div>
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
              <div className="mt-6 rounded-3xl bg-black/[0.035] px-7 py-7">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/45">
                  Most recent · {new Date(latest.capturedAt).toLocaleDateString()}
                </div>
                <div className="mt-2 font-serif text-3xl capitalize">
                  {latest.summary?.overallLevel ?? "Recorded"}
                </div>
                {latest.summary?.flaggedCount != null && latest.summary?.totalSignals != null ? (
                  <p className="mt-2 text-[14px] text-black/55">
                    {latest.summary.flaggedCount} of {latest.summary.totalSignals} signals flagged
                  </p>
                ) : null}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {latest.signals.map((s) => (
                  <div key={s.name} className="rounded-2xl border border-black/10 px-5 py-4">
                    <div className="text-[12px] capitalize text-black/50">
                      {String(s.name).replace(/[-_]/g, " ")}
                    </div>
                    <div className="mt-1 text-[16px] capitalize">{s.level ?? "—"}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* What this plan reads, and what it does not */}
        <section className="pt-14">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-black/55">
            Models on your plan
          </h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {activeModels.map((m) => (
              <span
                key={m.id}
                className="rounded-full px-4 py-2 text-[13px]"
                style={{ background: `${m.tone}1a`, color: m.tone }}
              >
                {m.name}
              </span>
            ))}
            {activeModels.length < MODELS.length ? (
              <Link
                to="/models"
                className="rounded-full border border-dashed border-black/25 px-4 py-2 text-[13px] text-black/55 transition-colors hover:border-black/45 hover:text-black/80"
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
