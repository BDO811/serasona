import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { asset } from "@/lib/asset";
import { SiteHeader } from "@/components/SiteHeader";
import { VoiceDemo } from "@/components/VoiceDemo";
import { StickyCta } from "@/components/motion-primitives";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import "@/styles/home.css";

interface SerasonaHomeProps {
  onComplete: () => void;
}

const HOW_IT_WORKS = [
  {
    title: "Speak for twenty seconds",
    body: "Open the app or pick up when Serasona calls. No forms, no appointment.",
  },
  {
    title: "Serasona reads it",
    body: "Ten biomarkers, pulled from how you spoke, not just what you said.",
  },
  {
    title: "See what moved",
    body: "Every number is placed against your own last thirty days, never a population average.",
  },
];

const VOICE_BIOMARKERS = [
  {
    title: "Pitch and tone",
    body: "How high or flat your voice sits, and how much it moves. Stress and low mood tend to narrow it.",
  },
  {
    title: "Pacing and pauses",
    body: "How fast you speak and where you hesitate. Fatigue and cognitive load both show up here first.",
  },
  {
    title: "Breath support",
    body: "How steady your airflow is through a sentence. It shifts with physical and emotional strain alike.",
  },
  {
    title: "Articulation",
    body: "How precisely sounds are formed. Tiredness and dehydration both soften it in measurable ways.",
  },
];

/** A wearable against a check-in, from the page's own answer to "how is this different". */
const COMPARE = [
  { row: "Something to buy", wearable: "A ring or a band", voice: "Nothing" },
  { row: "Worn on the body", wearable: "Against the skin", voice: "No skin contact" },
  { row: "Charging", wearable: "Needs charging", voice: "None" },
  { row: "What it reads", wearable: "Your body", voice: "Your voice" },
];

const FAQ_ITEMS = [
  {
    question: "Is it a medical device?",
    answer:
      "No. Serasona is a wellness product. It does not diagnose, treat, prevent, or cure any condition. It reports a signal; it does not know why a number moved.",
  },
  {
    question: "Is my recording kept?",
    answer:
      "It’s processed to produce your signals and then discarded. Serasona stores the numbers, not the audio, and never sells personal information.",
  },
  {
    question: "How is it unlike a wearable?",
    answer:
      "A wearable reads your body. Nothing else reads your voice. Twenty seconds of speech, no device, no skin contact, no charging.",
  },
  {
    question: "What if something looks off?",
    answer:
      "Serasona reports a signal, not a diagnosis. A real person is always an option for anything beyond what a daily check-in can tell you. For medical concerns, talk to a licensed clinician.",
  },
  {
    question: "Can I skip the app?",
    answer:
      "Yes, on Plus and above. Serasona calls you on any phone, including a landline, and the result still lands in your account.",
  },
];

const STATS = [
  { value: "2.4M", label: "World’s largest dataset" },
  { value: "14,000", label: "Physician-labeled conditions and states" },
  { value: "75+", label: "Production indicators" },
  { value: "40+", label: "Languages" },
];

const PLANS = [
  { name: "Free", body: "One free check-in to start." },
  { name: "Core", body: "Tracks ten biomarkers against your own history, every day." },
  { name: "Plus", body: "Adds a daily call, no app required, on any phone, including a landline." },
];

const SHOTS = [
  {
    id: "assessment",
    src: "images/product/assessment-optimal.webp",
    width: 776,
    height: 352,
    alt: "A Serasona result banner reading “You are at Peak Performance” over the voice spectrogram",
    note: "One line first: where today’s read lands on the scale.",
    tall: false,
  },
  {
    id: "detail",
    src: "images/product/signal-detail.webp",
    width: 776,
    height: 1030,
    alt: "Serasona’s signal detail: recovery, energy, focus and drive, each placed between its two ends",
    note: "Then each signal, placed between its two ends, with its own margin.",
    tall: true,
  },
];

export const SerasonaHome = ({ onComplete }: SerasonaHomeProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [demoHeld, setDemoHeld] = useState(false);
  const [demoHover, setDemoHover] = useState(false);

  // One reveal. Content is visible by default; only once this script runs does
  // anything start hidden, so a failed bundle still shows the whole page.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.documentElement.classList.add("js");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }),
      { root, rootMargin: "0px 0px -10% 0px" },
    );
    root.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    // Never strand content: anything the observer has not reached shows anyway.
    const t = window.setTimeout(() => root.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-in")), 2500);
    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
  }, []);

  return (
    // overflow-y-auto stays: StickyCta finds the scroller by that class.
    <div ref={rootRef} className="sh-home absolute inset-0 overflow-y-auto" data-allow-wrap>
      <SiteHeader masthead />
      <StickyCta onStart={onComplete} />

      <main>
        {/* Hero: the figure leads, the claim and the action beside it */}
        <section className="sh-hero" aria-labelledby="sh-hero-head">
          <div className="sh-container sh-grid sh-hero__grid">
            <p className="sh-hero__figure" aria-hidden="true">
              <span className="sh-hero__num">20</span>
              <span className="sh-hero__unit">seconds</span>
            </p>
            <div className="sh-hero__text">
              <h1 id="sh-hero-head">No ring,<br />no band,<br />no wearable.</h1>
              <p className="lead">
                One daily check-in by voice, read against your own history.
              </p>
              <div className="sh-hero__actions">
                <button type="button" className="sh-btn" onClick={onComplete}>
                  Try a free check-in
                </button>
                <Link to="/pricing" className="sh-link">
                  See plans and pricing
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* The check-in: the steps beside the demo playing them out */}
        <section className="sh-section--first" aria-labelledby="sh-checkin-head">
          <div className="sh-container sh-grid">
            <div className="sh-checkin__steps" data-reveal>
              <div className="sh-head">
                <h2 id="sh-checkin-head">Speak, then see what moved</h2>
              </div>
              <ol className="sh-steps">
                {HOW_IT_WORKS.map((item) => (
                  <li key={item.title}>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </li>
                ))}
              </ol>
            </div>
            <figure
              className="sh-checkin__demo"
              onPointerEnter={() => setDemoHover(true)}
              onPointerLeave={() => setDemoHover(false)}
              onFocus={() => setDemoHover(true)}
              onBlur={() => setDemoHover(false)}
            >
              {/* A check-in, playing out. Vector and motion rather than a
                  video file: see VoiceDemo for why this is not a person. */}
              <VoiceDemo paused={demoHeld || demoHover} />
              <button
                type="button"
                className="sh-quiet sh-checkin__pause"
                aria-pressed={demoHeld}
                onClick={() => setDemoHeld((h) => !h)}
              >
                {demoHeld ? "Play" : "Pause"}
              </button>
            </figure>
          </div>
        </section>

        {/* What a voice biomarker is: the head beside four rows */}
        <section className="sh-section--l" aria-labelledby="sh-bio-head">
          <div className="sh-container">
            <div className="sh-rows__head sh-head">
              <h2 id="sh-bio-head">What’s a voice biomarker?</h2>
              <p className="lead">
                A measurable feature of how your breath, vocal cords and articulation coordinate as you speak.
              </p>
            </div>
            <ul className="sh-rows__list" data-reveal>
              {VOICE_BIOMARKERS.map((item) => (
                <li key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* A wearable against your voice */}
        <section className="sh-section" aria-labelledby="sh-compare-head">
          <div className="sh-container sh-grid">
            <figure className="sh-compare__photo">
              <img
                src={asset("video/band-conversation.jpg")}
                alt="A woman on a phone call at home, smiling"
                width={1600}
                height={1068}
                loading="lazy"
                decoding="async"
              />
            </figure>
            <div className="sh-compare__body">
              <div className="sh-head sh-head--flush">
                <h2 id="sh-compare-head">A wearable waits on your wrist</h2>
                <p className="lead">Serasona uses the thing you were going to do anyway.</p>
              </div>
              <table className="sh-table">
                <thead>
                  <tr>
                    <th scope="col"><span className="visually-hidden">Compared</span></th>
                    <th scope="col">A wearable</th>
                    <th scope="col">Serasona</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((r) => (
                    <tr key={r.row}>
                      <th scope="row">{r.row}</th>
                      <td>{r.wearable}</td>
                      <td>{r.voice}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* What lands after: the real result screens, both at once */}
        <section className="sh-section--l" aria-labelledby="sh-result-head">
          <div className="sh-container">
            <div className="sh-head">
              <h2 id="sh-result-head">What lands after you speak</h2>
            </div>
            <div className="sh-result">
              {SHOTS.map((s) => (
                <figure key={s.id} className={`sh-result__shot${s.tall ? " sh-result__shot--tall" : ""}`} data-kind="product">
                  <img src={asset(s.src)} alt={s.alt} width={s.width} height={s.height} loading="lazy" decoding="async" />
                  <figcaption>{s.note}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* The model behind the read */}
        <section className="sh-section" aria-labelledby="sh-model-head">
          <div className="sh-container">
            <div className="sh-head">
              <h2 id="sh-model-head">The model behind each read</h2>
            </div>
            <dl className="sh-figures" data-reveal>
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <dt>{stat.label}</dt>
                  <dd>{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Plans, and the action once more */}
        <section className="sh-section--l" aria-labelledby="sh-plans-head">
          <div className="sh-container">
            <div className="sh-head">
              <h2 id="sh-plans-head">Start free, then every day</h2>
            </div>
            <div className="sh-plans">
              {PLANS.map((p) => (
                <article key={p.name} className="sh-plan">
                  <h3>{p.name}</h3>
                  <p>{p.body}</p>
                </article>
              ))}
            </div>
            <div className="sh-close">
              <p>Your first check-in costs nothing.</p>
              <div className="sh-close__actions">
                <Link to="/pricing" className="sh-link">
                  See plans and pricing
                </Link>
                <button type="button" className="sh-btn" onClick={onComplete}>
                  Try a free check-in
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Questions */}
        <section className="sh-section--l" aria-labelledby="sh-faq-head">
          <div className="sh-container sh-grid">
            <div className="sh-faq__head">
              <h2 id="sh-faq-head">Before you speak</h2>
            </div>
            <Accordion type="single" collapsible className="sh-faq__list">
              {FAQ_ITEMS.map((item) => (
                <AccordionItem key={item.question} value={item.question}>
                  <AccordionTrigger className="sh-faq__q py-3 font-semibold">{item.question}</AccordionTrigger>
                  <AccordionContent className="sh-faq__a">{item.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      </main>

      {/* Footer: the audio bands as a sign-off */}
      <footer className="sh-foot">
        <div className="sh-container">
          <div className="sh-foot__sign">
            <img src={asset("brand/serasona-logo-full.svg")} alt="Serasona" />
          </div>
          <nav className="sh-foot__links" aria-label="Footer">
            <Link to="/pricing">Pricing</Link>
            <Link to="/signup">Create account</Link>
            <Link to="/login">Log in</Link>
            <Link to="/models">Models</Link>
            <Link to="/science">Scientific Analysis</Link>
          </nav>
          <p className="sh-foot__legal">
            Serasona is a wellness product. It is not a medical device and does not diagnose, treat, prevent,
            or cure any condition.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default SerasonaHome;
