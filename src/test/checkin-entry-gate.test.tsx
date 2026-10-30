import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Checkin from "@/pages/Checkin";

const state = vi.hoisted(() => ({ uid: "free-user", unlimited: false, loading: false, error: null as string | null, sessions: [] as unknown[], mounts: vi.fn(), unmounts: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: state.uid ? { uid: state.uid } : null, isEntitled: () => state.unlimited }) }));
vi.mock("@/hooks/use-voice-history", () => ({ useVoiceHistory: () => ({ ...state, refresh: () => {} }) }));
vi.mock("@/pages/Index", () => ({ default: () => {
  useEffect(() => { state.mounts(); return state.unmounts; }, []);
  return <h1>Active recording and analysis</h1>;
} }));
const routes = () => <MemoryRouter initialEntries={["/checkin"]}><Routes><Route path="/checkin" element={<Checkin />} /><Route path="/pricing" element={<h1>Plans</h1>} /><Route path="/login" element={<h1>Sign in</h1>} /></Routes></MemoryRouter>;
/** Three check-ins captured just now, i.e. today's free allowance, used up. */
const usedUpToday = () => Array.from({ length: 3 }, () => ({ capturedAt: Date.now() }));
beforeEach(() => { state.uid = "free-user"; state.unlimited = false; state.loading = false; state.error = null; state.sessions = []; state.mounts.mockClear(); state.unmounts.mockClear(); });
afterEach(cleanup);

describe("check-in admission is an entry check", () => {
  it("keeps the same capture mounted while result-triggered history reloads, fails or exhausts today's free check-ins", () => {
    const view = render(routes());
    expect(state.mounts).toHaveBeenCalledTimes(1);
    state.loading = true; view.rerender(routes());
    expect(screen.getByRole("heading", { name: "Active recording and analysis" })).toBeInTheDocument();
    state.loading = false; state.error = "History unavailable"; view.rerender(routes());
    expect(screen.getByRole("heading", { name: "Active recording and analysis" })).toBeInTheDocument();
    state.error = null; state.sessions = usedUpToday(); view.rerender(routes());
    expect(screen.queryByRole("heading", { name: "Plans" })).not.toBeInTheDocument();
    expect(state.mounts).toHaveBeenCalledTimes(1);
    expect(state.unmounts).not.toHaveBeenCalled();
  });
  it("still rejects a new free visit after today's three readings were saved", () => {
    render(routes());
    cleanup(); state.sessions = usedUpToday(); render(routes());
    expect(screen.getByRole("heading", { name: "Plans" })).toBeInTheDocument();
    expect(state.mounts).toHaveBeenCalledTimes(1);
  });
  it("does not admit an unchecked or errored account", () => {
    state.loading = true;
    const view = render(routes());
    expect(state.mounts).not.toHaveBeenCalled();
    state.loading = false; state.error = "History unavailable"; view.rerender(routes());
    expect(screen.getByRole("alert")).toHaveTextContent("History unavailable");
    expect(state.mounts).not.toHaveBeenCalled();
  });
  it("never carries admission to another account", () => {
    const view = render(routes());
    expect(state.mounts).toHaveBeenCalledTimes(1);
    state.uid = "another-user"; state.loading = true; view.rerender(routes());
    expect(screen.queryByRole("heading", { name: "Active recording and analysis" })).not.toBeInTheDocument();
    state.loading = false; state.sessions = usedUpToday(); view.rerender(routes());
    expect(screen.getByRole("heading", { name: "Plans" })).toBeInTheDocument();
  });
});
