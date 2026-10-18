import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  it("uses saved signs, links to real capture flows and filters the body map", () => {
    mocks.sessions = [saved]; open();
    expect(screen.getByRole("region", { name: "YOUR SERASONA SCORE" })).toHaveTextContent("45");
    expect(screen.getAllByRole("link", { name: "Record my voice" })[0]).toHaveAttribute("href", "/checkin");
    expect(screen.getAllByRole("link", { name: "Phone check-in" })[0]).toHaveAttribute("href", "/checkin/phone?mode=phone");
    expect(screen.getByRole("heading", { name: "YOUR SERASONA SCORE" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Explore Mouth/ }));
    expect(screen.getByText("Mouth signals")).toBeInTheDocument();
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
  it("keeps the requested sample chart separate from saved readings", () => {
    mocks.sessions = [saved]; open();
    expect(screen.getByText("SAMPLE DATA · 10 MEASUREMENTS")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "My results" }));
    expect(screen.getByText("YOUR SAVED RESULTS · LAST 10")).toBeInTheDocument();
    expect(screen.queryByText("SAMPLE DATA · 10 MEASUREMENTS")).not.toBeInTheDocument();
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
