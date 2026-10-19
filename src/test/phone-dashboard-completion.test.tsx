import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CheckinByPhone from "@/pages/CheckinByPhone";
const api=vi.hoisted(() => ({start:vi.fn(),poll:vi.fn(),save:vi.fn()}));
vi.mock("@/context/AuthContext",()=>({useAuth:()=>({user:{uid:"test"},isEntitled:()=>true})}));
vi.mock("@/lib/firebase",()=>({db:null}));
vi.mock("@/lib/voice-history-client",()=>({trackPhoneSession:api.save}));
vi.mock("@/lib/voice-checkin-client",async(original)=>({...await original(),startVoiceCheckin:api.start,pollVoiceCheckin:api.poll}));
vi.mock("@/components/member/VoiceSculpture",()=>({VoiceWave:()=>null}));
afterEach(cleanup);
async function begin() {
 api.start.mockResolvedValue({sessionId:"call-test",status:"dialing"});
 api.poll.mockResolvedValue({sessionId:"call-test",status:"complete",result:null});
 render(<MemoryRouter initialEntries={["/checkin/phone"]}><Routes><Route path="/checkin/phone" element={<CheckinByPhone/>}/><Route path="/dashboard" element={<h1>Dashboard ready</h1>}/></Routes></MemoryRouter>);
 fireEvent.change(screen.getByRole("textbox",{name:"Your phone number"}),{target:{value:"2025550100"}});
 fireEvent.click(screen.getByRole("checkbox"));
 fireEvent.click(screen.getByRole("button",{name:"Call me now"}));
}
describe("phone completion routing",()=>{
 it("opens the dashboard after the call result syncs",async()=>{
  api.save.mockResolvedValue(undefined);await begin();
  await waitFor(()=>expect(screen.getByRole("heading",{name:"Dashboard ready"})).toBeInTheDocument());
 });
 it("keeps sync errors recoverable and redirects after retry succeeds",async()=>{
  api.save.mockRejectedValueOnce(new Error("Sync unavailable")).mockResolvedValue(undefined);await begin();
  await waitFor(()=>expect(screen.getByRole("alert")).toHaveTextContent("Sync unavailable"));
  expect(screen.queryByRole("heading",{name:"Dashboard ready"})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Retry history sync"}));
  await waitFor(()=>expect(screen.getByRole("heading",{name:"Dashboard ready"})).toBeInTheDocument());
 });
});
