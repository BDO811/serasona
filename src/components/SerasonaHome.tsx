import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { asset } from "@/lib/asset";
import { SiteHeader } from "@/components/SiteHeader";
import { VoiceDemo } from "@/components/VoiceDemo";
import { AmbientVideo } from "@/components/AmbientVideo";
import { Reveal, CountUp, ParallaxBand, StickyCta } from "@/components/motion-primitives";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface SerasonaHomeProps {
  onComplete: () => void;
}

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Speak for twenty seconds",
    body: "Open the app or pick up when Serasona calls. No forms, no appointment.",
  },
  {
    step: "02",
    title: "Serasona reads it",
    body: "Ten biomarkers, pulled from how you spoke, not just what you said.",
  },
  {
    step: "03",
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

const FAQ_ITEMS = [
  {
    question: "Is Serasona a medical device?",
    answer:
      "No. Serasona is a wellness product. It does not diagnose, treat, prevent, or cure any condition. It reports a signal — it does not know why a number moved.",
  },
  {
    question: "What happens to my voice recording?",
    answer:
      "It's processed to produce your signals and then discarded. Serasona stores the numbers, not the audio, and never sells personal information.",
  },
  {
    question: "How is this different from a wearable?",
    answer:
      "A wearable reads your body. Nothing else reads your voice. Twenty seconds of speech, no device, no skin contact, no charging.",
  },
  {
    question: "What if something looks seriously off?",
    answer:
      "Serasona reports a signal, not a diagnosis — a real person is always an option for anything beyond what a daily check-in can tell you. For medical concerns, talk to a licensed clinician.",
  },
  {
    question: "Can I use this without the app?",
    answer:
      "Yes, on Plus and above — Serasona calls you on any phone, including a landline, and the result still lands in your account.",
  },
];

const STATS = [
  { value: "2.4M", label: "World's Largest Dataset" },
  { value: "14,000", label: "Physician-Labeled Conditions & States" },
  { value: "75+", label: "Production Indicators" },
  { value: "40+", label: "Languages" },
];

const WAVEFORM_BARS = Array.from({ length: 48 }, (_, i) => {
  const t = i / 47;
  // Layered sine waves for an organic voice-waveform silhouette
  const h = 0.25 + Math.abs(Math.sin(t * Math.PI * 3.2)) * 0.55 + Math.abs(Math.sin(t * Math.PI * 9)) * 0.2;
  return Math.min(1, h);
});

export const SerasonaHome = ({ onComplete }: SerasonaHomeProps) => {
  return (
    <div
      className="absolute inset-0 overflow-y-auto"
      style={{ backgroundColor: "#fbf7f1" }}
    >
      {/* Shared site chrome: adapts to who is signed in, which the inline
          nav this replaced did not. */}
      <SiteHeader overlay />
      <StickyCta onStart={onComplete} />

      {/* The hero sits in its own stacking context so the ambient footage can
          run full-bleed behind it and fade out before the sections below. */}
      <div className="relative">
        <AmbientVideo />

        <div className="relative mx-auto flex max-w-[900px] flex-col items-center px-6 pb-24 pt-16 text-center md:pt-24">
        {/* Eyebrow */}
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="font-mono text-sm tracking-[0.25em] uppercase text-black/90"
        >
          Nothing to buy. Nothing to wear.
        </motion.span>

        {/* Hero headline */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-6 font-serif text-[13vw] leading-[0.95] tracking-tight text-black sm:text-6xl md:text-7xl"
        >
          <span className="font-semibold text-[#0d6a76]">No ring, no band, no wearable to buy,</span>
          <br />
          <span className="italic">get a deeper understanding of your body than any device.</span>
        </motion.h1>

        {/* Waveform accent */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-10 flex h-14 w-full max-w-md items-center justify-center gap-[3px]"
        >
          {WAVEFORM_BARS.map((h, i) => (
            <motion.div
              key={i}
              className="w-[3px] rounded-full bg-black/70"
              style={{ height: `${h * 100}%`, transformOrigin: "center" }}
              animate={{ scaleY: [0.4, 1.2, 0.4] }}
              transition={{
                duration: 1.1 + (i % 5) * 0.15,
                repeat: Infinity,
                ease: "easeInOut",
                delay: (i % 12) * 0.06,
              }}
            />
          ))}
        </motion.div>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-10 max-w-[560px] text-lg leading-relaxed text-black/70 md:text-xl"
        >
          Hundreds of dollars buys a device that only reads your body. Your
          voice is free, and it already carries seven signals, including
          stress, mood, and energy, that no device can read.
        </motion.p>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onComplete}
          className="mt-12 rounded-full bg-black px-10 py-5 font-mono text-sm font-medium uppercase tracking-[0.2em] text-[#fbf7f1] transition-colors hover:bg-black/[0.85]"
        >
          Try Serasona
        </motion.button>

        <Link
          to="/pricing"
          className="mt-5 font-mono text-xs uppercase tracking-[0.15em] text-black/55 underline underline-offset-4 transition-colors hover:text-black/80"
        >
          Or see plans and pricing
        </Link>

        {/* A check-in, playing out. Vector and motion rather than a video file:
            see VoiceDemo for why this is not a person. */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="mt-24 w-full"
        >
          <p className="mb-8 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-black/45">
            What a check-in looks like
          </p>
          <VoiceDemo />
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6 }}
          className="mt-20 grid w-full grid-cols-2 gap-x-6 gap-y-10 border-t border-black/15 pt-12 md:grid-cols-4"
        >
          {STATS.map((stat) => (
            <div key={stat.label}>
              <CountUp value={stat.value} className="block font-serif text-3xl text-black md:text-4xl" />
              <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-black/55">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Brand signature: the audio bands alone, closing the page the way
            they open it in the nav, this time without the wordmark. */}
        <motion.img
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          src={asset("brand/serasona-logo-bands.svg")}
          alt=""
          aria-hidden="true"
          className="mt-20 h-16 w-auto max-w-full md:h-20"
        />
        </div>
      </div>

      {/* A full-bleed beat between the hero and the explainer, so the page
          stops reading as one long column of centred text. */}
      <ParallaxBand src={asset("video/band-conversation.jpg")}>
        <Reveal>
          <p className="mx-auto max-w-[680px] text-center font-serif text-2xl leading-snug text-[#fbf7f1] md:text-4xl">
            A wearable waits on your wrist. Serasona needs the thing you were
            going to do anyway.
          </p>
        </Reveal>
      </ParallaxBand>

      {/* What's a voice biomarker */}
      <div className="border-t border-black/10 px-6 py-24 md:py-28">
        <div className="mx-auto max-w-[900px]">
          <div className="mx-auto max-w-[640px] text-center">
            <Reveal><h2 className="font-serif text-3xl text-black md:text-4xl">What's a voice biomarker?</h2></Reveal>
            <p className="mt-5 text-sm leading-relaxed text-black/65 md:text-base">
              Speech is one of the most demanding things your body does. In the time it takes to say a
              sentence, your breath, vocal cords, and articulation all have to coordinate in real time,
              drawing on the same systems that carry stress, fatigue, and mood. A voice biomarker is a
              measurable feature of that coordination, the kind a person can't hear by listening but a
              model can measure reliably, twenty seconds at a time.
            </p>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4 md:gap-8">
            {VOICE_BIOMARKERS.map((item) => (
              <div key={item.title}>
                <h3 className="font-serif text-lg text-black">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-black/65">{item.body}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-14 max-w-[640px] text-center text-sm leading-relaxed text-black/65">
            None of these features mean anything on their own. What matters is how yours move against your
            own history, not against anyone else's.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="border-t border-black/10 px-6 py-24 md:py-28">
        <div className="mx-auto max-w-[900px]">
          <Reveal><h2 className="text-center font-serif text-3xl text-black md:text-4xl">How it works</h2></Reveal>
          <div className="mt-14 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step}>
                <div className="font-mono text-xs tracking-[0.2em] text-black/40">{item.step}</div>
                <h3 className="mt-3 font-serif text-xl text-black">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-black/65">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing teaser */}
      <div className="border-t border-black/10 px-6 py-24 md:py-28" style={{ backgroundColor: "#f2ebe0" }}>
        <div className="mx-auto max-w-[700px] text-center">
          <Reveal><h2 className="font-serif text-3xl text-black md:text-4xl">Simple pricing</h2></Reveal>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-black/65">
            One free check-in to start. Core tracks ten biomarkers against your own history, every day.
            Plus adds a daily call, no app required.
          </p>
          <Link
            to="/pricing"
            className="mt-8 inline-block rounded-full bg-black px-8 py-4 font-mono text-xs font-medium uppercase tracking-[0.2em] text-[#fbf7f1] transition-colors hover:bg-black/[0.85]"
          >
            See plans and pricing
          </Link>
        </div>
      </div>

      {/* Trust / escalation */}
      <div className="border-t border-black/10 px-6 py-24 md:py-28">
        <div className="mx-auto grid max-w-[900px] grid-cols-1 gap-10 md:grid-cols-3">
          <div>
            <h3 className="font-serif text-lg text-black">Never a diagnosis</h3>
            <p className="mt-2 text-sm leading-relaxed text-black/65">
              Serasona reports a signal. It is a wellness product and does not diagnose, treat, prevent, or
              cure any condition.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-lg text-black">Compared to you, only</h3>
            <p className="mt-2 text-sm leading-relaxed text-black/65">
              Every number is read against your own thirty-day history, never a population average.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-lg text-black">A real person is always an option</h3>
            <p className="mt-2 text-sm leading-relaxed text-black/65">
              For anything a daily check-in can't answer, talk to a licensed clinician. Serasona is a
              companion, not a replacement.
            </p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="border-t border-black/10 px-6 py-24 md:py-28" style={{ backgroundColor: "#f2ebe0" }}>
        <div className="mx-auto max-w-[700px]">
          <Reveal><h2 className="text-center font-serif text-3xl text-black md:text-4xl">Questions</h2></Reveal>
          <Accordion type="single" collapsible className="mt-10">
            {FAQ_ITEMS.map((item) => (
              <AccordionItem key={item.question} value={item.question}>
                <AccordionTrigger className="text-left font-serif text-base text-black">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-black/65">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-black/10 px-6 py-16 text-center">
        <img
          src={asset("brand/serasona-logo-full.svg")}
          alt="Serasona"
          className="mx-auto h-6 w-auto"
        />
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-xs uppercase tracking-[0.15em] text-black/55">
          <Link to="/pricing" className="hover:text-black">
            Pricing
          </Link>
          <Link to="/signup" className="hover:text-black">
            Create account
          </Link>
          <Link to="/login" className="hover:text-black">
            Log in
          </Link>
          <Link to="/science" className="hover:text-black">
            Scientific Analysis
          </Link>
        </div>
        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.15em] text-black/40">
          Serasona is a wellness product. It is not a medical device and does not diagnose, treat, prevent,
          or cure any condition.
        </p>
      </div>
    </div>
  );
};

export default SerasonaHome;
