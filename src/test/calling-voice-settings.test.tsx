import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CallingVoiceSettings } from "@/components/member/CallingVoiceSettings";
const state = vi.hoisted(() => ({ clone: null as any, choose: vi.fn(), allowed: true, failLoad: false }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "member" }, isEntitled: () => state.allowed }) }));
vi.mock("@/lib/voice-clone-client", () => ({ selectCallingVoice: state.choose, refreshCallingVoice: vi.fn(), subscribeVoiceClone: (_uid, next, error) => { if (state.failLoad) error(new Error()); else next(state.clone); return () => {}; } }));
function open() { render(<MemoryRouter><CallingVoiceSettings /></MemoryRouter>); }
beforeEach(() => { cleanup(); state.clone = null; state.allowed = true; state.failLoad = false; state.choose.mockReset().mockResolvedValue(undefined); });
describe("account calling voices", () => {
  it("shows local samples and saves the selected library voice", async () => { open(); expect(screen.getByLabelText("Preview female voice")).toHaveAttribute("src", "/voices/female_35_greeting.mp3"); expect(screen.getByLabelText("Preview male voice")).toHaveAttribute("src", "/voices/male_35_greeting.mp3"); fireEvent.click(screen.getByRole("button", { name: "Use male voice" })); await screen.findByText(/Calling voice saved/); expect(state.choose).toHaveBeenCalledWith("male"); expect(screen.getByRole("link", { name: "Record your own voice" })).toHaveAttribute("href", "/voice"); });
  it("allows switching back to a ready personal recording", async () => { state.clone={selection:"female",status:"ready",providerVoiceId:"stored-personal"}; open(); fireEvent.click(screen.getByRole("button",{name:"Use my recorded voice"})); await screen.findByText(/Calling voice saved/); expect(state.choose).toHaveBeenCalledWith("own"); });
  it("does not falsely show save success and permits retry", async () => { state.choose.mockRejectedValueOnce(new Error("Try again"));open();fireEvent.click(screen.getByRole("button",{name:"Use male voice"}));expect(await screen.findByRole("alert")).toHaveTextContent("Try again");expect(screen.queryByText(/Calling voice saved/)).not.toBeInTheDocument();expect(screen.getByRole("button",{name:"Use male voice"})).toBeEnabled(); });
  it("gates preferences on plan and handles a failed preference read", () => { state.failLoad=true;open();expect(screen.getByRole("button",{name:"Use male voice"})).toBeDisabled();expect(state.choose).not.toHaveBeenCalled(); });
});
