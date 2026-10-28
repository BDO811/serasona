import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
const mocks = vi.hoisted(() => ({ sessions: [], loading: false, error: null as string | null, entitled: true, refresh: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { displayName: "Member" }, subscription: { planId: "executive", status: "active" }, isEntitled: () => mocks.entitled }) }));
vi.mock("@/hooks/use-voice-history", () => ({ useVoiceHistory: () => ({ ...mocks }) }));
vi.mock("@/components/member/VoiceSculpture", () => ({ VoiceSculpture: () => null, VoiceWave: () => null }));
vi.mock("recharts", () => ({ ResponsiveContainer: () => null, LineChart: () => null, Line: () => null, CartesianGrid: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null }));
const saved = { sessionId: "actual-saved-record", capturedAt: Date.now(), source: "browser", model: "pulse", pathway: "WELLNESS", summary: null, signals: [{ name: "stress", label: "Stress", score: .5, level: "moderate", flagged: true }, { name: "dehydration", label: "Dehydration", score: .3, level: "consider", flagged: true }] };
function open() { render(<MemoryRouter><Dashboard /></MemoryRouter>); }
beforeEach(() => { cleanup(); mocks.sessions = []; mocks.loading = false; mocks.error = null; mocks.entitled = true; });
describe("selected live dashboard", () => {
  it("exposes a control to pause and resume the rotating graphic", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Pause animations" }));
    expect(screen.getByRole("button", { name: "Play animations" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Play animations" }));
    expect(screen.getByRole("button", { name: "Pause animations" })).toBeInTheDocument();
  });
  it("shows a Clarity value and history for a Pulse check-in with fatigue", () => {
    mocks.sessions = [{ ...saved, signals: [...saved.signals, { name: "fatigue", label: "Fatigue", score: .5, level: "moderate", flagged: true }] }];
    open();
    const card = screen.getByRole("link", { name: /CLARITY INDEX/ });
    expect(card.querySelector("strong")).toHaveTextContent("38");
    expect(card).not.toHaveTextContent("Not read");
    expect(card).toHaveAttribute("href", "/docs/clarity-score");
    const row = screen.getByRole("row", { name: /^Clarity/ });
    expect(within(row).getByText("38")).toBeInTheDocument();
  });
  it("uses saved signs, links to real capture flows and filters the body map", () => {
    mocks.sessions = [saved]; open();
    expect(screen.getByRole("region", { name: "YOUR SERASONA SCORE" })).toHaveTextContent("45");
    expect(screen.getAllByRole("link", { name: "Record my voice" })[0]).toHaveAttribute("href", "/checkin");
    expect(screen.getAllByRole("link", { name: "Phone check-in" })[0]).toHaveAttribute("href", "/checkin/phone?mode=phone");
    expect(screen.getByRole("heading", { name: "YOUR SERASONA SCORE" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Neurocognitive" })).toBeInTheDocument();
    expect(document.querySelectorAll(".dv-body-info > div")).toHaveLength(0);
    const matrix = screen.getByRole("table", { name: "Your saved readings · Last 3 measurements" });
    expect(within(matrix).getAllByRole("columnheader")).toHaveLength(4);
    expect(within(matrix).getAllByText("No reading")).toHaveLength(8);
    expect(document.querySelectorAll(".dv-scale > span")).toHaveLength(4);
    expect(document.querySelectorAll(".dv-scale > [aria-current=true]")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Explore Core/ }));
    expect(screen.getByText("Core signals")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Stress: MODERATE" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all signs" }));
    expect(screen.getByRole("group", { name: "Stress: MODERATE" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "PHYSIOLOGIC ANALYSIS" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Record my voice" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Phone check-in" })).toHaveLength(1);
    expect(screen.queryByText("YOUR SUBSCRIPTION")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Assessment details" }));
    expect(screen.getByText("actual-saved-record")).toBeInTheDocument();
  });
  it("shows one actual reading without inventing prior history", () => {
    mocks.sessions = [saved]; open();
    expect(screen.getByText("YOUR SAVED RESULTS · 1 RECORDING")).toBeInTheDocument();
    expect(screen.getByText("Your first reading is saved. No prior measurements yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sample preview" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Saved trend/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "What does your serasona score mean" })).toHaveAttribute("href", "/docs/serasona-score");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("plots only actual comparable readings once another measurement exists", () => {
    mocks.sessions = [saved, { ...saved, sessionId: "earlier-real", capturedAt: saved.capturedAt - 86400000 }];
    open();
    expect(screen.getByRole("img", { name: /Saved trend.*across 2 dated measurements/ })).toBeInTheDocument();
    expect(screen.queryByText(/SAMPLE DATA/)).not.toBeInTheDocument();
  });
  it("keeps an unmeasured index unscored even with two saved recordings", () => {
    mocks.sessions = [saved, { ...saved, sessionId: "earlier-real", capturedAt: saved.capturedAt - 86400000 }];
    open();
    fireEvent.change(screen.getByRole("combobox", { name: "Trend metric" }), { target: { value: "clarity" } });
    expect(screen.queryByRole("img", { name: /Saved trend/ })).not.toBeInTheDocument();
    expect(screen.getByText("No trend available for these indices.")).toBeInTheDocument();
  });
  it("does not insert sample results for an empty account", () => {
    mocks.entitled = false; open();
    expect(screen.getByText("Your first reading starts with your voice.")).toBeInTheDocument();
    expect(screen.queryByText("MEDIUM")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Upgrade for phone calls" })[0]).toHaveAttribute("href", "/account#subscription");
  });
  it("shows a retry on history errors", () => {
    mocks.error = "Offline"; open();
    expect(screen.getByRole("alert")).toHaveTextContent("Offline");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
