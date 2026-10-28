import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ScoreDocs from "@/pages/ScoreDocs";
import GroupScoreDocs from "@/pages/GroupScoreDocs";
import { CLARITY_SIGN_WEIGHTS } from "@/lib/clarity-score";
import { SIGN_DEFINITIONS } from "@/lib/serasona-score";
import { MEASUREMENT_EVIDENCE, SCORE_REFERENCES } from "@/lib/score-evidence";

afterEach(cleanup);
describe("score documentation coverage", () => {
  it("documents the exact Clarity weights and its minimum input requirement", () => {
    render(<MemoryRouter><GroupScoreDocs group="clarity" /></MemoryRouter>);
    expect(screen.getByText(/not a cognitive test or a diagnosis/)).toBeInTheDocument();
    expect(screen.getByText(/At least one readable fatigue/)).toBeInTheDocument();
    const matrix = screen.getByRole("table", { name: "Current clarity sign weights" });
    for (const [name, weight] of Object.entries(CLARITY_SIGN_WEIGHTS)) {
      const row = within(matrix).getByRole("link", { name: MEASUREMENT_EVIDENCE[name].label }).closest("tr")!;
      expect(within(row).getByRole("cell")).toHaveTextContent(String(weight));
    }
  });
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
