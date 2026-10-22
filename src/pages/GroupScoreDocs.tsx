import { Link } from "react-router-dom";
import { BAND_INDEX, SIGN_DEFINITIONS, GROUP_LABELS, type ScoreGroup } from "@/lib/serasona-score";
import { MEASUREMENT_EVIDENCE, SCORE_REFERENCES } from "@/lib/score-evidence";
import "./score-docs.css";
import { asset } from "@/lib/asset";

/**
 * One page per group of the Serasona Score (Stress, Wellness, Clarity),
 * mirroring ScoreDocs.tsx but scoped to a single group's own signs.
 *
 * This does not re-derive evidence: MEASUREMENT_EVIDENCE and SCORE_REFERENCES
 * (score-evidence.ts) already carry a PubMed-checked reference for every sign
 * in the catalogue, reviewed to the same bar as the Sleep Score's own sources.
 * This page is a filtered view of that existing, already-researched table —
 * not a second, separately-sourced evidence set for the same signs.
 */
export default function GroupScoreDocs({ group }: { group: ScoreGroup }) {
  const groupLabel = GROUP_LABELS[group];
  const signs = Object.entries(SIGN_DEFINITIONS).filter(([, def]) => def.group === group);
  const referenceIds = [...new Set(signs.flatMap(([name]) => MEASUREMENT_EVIDENCE[name].references))];

  return <main className="score-docs">
    <article>
      <img src={asset("brand/serasona-logo-full.svg")} alt="Serasona" className="score-docs-brand" />
      <nav aria-label="Documentation"><Link to="/docs">Docs</Link><span> / </span><span>{groupLabel} Index</span></nav>
      <p className="score-docs-label">SCORING METHOD · OCTOBER 2026</p>
      <h1>How the {groupLabel} Index works.</h1>
      <p className="score-docs-lead">One of the three groups inside your Serasona Score, read on its own.</p>
      <p>The {groupLabel} Index runs from 0 to 100, using only the {signs.length} signs below. Higher values mean fewer flagged signs in this group. It is a provisional product index, not a validated clinical scale.</p>
      <nav className="score-docs-contents" aria-label="On this page"><a href="#calculation">Calculation</a><a href="#measurements">Why these signs</a><a href="#weights">Weights</a><a href="#references">References</a></nav>

      <section id="calculation"><h2>From recording to index</h2>
        <p>This reuses the same sign bands the overall <Link to="/docs/serasona-score">Serasona Score</Link> uses, restricted to the {groupLabel} group's own signs. A sign in a different group is not part of this index at all.</p>
        <table><caption>Band values used in the index</caption><thead><tr><th scope="col">Displayed band</th><th scope="col">Index</th></tr></thead><tbody>{Object.entries(BAND_INDEX).map(([band, value]) => <tr key={band}><th scope="row">{band}</th><td>{value}</td></tr>)}<tr><th scope="row">INCONCLUSIVE</th><td>Excluded</td></tr></tbody></table>
        <div className="score-docs-formula">{groupLabel} Index = round[sum(sign index × weight) ÷ sum(scored weights)]</div>
        <p>Missing, inconclusive and unrecognized signs are excluded from both sums. If a recording returned no sign from this group, the result is “Not read”, not zero.</p>
      </section>

      <section id="measurements"><h2>Why these signs, and on what evidence</h2>
        <p>“Direct research” means the listed study examines voice in the named domain. “Related research” means its population, task or outcome differs from this exact output. “Physiological rationale” means a plausible mechanism without directly applicable detection validation here. None of these labels establishes Serasona accuracy.</p>
        {signs.map(([name]) => {
          const evidence = MEASUREMENT_EVIDENCE[name];
          return <article className="score-docs-measurement" id={`measurement-${name}`} key={name}>
            <p className="score-docs-label">{evidence.basis}</p>
            <h3>{evidence.label}</h3>
            <p><strong>Voice features:</strong> {evidence.acoustics}</p>
            <p>{evidence.context}</p>
            <p className="score-docs-citations">{evidence.references.map((id) => <a key={id} href={`#reference-${id}`}>{SCORE_REFERENCES[id].title.split(". ")[0]}</a>)}</p>
          </article>;
        })}
      </section>

      <section id="weights"><h2>The weighting matrix</h2>
        <p>These are relative weights within the {groupLabel} group only — they do not include the other two groups, and they are recalculated from only the signs a given recording actually returned.</p>
        <table><caption>Current {groupLabel.toLowerCase()} sign weights</caption><thead><tr><th scope="col">Measurement</th><th scope="col">Weight</th></tr></thead><tbody>{signs.map(([name, def]) => <tr key={name}><th scope="row"><a href={`#measurement-${name}`}>{MEASUREMENT_EVIDENCE[name].label}</a></th><td>{def.weight}</td></tr>)}</tbody></table>
      </section>

      <section id="references"><h2>References</h2><p>Selected primary studies and technical documentation behind the {groupLabel} Index's own signs, reviewed October 2026. The full reference list for every sign in the catalogue is on the <Link to="/docs/serasona-score#references">Serasona Score page</Link>.</p><ol>{referenceIds.map((id) => <li id={`reference-${id}`} key={id}><a href={SCORE_REFERENCES[id].url} target="_blank" rel="noopener noreferrer">{SCORE_REFERENCES[id].title}</a></li>)}</ol></section>
      <footer><p>Serasona is a general wellness product. Voice patterns do not establish a diagnosis or replace clinical measurements.</p><Link to="/dashboard">Your dashboard</Link><Link to="/docs/serasona-score">Serasona Score method</Link><Link to="/docs/sleep-score">Sleep Score method</Link><Link to="/science">Voice science</Link></footer>
    </article>
  </main>;
}
