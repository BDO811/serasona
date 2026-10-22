import { Link } from "react-router-dom";
import { BAND_INDEX } from "@/lib/serasona-score";
import { SLEEP_SIGN_WEIGHTS, SLEEP_SCORE_VERSION } from "@/lib/sleep-score";
import { SLEEP_MEASUREMENT_RATIONALE, SLEEP_SCORE_REFERENCES, sleepReferenceFor } from "@/lib/sleep-score-evidence";
import "./score-docs.css";
import { asset } from "@/lib/asset";

export default function SleepScoreDocs() {
  return <main className="score-docs">
    <article>
      <img src={asset("brand/serasona-logo-full.svg")} alt="Serasona" className="score-docs-brand" />
      <nav aria-label="Documentation"><Link to="/docs">Docs</Link><span> / </span><span>Sleep Score</span></nav>
      <p className="score-docs-label">SCORING METHOD · OCTOBER 2026 · {SLEEP_SCORE_VERSION}</p>
      <h1>How the Sleep Score works.</h1>
      <p className="score-docs-lead">A second read of the same recording, over the signs published research connects to sleep debt.</p>
      <p>The score runs from 0 to 100. Higher values mean fewer flagged signs in the sleep-relevant set. It does not ask about sleep, estimate how long you slept, or read a sleep stage — Serasona has no sleep-specific voice model. It is a provisional, exploratory index built from signs the platform already measures for other reasons. The weights and thresholds are product choices, not coefficients established by the papers below, and the composite itself has not been clinically validated.</p>
      <nav className="score-docs-contents" aria-label="On this page"><a href="#calculation">Calculation</a><a href="#evidence">Why these signs</a><a href="#weights">Weights</a><a href="#limits">What this is not</a><a href="#references">References</a></nav>

      <section id="calculation"><h2>From recording to score</h2>
        <p>This reuses the same sign bands the Serasona Score uses (see <Link to="/docs/serasona-score">its calculation</Link>), restricted to the subset listed under Weights below. A sign outside that set — hydration, allergy, head impact and the rest — is simply not part of this question, not counted as normal.</p>
        <table><caption>Band values used in the composite</caption><thead><tr><th scope="col">Displayed band</th><th scope="col">Index</th></tr></thead><tbody>{Object.entries(BAND_INDEX).map(([band, value]) => <tr key={band}><th scope="row">{band}</th><td>{value}</td></tr>)}<tr><th scope="row">INCONCLUSIVE</th><td>Excluded</td></tr></tbody></table>
        <div className="score-docs-formula">Sleep Score = round[sum(sign index × sleep weight) ÷ sum(scored sleep weights)]</div>
        <p>Missing, inconclusive and unrecognized signs are excluded from both sums. If a recording returned no sleep-relevant sign at all, the result is “No score yet”, not zero. Scores of 67 or above are labeled Clear, 34 to 66 Watch, and below 34 Strained — the same labels and thresholds as the Serasona Score, so one word means one thing across the product.</p>
      </section>

      <section id="evidence"><h2>Why these signs, and on what evidence</h2>
        <p>Only one of the eleven signs below has published research reading it from voice specifically after sleep loss: fatigue. The rest are here because non-voice sleep research connects that construct to sleep debt, and Serasona's own voice-based sign separately claims to read that construct — two evidence chains joined at the construct, not one study that measured both sleep and voice together. “Direct research” means a study examined voice and sleep loss together. “Related research” means sleep debt and voice were studied separately and are joined here by the shared construct. “Physiological rationale” means an established mechanism without a study of either side specific to Serasona. None of these labels establishes Serasona accuracy, and the Related and Physiological rationale signs do not become sleep measurements by being included here.</p>
        {Object.entries(SLEEP_SIGN_WEIGHTS).map(([name]) => {
          const evidence = SLEEP_MEASUREMENT_RATIONALE[name];
          return <article className="score-docs-measurement" id={`sleep-measurement-${name}`} key={name}>
            <p className="score-docs-label">{evidence.basis}</p>
            <h3>{evidence.label}</h3>
            <p>{evidence.rationale}</p>
            <p className="score-docs-citations">{evidence.references.map((id) => <a key={id} href={`#sleep-reference-${id}`}>{sleepReferenceFor(id).title.split(". ")[0]}</a>)}</p>
          </article>;
        })}
      </section>

      <section id="weights"><h2>The weighting matrix</h2>
        <p>These are relative weights, specific to this composite — they are not the Serasona Score's own weights for the same signs. Fatigue carries the most weight as the one sign with direct voice-sleep research. Weight expresses product emphasis, not evidence quality or diagnostic confidence.</p>
        <table><caption>Current relative sleep weights</caption><thead><tr><th scope="col">Measurement</th><th scope="col">Basis</th><th scope="col">Weight</th></tr></thead><tbody>{Object.entries(SLEEP_SIGN_WEIGHTS).map(([name, weight]) => <tr key={name}><th scope="row"><a href={`#sleep-measurement-${name}`}>{SLEEP_MEASUREMENT_RATIONALE[name].label}</a></th><td>{SLEEP_MEASUREMENT_RATIONALE[name].basis}</td><td>{weight}</td></tr>)}</tbody></table>
      </section>

      <section id="limits"><h2>What this is not</h2>
        <p>It is not a sleep tracker. Serasona does not record sleep, and this score should not be read as a substitute for one. Published validation of consumer sleep trackers against polysomnography — the clinical reference standard — finds real, sometimes substantial disagreement even in devices built specifically to measure sleep; a composite built from signs unrelated recordings return should be read with at least that much caution, and arguably more, since it was never designed as a sleep measurement in the first place.</p>
        <p>It is not a sleep debt calculation. A clinical sleep debt figure is the difference between the sleep someone needs and the sleep they got, tracked over time. This score has no access to either number — it reads voice signs that published, non-voice sleep research associates with the downstream effects of sleep debt, which is a different and weaker kind of evidence.</p>
        <p>It does not isolate sleep from everything else that moves these same signs. Fatigue, stress, mood and cognitive load all have causes besides sleep — illness, caffeine, a hard training week, a stressful day unrelated to sleep. A high or low Sleep Score describes a pattern across signs the platform already measures; it does not diagnose a cause.</p>
      </section>

      <section id="references"><h2>References</h2><p>Selected primary studies, reviewed October 2026, specific to this composite. The Serasona Score's own <Link to="/docs/serasona-score#references">reference list</Link> covers the acoustic evidence for each sign individually; these cover the sleep-debt side of the question. These studies use different populations, tasks and in most cases no voice recording at all. Their findings do not supply this score's weights or transfer their reported performance to Serasona.</p><ol>{Object.entries(SLEEP_SCORE_REFERENCES).map(([id, reference]) => <li id={`sleep-reference-${id}`} key={id}><a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.title}</a></li>)}</ol></section>
      <footer><p>Serasona is a general wellness product. Voice patterns do not establish a diagnosis or replace clinical measurements such as a sleep study, blood pressure, blood tests or a cognitive assessment.</p><Link to="/dashboard">Your dashboard</Link><Link to="/docs/serasona-score">Serasona Score method</Link><Link to="/science">Voice science</Link></footer>
    </article>
  </main>;
}
