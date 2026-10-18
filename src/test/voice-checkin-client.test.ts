import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ currentUser: { getIdToken: vi.fn().mockResolvedValue("account-token") } as { getIdToken: () => Promise<string> } | null }));
vi.mock("@/lib/firebase", () => ({ auth: mocks }));
import { startVoiceCheckin } from "@/lib/voice-checkin-client";
beforeEach(() => { vi.restoreAllMocks(); mocks.currentUser = { getIdToken: vi.fn().mockResolvedValue("account-token") }; });
describe("live phone check-in client", () => {
  it("uses the authenticated account endpoint, with consent and normalized phone", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ sessionId: "call-id", status: "dialing" }) } as Response);
    await startVoiceCheckin("6175550123", { mode: "phone", consent: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, request] = fetch.mock.calls[0];
    expect(String(url)).toContain("/voiceHistory");
    expect(request.headers).toMatchObject({ Authorization: "Bearer account-token" });
    expect(JSON.parse(request.body as string)).toEqual({ action: "startPhone", phone: "+16175550123", consent: true });
  });
  it("surfaces denied entitlements instead of falling back to an unprotected provider call", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, json: async () => ({ error: "An active Plus plan is required." }) } as Response);
    await expect(startVoiceCheckin("6175550123", { mode: "phone", consent: true })).rejects.toThrow("An active Plus plan is required.");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("does not start a call without a signed-in identity", async () => {
    mocks.currentUser = null;
    const fetch = vi.spyOn(globalThis, "fetch");
    await expect(startVoiceCheckin("6175550123", { mode: "phone", consent: true })).rejects.toThrow("Sign in");
    expect(fetch).not.toHaveBeenCalled();
  });
});
