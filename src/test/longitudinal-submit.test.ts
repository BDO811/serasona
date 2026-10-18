import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import vm from "node:vm";

function setup() {
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ job_id: "job-a" }) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: "done", result: { signals: [] } }) });
  const admin = { apps: [1], auth: () => ({ verifyIdToken: async () => ({ uid: "verified-user" }) }), firestore: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ subscription: { planId: "core" } }) }) }) }) }) };
  const busboy = () => {
    const handlers: Record<string, (...args: any[]) => void> = {};
    return { on(name: string, callback: (...args: any[]) => void) { handlers[name] = callback; }, end() {
      handlers.file("audio", { on(name: string, callback: (...args: any[]) => void) { if (name === "data") callback(Buffer.from("audio")); } }, { filename: "voice.wav", mimeType: "audio/wav" });
      handlers.finish();
    } };
  };
  const context = vm.createContext({ exports: {}, console, Buffer, Blob, FormData, fetch, setTimeout, process: { env: { AMPLIFIER_API_URL: "https://api.example", AMPLIFIER_ACCOUNT_ID: "test", AMPLIFIER_API_KEY: "test" } }, require: (name: string) => name === "busboy" ? busboy : name === "node:crypto" ? crypto : admin });
  vm.runInContext(readFileSync("gcp-functions/analyze-audio/index.js", "utf8"), context);
  return { fetch, run: context.exports.analyzeAudio };
}

describe("authenticated browser longitudinal submissions", () => {
  it("uses verified identity for the subject and retains model entitlement", async () => {
    const { fetch, run } = setup();
    let status = 200;
    const response = { set() {}, status(code: number) { status = code; return this; }, json() {}, send() {} };
    await run({ method: "POST", headers: { authorization: "Bearer token", "content-type": "multipart/form-data" }, rawBody: Buffer.from("audio"), query: { model: "apex", uid: "someone-else" } }, response);
    expect(status).toBe(200);
    const group = crypto.createHash("sha256").update("serasona:verified-user:browser").digest("hex");
    expect(fetch.mock.calls[0][0]).toBe(`https://api.example/v2/models/pulse/groups/${group}/analyze/longitudinal`);
    expect(Date.parse(fetch.mock.calls[0][1].body.get("recorded_at"))).toBeGreaterThan(0);
  });
});
