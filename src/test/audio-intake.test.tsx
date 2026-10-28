import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AssessmentProvider, useAssessment } from "@/context/AssessmentContext";
import { QuestionFlowVisualizer } from "@/components/QuestionFlowVisualizer";
import response from "./fixtures-v2-pulse-response.json";

const mocks = vi.hoisted(() => ({ analyze: vi.fn(), encode: vi.fn(), complete: vi.fn(), loud: true, stops: vi.fn(), contextCreated: vi.fn(), contextAtStart: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/lib/firebase", () => ({ auth: null, db: null }));
vi.mock("@/components/SpeakerFigure", () => ({ SpeakerFigure: () => null }));
vi.mock("@/lib/leadgen-api-client", () => ({ leadgenRootHealthCheck: async () => true, leadgenWellnessAnalyzeAudioSync: mocks.analyze }));
vi.mock("@/lib/audio-utils", () => ({ decodeBlobToAudioBuffer: async () => ({}), mergeAudioBuffers: (buffers: unknown[]) => buffers, convertAudioBufferToBlob: mocks.encode }));

class Recorder {
  static isTypeSupported() { return true; }
  state = "inactive";
  mimeType = "audio/webm;codecs=opus";
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;
  start() { mocks.contextAtStart(mocks.contextCreated.mock.calls.length); this.state = "recording"; }
  stop() {
    this.state = "inactive";
    mocks.stops();
    this.ondataavailable?.({ data: new Blob(["recorded speech"]) });
    // Deliberately synchronous: the handler must exist before stop is called.
    this.onstop?.();
  }
}
class TestAudioContext {
  constructor() { mocks.contextCreated(); }
  state = "running";
  destination = {};
  close = async () => {};
  resume = async () => {};
  createMediaStreamSource() { return { connect() {} }; }
  createGain() { return { gain: { value: 0 }, connect() {} }; }
  createAnalyser() {
    return { frequencyBinCount: 512, fftSize: 1024, connect() {},
      getByteFrequencyData(data: Uint8Array) { data.fill(mocks.loud ? 140 : 0); },
      getByteTimeDomainData(data: Uint8Array) { data.fill(mocks.loud ? 170 : 128); } };
  }
}
function Capture() {
  const { setPathway, apiStatus } = useAssessment();
  useEffect(() => { setPathway("WELLNESS"); }, [setPathway]);
  return <><QuestionFlowVisualizer onComplete={mocks.complete} /><output data-testid="status">{apiStatus}</output></>;
}
async function mountCapture() {
  render(<MemoryRouter><AssessmentProvider><Capture /></AssessmentProvider></MemoryRouter>);
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
}
async function seconds(n: number) {
  for (let i = 0; i < n; i++) await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
}
const start = () => fireEvent.click(screen.getByRole("button", { name: /^START$/ }));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mocks.loud = true;
  mocks.analyze.mockReset().mockResolvedValue(response);
  mocks.encode.mockReset().mockResolvedValue({ blob: new Blob(["encoded audio"]), format: "wav", extension: ".wav", mimeType: "audio/wav" });
  mocks.complete.mockReset();
  mocks.stops.mockReset();
  mocks.contextCreated.mockReset();
  mocks.contextAtStart.mockReset();
  vi.stubGlobal("MediaRecorder", Recorder);
  vi.stubGlobal("AudioContext", TestAudioContext);
  const track = { muted: false, getSettings: () => ({ sampleRate: 48000 }), stop: vi.fn() };
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getAudioTracks: () => [track], getTracks: () => [track] })) } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("audio intake from the working Amplifier workflow", () => {
  it("submits one sufficient take and advances to analysis without a second question", async () => {
    await mountCapture();
    start();
    await seconds(21);
    expect(mocks.stops).toHaveBeenCalledTimes(1);
    expect(mocks.contextAtStart).toHaveBeenCalledWith(1);
    expect(mocks.encode.mock.calls[0][0]).toHaveLength(1);
    expect(mocks.analyze).toHaveBeenCalledTimes(1);
    expect(mocks.analyze.mock.calls[0][0]).toMatchObject({ model: "pulse", format: "wav", mimeType: "audio/wav" });
    expect(screen.getByTestId("status")).toHaveTextContent("done");
    expect(mocks.complete).toHaveBeenCalledTimes(1);
  });
  it("asks a second question for a shorter first take and submits both together", async () => {
    await mountCapture();
    start();
    await seconds(12);
    fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(mocks.analyze).not.toHaveBeenCalled();
    start();
    await seconds(21);
    expect(mocks.encode.mock.calls[0][0]).toHaveLength(2);
    expect(mocks.analyze).toHaveBeenCalledTimes(1);
    expect(mocks.complete).toHaveBeenCalledTimes(1);
  });
  it("re-asks a silent take without submitting it", async () => {
    mocks.loud = false;
    await mountCapture();
    start();
    await seconds(21);
    expect(mocks.analyze).not.toHaveBeenCalled();
    expect(mocks.encode).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^START$/ })).toBeEnabled();
    expect(screen.getByText(/No sound is reaching/)).toBeInTheDocument();
  });
  it("reports encoding failures instead of leaving a completed capture stuck", async () => {
    mocks.encode.mockRejectedValue(new Error("encoding failed"));
    await mountCapture();
    start();
    await seconds(21);
    expect(mocks.analyze).not.toHaveBeenCalled();
    expect(screen.getByTestId("status")).toHaveTextContent("failed");
  });
});
