import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AssessmentProvider, useAssessment } from "@/context/AssessmentContext";
import Index from "@/pages/Index";
import Dashboard from "@/pages/Dashboard";
import { computeSerasonaScore } from "@/lib/serasona-score";
const api = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn(), token: vi.fn().mockResolvedValue("test-token") }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "test-member", displayName: "Test", getIdToken: api.token }, subscription: { planId: "executive", status: "active" }, isEntitled: () => true }) }));
vi.mock("@/lib/firebase", () => ({ isFirebaseConfigured: true, db: null, auth: null }));
vi.mock("@/lib/voice-history-client", async (original) => ({ ...await original(), fetchHistory: api.fetch, saveSession: api.save }));
vi.mock("@/components/NavigationOverlay", () => ({ NavigationOverlay: () => null }));
vi.mock("@/components/member/VoiceSculpture", () => ({ VoiceSculpture: () => null, VoiceWave: () => null }));
vi.mock("@/lib/leadgen-api-client", () => ({ leadgenRootHealthCheck: async () => true, leadgenWellnessAnalyzeAudioSync: vi.fn(async () => response) }));
vi.mock("@/lib/audio-utils", () => ({ decodeBlobToAudioBuffer: async () => ({}), mergeAudioBuffers: () => ({}), convertAudioBufferToBlob: async () => ({ blob: new Blob(["test audio"]), format: "wav", extension: "wav", mimeType: "audio/wav" }) }));
vi.mock("@/components/SpeakerFigure", () => ({ SpeakerFigure: () => null }));
vi.mock("@/components/AnalysisAnimation", () => ({ AnalysisAnimation: ({ onComplete }) => {
  const { apiStatus } = useAssessment();
  return <button disabled={apiStatus !== "done"} onClick={() => onComplete({ id: "result" })}>Finish analysis</button>;
} }));
import response from "./fixtures-v2-pulse-response.json";
class Recorder {
 static isTypeSupported() { return true; }
 state = "inactive"; mimeType = "audio/webm;codecs=opus"; ondataavailable: any; onstop: any;
 start() { this.state = "recording"; }
 stop() { this.state = "inactive"; this.ondataavailable?.({data:new Blob(["test segment"])}); queueMicrotask(() => this.onstop?.()); }
}
class TestAudioContext {
 state = "running"; destination = {}; close = async () => {}; resume = async () => {};
 createMediaStreamSource() { return {connect() {}}; }
 createGain() { return {gain:{value:0}, connect() {}}; }
 createAnalyser() { return {frequencyBinCount:512,fftSize:1024,connect() {},getByteFrequencyData(data) { data.fill(140); },getByteTimeDomainData(data) { data.fill(170); }}; }
}
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("completed analysis to live dashboard history", () => {
 it("awaits persistence and immediately uses the new reading in score, body regions and analysis", async () => {
  let resolveSave: (value: boolean) => void;
  let saved: any = null;
  api.fetch.mockImplementation(async () => saved ? [saved] : []);
  api.save.mockImplementation((payload) => new Promise<boolean>((resolve) => { resolveSave = (ok) => { if (ok) saved = { ...payload, sessionId: payload.jobId, capturedAt: Date.now() }; resolve(ok); }; }));
  vi.useFakeTimers({shouldAdvanceTime:true});
  vi.stubGlobal("MediaRecorder", Recorder); vi.stubGlobal("AudioContext", TestAudioContext);
  const track = { muted:false, getSettings: () => ({sampleRate:48000}), stop: vi.fn() };
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn(async () => ({getAudioTracks:() => [track],getTracks:() => [track]}))}});
  render(<MemoryRouter initialEntries={["/checkin"]}><AssessmentProvider><Routes><Route path="/checkin" element={<Index initialState="capture" presetPathway="WELLNESS" exitTo="/dashboard" />} /><Route path="/dashboard" element={<Dashboard />} /></Routes></AssessmentProvider></MemoryRouter>);
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  for (let question=0;question<2;question++) {
    fireEvent.click(screen.getByRole("button", { name: /^START$/ }));
    for (let second=0;second<21;second++) await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  }
  expect(screen.getByRole("button", { name: "Finish analysis" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Finish analysis" }));
  vi.useRealTimers();
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
  expect(api.save.mock.calls[0][0]).toMatchObject({source:"browser",model:"pulse",pathway:"WELLNESS"});
  expect(api.fetch).toHaveBeenCalledTimes(1);
  resolveSave!(true);
  await waitFor(() => expect(screen.getAllByRole("group").length).toBeGreaterThanOrEqual(6));
  const score = computeSerasonaScore(saved.signals)!.score;
  expect(screen.getByRole("button", { name: new RegExp(`Review latest.*score ${score}`) })).toBeInTheDocument();
  for (const label of ["Neurocognitive", "Cardiorespiratory", "Core"]) expect(screen.getByRole("button", { name: new RegExp(`Explore ${label}`) })).toBeInTheDocument();

  expect(api.fetch).toHaveBeenCalledTimes(2);
  expect(within(screen.getByRole("table", { name: "Your saved readings · Last 3 measurements" })).getAllByText(String(score)).length).toBeGreaterThan(0);
 });
});
