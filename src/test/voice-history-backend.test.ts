import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";

function service() {
  const store = new Map<string, Record<string, any>>();
  let sequence = 0;
  function collection(name: string) {
    let filter: ((item: Record<string, any>) => boolean) | undefined, limit = Infinity;
    const query: any = {
      doc(id = `auto-${++sequence}`) {
        const key = `${name}/${id}`;
        const ref: any = {
          id,
          async get() { return { exists: store.has(key), id, data: () => store.get(key), ref }; },
          async create(value: Record<string, any>) { if (store.has(key)) throw Object.assign(new Error("exists"), { code: 6 }); store.set(key, value); },
          async update(value: Record<string, any>) { store.set(key, { ...store.get(key), ...value }); },
        };
        return ref;
      },
      where(field: string, _op: string, value: string) { filter = (item) => item[field] === value; return query; },
      limit(value: number) { limit = value; return query; },
      async get() {
        const entries = [...store].filter(([key, value]) => key.startsWith(name + "/") && (!filter || filter(value))).slice(0, limit);
        return { docs: entries.map(([key, value]) => { const id = key.slice(name.length + 1); return { id, data: () => value, ref: query.doc(id) }; }) };
      },
      count() { return { get: async () => { const snapshot = await query.get(); return { data: () => ({ count: snapshot.docs.length }) }; } }; },
    };
    return query;
  }
  const fetch = vi.fn();
  const sandbox = vm.createContext({
    exports: {}, fetch, AbortSignal: { timeout: () => undefined }, console: { log() {}, warn() {}, error() {} },
    require: (name: string) => name === "crypto" ? crypto : name === "firebase-admin" ? { apps: [1], auth: () => ({ verifyIdToken: async (token: string) => { if (token === "invalid") throw new Error("invalid"); return { uid: token }; } }) } : { Firestore: class { collection = collection; }, FieldValue: { serverTimestamp: () => Date.now() } },
  });
  vm.runInContext(readFileSync("gcp-functions/voice-history/index.js", "utf8"), sandbox);
  const run = async (body: Record<string, any>, token?: string, method = "POST") => {
    let status = 200, data: any;
    const response: any = { set() {}, status(n: number) { status = n; return response; }, json(value: any) { data = value; }, send(value: any) { data = value; } };
    await sandbox.exports.voiceHistory({ body, method, query: {}, headers: { origin: "https://www.serasona.com", ...(token ? { authorization: `Bearer ${token}` } : {}) } }, response);
    return { status, data };
  };
  const plus = (uid: string) => store.set(`users/${uid}`, { subscription: { planId: "plus", status: "active" } });
  return { store, run, fetch, plus };
}
const signal = { name: "stress", label: "Stress", score: .2, level: "low", flagged: false };
const ok = (body: any) => ({ ok: true, json: async () => body });

describe("authenticated voice history and phone recovery", () => {
  it("rejects anonymous and unpaid phone starts before contacting the provider", async () => {
    const s = service();
    expect((await s.run({ action: "startPhone", phone: "+16175550123", consent: true })).status).toBe(401);
    expect((await s.run({ action: "startPhone", phone: "+16175550123", consent: true }, "free-user")).status).toBe(403);
    s.store.set("users/late", { subscription: { planId: "executive", status: "past_due" } });
    expect((await s.run({ action: "startPhone", phone: "+16175550123", consent: true }, "late")).status).toBe(403);
    expect(s.fetch).not.toHaveBeenCalled();
  });
  it("checks consent and links the provider call to the verified user", async () => {
    const s = service(); s.plus("a");
    expect((await s.run({ action: "startPhone", phone: "+16175550123" }, "a")).status).toBe(400);
    s.fetch.mockResolvedValue(ok({ sessionId: "call_12345678", status: "dialing", provider: "provider" }));
    const response = await s.run({ action: "startPhone", phone: "+16175550123", consent: true, email: "another@example.com" }, "a");
    expect(response.status).toBe(200);
    expect([...s.store.values()].find((value) => value.phoneSessionId)?.userKey).toBe("uid:a");
    const request = JSON.parse(s.fetch.mock.calls[0][1].body);
    expect(request).toMatchObject({ phone: "+16175550123", mode: "phone", brand: "serasona", model: "haven" });
  });
  it("recovers authoritative phone results on a later visit and keeps them private", async () => {
    const s = service(); s.plus("a"); s.plus("b");
    s.fetch.mockResolvedValueOnce(ok({ sessionId: "call_12345678", status: "dialing" }));
    await s.run({ action: "startPhone", phone: "+16175550123", consent: true }, "a");
    s.fetch.mockResolvedValue(ok({ status: "complete", model: "haven", captureSampleRate: 8000, speechSeconds: 35, quality: { usable: true }, result: { result: { signals: [signal] } } }));
    const history = await s.run({}, "a", "GET");
    expect(history.status).toBe(200);
    expect(history.data.sessions).toHaveLength(1);
    expect(history.data.sessions[0]).toMatchObject({ source: "phone", model: "haven", captureSampleRate: 8000, status: "complete", signals: [signal] });
    expect((await s.run({}, "b", "GET")).data.sessions).toEqual([]);
    expect((await s.run({ action: "trackPhone", phoneSessionId: "call_12345678" }, "b")).status).toBe(403);
    expect((await s.run({}, "a", "GET")).data.sessions).toHaveLength(1);
  });
  it("makes browser retries idempotent without spending a second free check-in", async () => {
    const s = service();
    const body = { jobId: "job-one", source: "browser", model: "pulse", signals: [signal] };
    expect((await s.run(body, "free")).status).toBe(200);
    expect((await s.run(body, "free")).status).toBe(200);
    expect((await s.run({ ...body, jobId: "job-two" }, "free")).status).toBe(402);
    expect((await s.run({}, "free", "GET")).data.sessions).toHaveLength(1);
  });
  it("stores failed quality as an unscored attempt, never as a healthy reading", async () => {
    const s = service(); s.plus("a");
    s.fetch.mockResolvedValueOnce(ok({ sessionId: "call_12345678", status: "dialing" }));
    await s.run({ action: "startPhone", phone: "+16175550123", consent: true }, "a");
    s.fetch.mockResolvedValue(ok({ status: "complete", quality: { usable: false, reason: "No clear speech" }, result: { result: { signals: [signal] } } }));
    const history = await s.run({}, "a", "GET");
    expect(history.data.sessions[0]).toMatchObject({ status: "low_quality", signals: [], quality: { usable: false, reason: "No clear speech" } });
  });
});

describe("saved calling voice routing", () => {
  it("uses the server-selected MyAbuela male voice and ignores injected provider IDs", async () => {
    const s = service(); s.plus("a"); s.store.set("voiceClones/a", { selection: "male", providerVoiceId: "old-clone", status: "ready" });
    s.fetch.mockResolvedValue(ok({ sessionId: "call_male_123", status: "dialing" }));
    await s.run({ action: "startPhone", phone: "+16175550123", consent: true, voiceId: "attacker" }, "a");
    expect(JSON.parse(s.fetch.mock.calls[0][1].body).voiceId).toBe("Telnyx.Qwen3TTS.5a9bb629-f9cc-4f4f-b2ee-eb07b47d8cd9");
  });
  it("preserves an existing ready personal voice and blocks a selected unready clone", async () => {
    const s = service(); s.plus("a"); s.store.set("voiceClones/a", { providerVoiceId: "personal-ready", status: "ready" });
    s.fetch.mockResolvedValue(ok({ sessionId: "call_own_123", status: "dialing" }));
    await s.run({ action: "startPhone", phone: "+16175550123", consent: true }, "a");
    expect(JSON.parse(s.fetch.mock.calls[0][1].body).voiceId).toBe("personal-ready");
    s.store.set("voiceClones/a", { selection: "own", status: "pending" });
    expect((await s.run({ action: "startPhone", phone: "+16175550123", consent: true }, "a")).status).toBe(409);
    expect(s.fetch).toHaveBeenCalledTimes(1);
  });
  it("defaults an account without a preference to the library female voice", async () => {
    const s = service(); s.plus("a"); s.fetch.mockResolvedValue(ok({ sessionId: "call_female_123", status: "dialing" }));
    await s.run({ action: "startPhone", phone: "+16175550123", consent: true }, "a");
    expect(JSON.parse(s.fetch.mock.calls[0][1].body).voiceId).toBe("Minimax.speech-2.8-turbo.TzAbof88qTAKUpml5AfSnl8K7IX5xkk3fmrX31X2jvNAV");
  });
});
