import { Link } from "react-router-dom";
import { SCORE_VERSION, SIGN_DEFINITIONS, GROUP_LABELS, BAND_INDEX } from "@/lib/serasona-score";
import { MODEL_SIGN_NAMES } from "@/lib/score-matrix";
import { MODELS } from "@/lib/models";
import { MEASUREMENT_EVIDENCE, SCORE_REFERENCES } from "@/lib/score-evidence";
import "./score-docs.css";
import { asset } from "@/lib/asset";

export default function ScoreDocs() {
  return <main className="score-docs">
    <article>
      <img src={asset("brand/serasona-logo-full.svg")} alt="Serasona" className="score-docs-brand" />
      <nav aria-label="Documentation"><Link to="/docs">Docs</Link><span> / </span><span>Serasona Score</span></nav>
      <p className="score-docs-label">SCORING METHOD · OCTOBER 2026 · {SCORE_VERSION}</p>
      <h1>How the Serasona Score works.</h1>
      <p className="score-docs-lead">One view of the voice signs your recording returned, with the weights, comparisons and research behind it.</p>
      <p>The score runs from 0 to 100. Higher values mean fewer flagged signs in the measured set.</p>
      <nav className="score-docs-contents" aria-label="On this page"><a href="#calculation">Calculation</a><a href="#levels">Levels and models</a><a href="#weights">Weights</a><a href="#history">Over time</a><a href="#measurements">Measurements and evidence</a><a href="#references">References</a></nav>

      <section id="calculation"><h2>From recording to score</h2>
        <p>The voice model returns signs with a raw score and a result level. Serasona first applies its display band rules, then converts each readable band into an index.</p>
        <table><caption>Band values used in the composite</caption><thead><tr><th scope="col">Displayed band</th><th scope="col">Index</th></tr></thead><tbody>{Object.entries(BAND_INDEX).map(([band, value]) => <tr key={band}><th scope="row">{band}</th><td>{value}</td></tr>)}<tr><th scope="row">INCONCLUSIVE</th><td>Excluded</td></tr></tbody></table>
        <p>Ordinary signs map API levels none and low to Normal, consider to Low, moderate to Moderate, and elevated to Elevated. Two display exceptions also affect the score: blood pressure and head impact flag only at Elevated; cardiovascular strain and cognitive load use raw score cutoffs of 0.90 for Moderate and 0.95 for Elevated. Below 0.90 they read Normal.</p>
        <div className="score-docs-formula">Score = round[sum(sign index × sign weight) ÷ sum(scored sign weights)]</div>
        <p>For example, Stress at Moderate has index 38 and weight 20. Hydration at Low has index 68 and weight 6. If these are the only readable signs, the score is round[(38 × 20 + 68 × 6) ÷ 26] = <strong>45</strong>. Their effective weights are about 76.9% and 23.1%.</p>
        <p>Missing, inconclusive, invalid and unrecognized signs are excluded from both sums. Repeated signs count once. If nothing can be scored, the result is “No score yet”, rather than zero. Stress and Wellness indices use the same calculation within each group. The dashboard <Link to="/docs/clarity-score">Clarity Index</Link> uses its own weighted mental readiness composite, including fatigue and stress context from Pulse. It does not change the overall score or the group weights below.</p>
        <p>Scores of 67 or above are labeled Clear, 34 to 66 Watch, and below 34 Strained. These labels summarize the composite. A high score does not cancel an individual flag or a provider recommended action.</p>
      </section>

      <section id="levels"><h2>What each level can measure</h2>
        <table><caption>Current included model access</caption><thead><tr><th scope="col">Level</th><th scope="col">Included models</th></tr></thead><tbody><tr><th scope="row">Free</th><td>Pulse, one check-in</td></tr><tr><th scope="row">Core</th><td>Pulse, repeated check-ins</td></tr><tr><th scope="row">Plus</th><td>Pulse, Haven, Apex and Tide</td></tr><tr><th scope="row">Executive</th><td>All eight models</td></tr></tbody></table>
        <p>Access does not mean every model ran. The score uses the signs actually returned for that recording. Consent and activation requirements still apply. Upgrading a plan does not change an earlier recording’s score.</p>
        <div className="score-docs-models">{MODELS.map((model) => <div key={model.id}><h3>{model.name}</h3><p>{MODEL_SIGN_NAMES[model.id].map((name) => MEASUREMENT_EVIDENCE[name].label).join(" · ")}</p></div>)}</div>
      </section>

      <section id="weights"><h2>The weighting matrix</h2>
        <p>These are relative weights. Each recording’s effective percentages are recalculated using only its scored signs. Stress and anxiety carry the largest individual weights; multiple related wellness signs each carry less.</p>
        <table><caption>Current relative sign weights</caption><thead><tr><th scope="col">Measurement</th><th scope="col">Group</th><th scope="col">Weight</th></tr></thead><tbody>{Object.entries(SIGN_DEFINITIONS).map(([name, definition]) => <tr key={name}><th scope="row"><a href={`#measurement-${name}`}>{MEASUREMENT_EVIDENCE[name].label}</a></th><td>{GROUP_LABELS[definition.group]}</td><td>{definition.weight}</td></tr>)}</tbody></table>
      </section>

      <section id="history"><h2>Following the score over time</h2>
        <p>Compare recordings with the same source, model, score formula version and scored sign coverage. Phone and browser recordings remain separate. If a sign becomes unreadable or a different model is used, the dashboard starts a different comparison set. A change in coverage alone should not look like a wellness improvement.</p>
        <p>The composite history shows this product index across comparable recordings. The longitudinal API separately estimates personal baselines, current estimates, deviations and anomalies for individual signs. These are different quantities, and the API's raw values are not averaged into the Serasona Score.</p>
        <p>New grouped recordings build a personal history. The first recording has no personal baseline. Closely spaced recordings may pool into one independent observation, and signs need sufficient independent history before a stable trend can be interpreted. Older recordings are not automatically included in a newly created baseline group.</p>
        <p>See the <a href="https://docs.amplifierhealth.com/reference/longitudinal-api" target="_blank" rel="noopener noreferrer">longitudinal API contract</a> and <a href="https://docs.amplifierhealth.com/guides/longitudinal" target="_blank" rel="noopener noreferrer">baseline concepts</a>.</p>
      </section>

      <section id="measurements"><h2>Measurements and voice biomarker evidence</h2>
        <p>Pitch is the rate of vocal fold vibration. Jitter and shimmer describe cycle variation in frequency and amplitude. Harmonics to noise ratio describes periodic sound relative to noise. Prosody includes pitch, rhythm and intensity; spectral features describe how sound energy is distributed. Pauses and articulation timing describe speech organization.</p>
        <p><a href="#reference-acoustics">The GeMAPS research paper</a> describes standard acoustic features used in voice research.</p>
        <p>The acoustic features below describe research context and the provider’s physiological rationale. Microphone, language, age, medication, illness and recording conditions can all affect them.</p>
        {Object.entries(SIGN_DEFINITIONS).map(([name]) => {
          const evidence = MEASUREMENT_EVIDENCE[name];
          const providerAnchor = ["cardiovascular-strain", "cognitive-load", "dry-mouth", "emotional-destabilization"].includes(name) ? "model-internal-signs" : name;
          return <article className="score-docs-measurement" id={`measurement-${name}`} key={name}><h3>{evidence.label}</h3><p><strong>Voice features:</strong> {evidence.acoustics}</p><p>{evidence.context}</p><p className="score-docs-citations">{evidence.references.map((id) => <a key={id} href={`#reference-${id}`}>{SCORE_REFERENCES[id].title.split(". ")[0]}</a>)}<a href={`https://docs.amplifierhealth.com/catalogs/signs/#${providerAnchor}`} target="_blank" rel="noopener noreferrer">Provider sign documentation</a></p></article>;
        })}
      </section>

      <section id="references"><h2>References</h2><p>Selected primary studies and technical documentation, reviewed October 18, 2026.</p><ol>{Object.entries(SCORE_REFERENCES).map(([id, reference]) => <li id={`reference-${id}`} key={id}><a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.title}</a></li>)}</ol><p><a href="https://docs.amplifierhealth.com/catalogs/signs/" target="_blank" rel="noopener noreferrer">Voice biomarker technical catalogue</a> supplies provider terminology, mechanisms and its own evidence classifications.</p></section>
      <footer><p>Serasona is a general wellness product. Voice patterns do not establish a diagnosis or replace clinical measurements such as blood pressure, blood tests, spirometry or a cognitive assessment.</p><Link to="/dashboard">Your dashboard</Link><Link to="/docs/stress-score">Stress Index method</Link><Link to="/docs/wellness-score">Wellness Index method</Link><Link to="/docs/clarity-score">Clarity Index method</Link><Link to="/docs/sleep-score">Sleep Score method</Link><Link to="/science">Voice science</Link></footer>
    </article>
  </main>;
}
