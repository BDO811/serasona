import { Link } from "react-router-dom";


/**
 * The public science page.
 *
 * Every figure on this page is traceable to a named, PubMed-indexed paper in
 * the reference list below, and the reference entries carry the sample size
 * and the authors' own stated limitations. Nothing here is a Serasona internal
 * result presented as published science — where a claim comes from our own
 * corpus it says so.
 *
 * This is a wellness page, not a clinical one. The distinction is load-bearing:
 * Serasona is not a medical device and the copy must never imply diagnosis.
 */

/* ----------------------------------------------------------------- data */

const MECHANISM = [
  {
    n: "01",
    title: "Breathing drives the signal",
    body: "Speech runs on exhaled air. Subglottal pressure pushes against the vocal folds and sets them vibrating, so anything that changes your breathing pattern changes the sound that comes out. Autonomic arousal changes breathing within seconds, well before you notice it.",
  },
  {
    n: "02",
    title: "Muscle tension changes pitch",
    body: "The larynx is muscle. Stress raises laryngeal muscle tone, which stiffens the vocal folds and raises their vibration rate. That rate is fundamental frequency, heard as pitch, and it is the single most consistently reported vocal effect of stress across the literature.",
  },
  {
    n: "03",
    title: "Control precision leaves a trace",
    body: "No two vibration cycles are identical. The small cycle-to-cycle variations in frequency and amplitude, called jitter and shimmer, together with the ratio of periodic sound to noise, track how precisely the system is being controlled at that moment.",
  },
  {
    n: "04",
    title: "Timing carries load",
    body: "Where you pause, how long for, and how fast you articulate between pauses shift under cognitive demand. Timing is measured separately from voice quality because the two move independently.",
  },
];

const EVIDENCE = [
  {
    domain: "Respiratory",
    headline: "60 to 100%",
    unit: "reported accuracy across 81 studies",
    body: "The largest systematic review in this field, pre-registered on PROSPERO, screened 14,180 records and included 81 studies of asthma, COPD and infectious respiratory disease. Audio biomarkers reached moderate to high accuracy throughout, and 8 of 10 asthma studies reported both high sensitivity and high specificity.",
    note: 1,
  },
  {
    domain: "Mood",
    headline: "AUC 0.71 to 0.93",
    unit: "across 16,872 pooled participants",
    body: "A 2025 systematic review of speech and voice quality as digital biomarkers in depression reported classification accuracy between 78 and 96.5%. A separate 2026 study of 151 clinically diagnosed speakers reached AUC 0.86 and 93% specificity when acoustic and linguistic features were combined.",
    note: 2,
  },
  {
    domain: "Stress",
    headline: "Pitch rises",
    unit: "meta-analysis of 1,148 observations",
    body: "Pooled across 10 experimental studies, fundamental frequency rose measurably after a stressor, with a standardised mean difference of 0.55. The effect was strongest in spontaneous speech rather than read speech, which is why Serasona asks you to talk rather than to read a script.",
    note: 3,
  },
  {
    domain: "Cortisol",
    headline: "Dose dependent",
    unit: "salivary cortisol vs. measured pitch",
    body: "In an exam-stress design, free cortisol rose by an average of 74% and those increases significantly predicted increases in pitch. A follow-up found listeners' stress judgements of a voice correlated with the speaker's actual cortisol level.",
    note: 4,
  },
  {
    domain: "Fatigue",
    headline: "Detectable",
    unit: "after 24 hours without sleep",
    body: "Sleep deprivation is detectable from voice using spectro-temporal modulation features at accuracy comparable to state-of-the-art speech features. The work separates two independent effects: slow prosodic changes that track how sleepy people feel, and voice-quality changes that do not.",
    note: 5,
  },
];

const REFERENCES = [
  {
    n: 1,
    cite: "Landry V, et al. Audio-based digital biomarkers in diagnosing and managing respiratory diseases: a systematic review and bibliometric analysis. European Respiratory Review, 2025.",
    pmid: "40368428",
    note: "81 studies, PROSPERO-registered (CRD42022336730). The review flags COPD specificity as weaker than its sensitivity: 7 of 9 studies reported high sensitivity but only 5 of 9 reported high specificity. Breathing and cough sounds, rather than sustained voice, were the most common biomarkers studied.",
  },
  {
    n: 2,
    cite: "Briganti G, Lechien JR. Speech and Voice Quality as Digital Biomarkers in Depression: A Systematic Review. Journal of Voice, 2025. · Maran PL, et al. Beyond acoustic features. Journal of Affective Disorders, 2026.",
    pmid: "40410060",
    note: "The Briganti review states that 6 of its 12 included studies carried a high risk of methodological bias, chiefly in patient selection and validation technique, and that recording contexts varied uncontrolled between clinical and consumer settings. A separate 2026 meta-analysis (PMID 42038195) found that pitch alone did not differ significantly between depressed and control speakers (p = 0.56), so single-feature claims about mood should not be made. The AUC figures above come from multi-feature models.",
  },
  {
    n: 3,
    cite: "de Lacerda Veiga D, et al. The Fundamental Frequency of Voice as a Potential Stress Biomarker: A Systematic Review and Meta-Analysis. Stress and Health, 2025.",
    pmid: "41102940",
    note: "10 studies, 1,148 observations. Pooled SMD 0.55 (95% CI 0.30 to 0.80, p < 0.001), stronger in women (0.71) and in spontaneous speech (0.79), and not significant in men or in read speech. The authors' own trim-and-fill correction for publication bias attenuates the pooled estimate to SMD 0.17 (p = 0.29), and they conclude that pitch is a candidate biomarker requiring further validation rather than an established one.",
  },
  {
    n: 4,
    cite: "Pisanski K, et al. Individual differences in cortisol stress response predict increases in voice pitch during exam stress. Physiology & Behavior, 2016. · Pisanski K, Sorokowski P. Perception, 2020.",
    pmid: "27188981",
    note: "Pitch rose reliably only in speakers whose cortisol more than doubled from baseline, which is why group-average effects in this field are weaker than individual-level ones. A 2025 study of 82 participants (PMID 40898982) found speech features correlated with cortisol but that a classifier distinguishing stressed from control conditions reached only AUC 0.55, close to chance. Current evidence supports a real association, not an accurate single-sample stress test.",
  },
  {
    n: 5,
    cite: "Thoret E, et al. Sleep deprivation detected by voice analysis. PLOS Computational Biology, 2024. · Icht M, et al. The “Morning Voice”. Journal of Voice, 2020.",
    pmid: "38315733",
    note: "Individual-level effects varied widely even under controlled amounts of sleep deprivation. The Icht study (n = 47) found its significant effect in female speakers only, so sex is treated as a modelled variable rather than ignored.",
  },
];

const LIMITS = [
  {
    title: "It is not a diagnosis",
    body: "Serasona reports wellness signals. It does not detect, diagnose, treat or rule out any disease, and no reading from it should delay speaking to a clinician. Where the research above studies clinical populations, those findings describe what the field has measured, not what Serasona claims to do for you.",
  },
  {
    title: "Cognitive measures are the least settled",
    body: "A 2023 scoping review of cognitive load and voice found only 9 qualifying studies and concluded that acoustic measures do not show consistent patterns of change under load. Timing and pause structure carry more signal here than pitch does. Treat focus and mental fatigue readings as directional.",
  },
  {
    title: "Accuracy depends on the recording",
    body: "Microphone quality, background noise and compression all change the measured acoustics. Telephone audio is narrowband and carries less information than a browser recording. Serasona measures the same way each time so your readings stay comparable to each other.",
  },
  {
    title: "Populations differ",
    body: "Age, sex and language shift vocal acoustics independently of how you are doing, and published models have shown meaningfully different performance across demographic groups. Comparisons are most meaningful against your own earlier readings rather than against anyone else's.",
  },
];

/* ------------------------------------------------------------ component */

const Science = () => (
  <main className="min-h-screen bg-[#fbf7f1] text-black">
    <div className="mx-auto max-w-[760px] px-6 pb-28 pt-16 md:pt-24">
      {/* Hero.
          Deliberately not animated in. This is a long-form reference page, and
          an entrance animation makes the headline's visibility depend on
          requestAnimationFrame having run — which it has not in a background
          tab, for a reduced-motion user, or for a crawler. Static text cannot
          fail to appear. */}
      <span className="font-mono text-xs uppercase tracking-[0.25em] text-black/60">
        Scientific Analysis
      </span>

      <h1 className="mt-6 font-serif text-4xl leading-[1.05] tracking-tight md:text-6xl">
        What your voice
        <br />
        <span className="italic">actually carries.</span>
      </h1>

      <p className="mt-8 text-lg leading-relaxed text-black/70">
        Speech is a motor act. Producing it takes coordinated control of
        breathing, the larynx and the vocal tract, and that control is wired
        into the same autonomic systems that respond when you are under strain,
        short on sleep or fighting something off. The sound carries the state of
        the machinery that made it, alongside the words.
      </p>

      <p className="mt-6 text-lg leading-relaxed text-black/70">
        This page sets out the published evidence for reading physiological and
        psychological state from voice, what that evidence supports today, and
        where it runs out. Every figure below is footnoted to a named study,
        with its sample size and the authors' own stated limitations.
      </p>

      <p className="mt-8"><Link to="/docs/serasona-score" className="underline underline-offset-4">Score calculation and references for every measurement</Link></p>
      {/* Mechanism */}
      <Section eyebrow="The mechanism" title="Four ways state reaches the signal" />
      <div className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2">
        {MECHANISM.map((m) => (
          <div key={m.n}>
            <span className="font-mono text-[11px] tracking-[0.2em] text-[#c2410c]">{m.n}</span>
            <h3 className="mt-3 font-serif text-xl">{m.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-black/65">{m.body}</p>
          </div>
        ))}
      </div>

      {/* Evidence */}
      <Section
        eyebrow="The evidence"
        title="What has been measured"
        sub="Figures are as reported by each study. Sample sizes and limitations are in the references."
      />
      <div className="mt-10 space-y-10">
        {EVIDENCE.map((e) => (
          <article key={e.domain} className="border-t border-black/12 pt-7">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-black/50">
              {e.domain}
            </span>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-4">
              <span className="font-serif text-3xl text-[#c2410c] md:text-4xl">{e.headline}</span>
              <span className="text-sm text-black/55">{e.unit}</span>
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-black/70">
              {e.body}
              <sup className="ml-1 font-mono text-[10px] text-[#c2410c]">{e.note}</sup>
            </p>
          </article>
        ))}
      </div>

      {/* How Serasona is built */}
      <Section eyebrow="The model" title="How Serasona reads it" />
      <p className="mt-8 text-[15px] leading-relaxed text-black/70">
        Each recording runs through the model selected for that check-in. Pulse covers everyday wellness signs; other models add different mental, cognitive, respiratory and physiological patterns. Available models depend on the plan. Access to a model does not mean it ran on every recording.
      </p>
      <p className="mt-6 text-[15px] leading-relaxed text-black/70">
        The Serasona Score combines only the readable signs actually returned. Its relative weights are provisional product choices. The published studies on this page do not validate those weights or establish the accuracy of the composite. <Link to="/docs/serasona-score" className="underline">Read the calculation, full measurement matrix and references.</Link>
      </p>

      {/* Limits */}
      <Section eyebrow="The limits" title="Where this runs out" />
      <div className="mt-10 space-y-8">
        {LIMITS.map((l) => (
          <div key={l.title} className="border-l-2 border-[#c2410c]/35 pl-5">
            <h3 className="font-serif text-xl">{l.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-black/65">{l.body}</p>
          </div>
        ))}
      </div>

      {/* References */}
      <Section eyebrow="References" title="Sources" />
      <ol className="mt-10 space-y-7">
        {REFERENCES.map((r) => (
          <li key={r.n} className="flex gap-4">
            <span className="shrink-0 font-mono text-[11px] text-[#c2410c]">{r.n}</span>
            <div>
              <p className="text-[14px] leading-relaxed text-black/75">{r.cite}</p>
              <a
                href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block font-mono text-[11px] uppercase tracking-[0.15em] text-black/50 underline underline-offset-4 transition-colors hover:text-black/80"
              >
                PMID {r.pmid}
              </a>
              <p className="mt-2 text-[13px] leading-relaxed text-black/55">{r.note}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* Regulatory footer */}
      <div className="mt-16 rounded-2xl bg-black/[0.035] px-6 py-7">
        <p className="text-[13px] leading-relaxed text-black/60">
          Serasona is a general wellness product. It is not a medical device and
          is not intended to diagnose, treat, cure, mitigate or prevent any
          disease or health condition. Readings are not a substitute for
          professional medical advice. If something feels wrong, talk to a
          clinician.
        </p>
      </div>

      <div className="mt-12 flex flex-wrap gap-x-7 gap-y-3">
        <Link
          to="/"
          className="font-mono text-xs uppercase tracking-[0.15em] text-black/55 underline underline-offset-4 transition-colors hover:text-black/85"
        >
          Back to home
        </Link>
        <Link
          to="/pricing"
          className="font-mono text-xs uppercase tracking-[0.15em] text-black/55 underline underline-offset-4 transition-colors hover:text-black/85"
        >
          Plans and pricing
        </Link>
      </div>
    </div>
  </main>
);

const Section = ({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) => (
  <header className="mt-20 border-t border-black/12 pt-10">
    <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-black/50">{eyebrow}</span>
    <h2 className="mt-3 font-serif text-2xl md:text-3xl">{title}</h2>
    {sub ? <p className="mt-3 text-sm leading-relaxed text-black/55">{sub}</p> : null}
  </header>
);

export default Science;
