import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Index from "@/pages/Index";
const state = vi.hoisted(() => ({ pathway: "WELLNESS", isFastTrack: false, setPathway: vi.fn(), setUserProfile: vi.fn(), reset: vi.fn(), setApiStatus: vi.fn(), setApiResult: vi.fn(), apiStatus: null, visualizedResult: null, selectedArchetype: null, setSelectedArchetype: vi.fn() }));
vi.mock("@/context/AssessmentContext", () => ({ useAssessment: () => state, HEALTH_FOCUS_TO_PATHWAY: {} }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "member" } }) }));
vi.mock("@/lib/firebase", () => ({ isFirebaseConfigured: true }));
vi.mock("@/components/NavigationOverlay", () => ({ NavigationOverlay: () => null }));
vi.mock("@/components/QuestionFlowVisualizer", () => ({ QuestionFlowVisualizer: ({ onComplete }) => <button onClick={onComplete}>Finish recording</button> }));
vi.mock("@/components/AnalysisAnimation", () => ({ AnalysisAnimation: ({ onComplete, onFailed }) => <><button onClick={() => onComplete({ id: "analyzed" })}>Analysis complete</button><button onClick={onFailed}>Analysis failed</button></> }));
vi.mock("@/components/HealthProfile", () => ({ HealthProfile: () => <h1>Separate results screen</h1> }));
vi.mock("@/pages/AnalysisFailed", () => ({ AnalysisFailed: () => <h1>Retry analysis</h1> }));
describe("member check-in completion", () => {
  it("keeps recording and analysis in the flow, then replaces it with the dashboard", () => {
    render(<MemoryRouter initialEntries={["/checkin"]}><Routes><Route path="/checkin" element={<Index initialState="capture" presetPathway="WELLNESS" exitTo="/dashboard" />} /><Route path="/dashboard" element={<h1>Member dashboard</h1>} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Finish recording" }));
    expect(screen.queryByRole("heading", { name: "Member dashboard" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Analysis complete" }));
    expect(screen.getByRole("heading", { name: "Member dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Separate results screen" })).not.toBeInTheDocument();
  });
});
