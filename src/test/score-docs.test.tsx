import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ScoreDocs from "@/pages/ScoreDocs";
import { SIGN_DEFINITIONS } from "@/lib/serasona-score";
import { MEASUREMENT_EVIDENCE, SCORE_REFERENCES } from "@/lib/score-evidence";

afterEach(cleanup);
describe("score documentation coverage", () => {
  it("documents every weighted sign and resolves its reference links", () => {
    expect(Object.keys(MEASUREMENT_EVIDENCE).sort()).toEqual(Object.keys(SIGN_DEFINITIONS).sort());
    render(<MemoryRouter><ScoreDocs /></MemoryRouter>);
    expect(screen.getByRole("img", { name: "Serasona" })).toHaveAttribute("src", expect.stringContaining("serasona-logo-full.svg"));
    expect(screen.queryByRole("img", { name: /amplifier/i })).not.toBeInTheDocument();
    for (const [name, evidence] of Object.entries(MEASUREMENT_EVIDENCE)) {
      const section = document.getElementById(`measurement-${name}`)!;
      expect(within(section).getByRole("heading", { name: evidence.label })).toBeInTheDocument();
      expect(within(section).getByRole("link", { name: "Provider sign documentation" })).toHaveAttribute("href", expect.stringContaining("https://docs.amplifierhealth.com/"));
      for (const id of evidence.references) expect(document.getElementById(`reference-${id}`)).toHaveTextContent(SCORE_REFERENCES[id].title);
    }
    expect(screen.getByText(/Higher values mean fewer flagged signs/)).toBeInTheDocument();
  });
});
