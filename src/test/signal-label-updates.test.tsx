import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { SignalPanel } from "@/components/report/SignalPanel";
import { bandForSignal, bandLabelForSignal } from "@/lib/signal-band";

afterEach(cleanup);
describe("requested signal presentation", () => {
  it.each(["dehydration", "mood-disruption", "anxiety"])("labels unflagged %s NONE without changing its scoring band", (name) => {
    expect(bandForSignal(name, "none", .1)).toBe("NORMAL");
    expect(bandLabelForSignal(name, "NORMAL")).toBe("NONE");
    expect(bandLabelForSignal(name, "MODERATE")).toBe("MODERATE");
  });
  it("shows the finding only in the scale and keeps inconclusive readable", () => {
    render(<SignalPanel showContent signals={[
      { name: "dehydration", label: "Dehydration", level: "moderate", score: .5, flagged: true },
      { name: "anxiety", label: "Anxiety", level: "inconclusive", score: .1, flagged: false },
    ]} />);
    const scale = screen.getByRole("group", { name: "Dehydration: MODERATE" });
    expect(within(scale).getByText("NONE")).toBeInTheDocument();
    expect(screen.getAllByText("MODERATE")).toHaveLength(2);
    expect(screen.getByText("Inconclusive. This sign could not be scored.")).toBeInTheDocument();
  });
});
