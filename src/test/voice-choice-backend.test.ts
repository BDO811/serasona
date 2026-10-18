import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
function setup() {
  const docs = new Map<string, any>(); const fetch = vi.fn();
  const collection = (name: string) => ({ doc: (id: string) => ({ get: async () => ({ data: () => docs.get(`${name}/${id}`) }), set: async (data: any) => docs.set(`${name}/${id}`, { ...docs.get(`${name}/${id}`), ...data }) }) });
  const firestore = Object.assign(() => ({ collection }), { FieldValue: { serverTimestamp: () => 1 } });
  const sandbox = vm.createContext({ exports: {}, console, fetch, Buffer, Blob, FormData, process: { env: { TELNYX_API_KEY: "test" } }, AbortSignal: { timeout: () => undefined }, require: () => ({ apps: [1], firestore, auth: () => ({ verifyIdToken: async (token: string) => { if (token === "invalid") throw new Error(); return { uid: token }; } }) }) });
  vm.runInContext(readFileSync('gcp-functions/clone-voice/index.js','utf8'),sandbox);
  async function run(body: any, token?: string) { let status=200,data; const res:any={set(){},status(n){status=n;return res},json(d){data=d;return res},send(){}}; await sandbox.exports.cloneVoice({method:'POST',headers:{authorization: token ? `Bearer ${token}` : ''},body},res); return {status,data}; }
  const plus = (uid: string) => docs.set(`users/${uid}`, { subscription:{planId:'plus',status:'active'} });
  return {run,plus,docs,fetch};
}
describe('private calling voice preferences',()=>{
  it('requires auth and an active phone plan',async()=>{const s=setup(); expect((await s.run({action:'selectVoice',selection:'male'})).status).toBe(401);expect((await s.run({action:'selectVoice',selection:'male'},'free')).status).toBe(403);expect(s.docs.size).toBe(0)});
  it('writes only the verified users preference and preserves their clone',async()=>{const s=setup();s.plus('a');s.docs.set('voiceClones/a',{status:'ready',providerVoiceId:'existing'});expect((await s.run({action:'selectVoice',selection:'male',uid:'other',providerVoiceId:'injected'},'a')).status).toBe(200);expect(s.docs.get('voiceClones/a')).toMatchObject({selection:'male',providerVoiceId:'existing'});expect(s.docs.has('voiceClones/other')).toBe(false)});
  it('rejects unknown choices and an unready personal voice',async()=>{const s=setup();s.plus('a');expect((await s.run({action:'selectVoice',selection:'bad'},'a')).status).toBe(400);expect((await s.run({action:'selectVoice',selection:'own'},'a')).status).toBe(409);expect(s.fetch).not.toHaveBeenCalled()});
  it('requires explicit cloning consent before submitting audio',async()=>{const s=setup();s.plus('a');expect((await s.run({audioBase64:'some-audio',gender:'female'},'a')).status).toBe(400);expect(s.fetch).not.toHaveBeenCalled()});
  it('recovers a pending personal recording without changing a chosen library voice',async()=>{const s=setup();s.plus('a');s.docs.set('voiceClones/a',{selection:'male',status:'pending',telnyxCloneId:'c1'});s.fetch.mockResolvedValue({ok:true,json:async()=>({data:[{id:'c1',status:'active',provider:'Telnyx',model_id:'Ultra',provider_voice_id:'ready-id'}]})});expect((await s.run({action:'refreshVoice'},'a')).status).toBe(200);expect(s.docs.get('voiceClones/a')).toMatchObject({selection:'male',status:'ready',providerVoiceId:'Telnyx.Ultra.ready-id'})});
});

function recording(seconds = 60, amplitude = .1) {
  const rate = 24000, bytes = seconds * rate * 2, wav = Buffer.alloc(44 + bytes);
  wav.write('RIFF'); wav.writeUInt32LE(36 + bytes,4); wav.write('WAVE',8); wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(bytes,40);
  for(let i=0;i<bytes/2;i++) wav.writeInt16LE(Math.round(Math.sin(i*.1)*amplitude*32767),44+i*2);
  return wav.toString('base64');
}
describe('Minimax personal voice through Telnyx',()=>{
  it('sends validated audio to Minimax without an Ultra model override and saves the real compound ID',async()=>{const s=setup();s.plus('a');s.fetch.mockResolvedValue({ok:true,json:async()=>({data:{id:'clone1',provider:'Minimax',model_id:'speech-2.8-turbo',provider_voice_id:'real-id',status:'active'}})});const result=await s.run({audioBase64:recording(),gender:'female',consent:true},'a');expect(result.status).toBe(200);const form=s.fetch.mock.calls[0][1].body as FormData;expect(form.get('provider')).toBe('minimax');expect(form.get('model_id')).toBeNull();expect(form.get('gender')).toBe('female');expect(form.get('audio_file')).toBeInstanceOf(Blob);expect(s.docs.get('voiceClones/a')).toMatchObject({providerVoiceId:'Minimax.speech-2.8-turbo.real-id',status:'ready',selection:'own'});});
  it('rejects too-short or silent audio before any provider request',async()=>{const s=setup();s.plus('a');expect((await s.run({audioBase64:recording(2),gender:'male',consent:true},'a')).status).toBe(400);expect((await s.run({audioBase64:recording(60,0),gender:'male',consent:true},'a')).status).toBe(400);expect(s.fetch).not.toHaveBeenCalled()});
  it('does not activate an expired provider result',async()=>{const s=setup();s.plus('a');s.fetch.mockResolvedValue({ok:true,json:async()=>({data:{id:'bad',provider:'Minimax',model_id:'speech-2.8-turbo',provider_voice_id:'expired',status:'expired'}})});const result=await s.run({audioBase64:recording(),gender:'male',consent:true},'a');expect(result.data.status).toBe('failed');expect(s.docs.get('voiceClones/a').selection).not.toBe('own')});
});
