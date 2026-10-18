import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Account from "@/pages/Account";

const mocks = vi.hoisted(() => ({ setDoc: vi.fn(), getDoc: vi.fn(), updateProfile: vi.fn(), portal: vi.fn(), checkout: vi.fn(), auth: { user: { uid: "member", email: "member@example.com", displayName: "Member Name" }, subscription: { planId: "plus", status: "active", currentPeriodEnd: null, stripeCustomerId: "cus_existing" }, subscriptionError: null, isEntitled: (plan: string) => plan !== "executive", logOut: vi.fn() } }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/lib/voice-clone-client", () => ({ subscribeVoiceClone: (_uid, next) => { next(null); return () => {}; }, selectCallingVoice: vi.fn() }));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({ doc: (_db: unknown, ...segments: string[]) => segments.join("/"), getDoc: mocks.getDoc, setDoc: mocks.setDoc, deleteField: () => "DELETE" }));
vi.mock("firebase/auth", () => ({ updateProfile: mocks.updateProfile }));
vi.mock("@/lib/billing-client", () => ({ openBillingPortal: mocks.portal, startCheckout: mocks.checkout }));
function open() { return render(<MemoryRouter><Account /></MemoryRouter>); }
beforeEach(() => { cleanup(); vi.clearAllMocks(); mocks.auth.subscription.stripeCustomerId = "cus_existing"; mocks.auth.subscription.planId = "plus"; mocks.getDoc.mockResolvedValue({ data: () => ({ fullName: "Member Name", phoneNumber: "+16175550123", biologicalSex: "female", ageRange: "30-45" }) }); mocks.setDoc.mockResolvedValue(undefined); mocks.updateProfile.mockResolvedValue(undefined); });
describe("member account", () => {
  it("loads editable profile fields and saves only the profile allowlist", async () => {
    open();
    await waitFor(() => expect(screen.getByLabelText("Full name")).toHaveValue("Member Name"));
    expect(screen.getByLabelText(/Sign-in email/)).toHaveAttribute("readonly");
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "New Name" } });
    fireEvent.click(screen.getByRole("button", { name: /Save changes/ }));
    await screen.findByText("Your account details have been saved.");
    expect(mocks.setDoc).toHaveBeenCalledWith("users/member", { fullName: "New Name", phoneNumber: "+16175550123", biologicalSex: "female", ageRange: "30-45" }, { merge: true });
    expect(mocks.updateProfile).toHaveBeenCalledWith(mocks.auth.user, { displayName: "New Name" });
  });
  it("routes existing subscribers to their portal instead of creating duplicate subscriptions", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: /Change to Executive/ }));
    await waitFor(() => expect(mocks.portal).toHaveBeenCalled());
    expect(mocks.checkout).not.toHaveBeenCalled();
  });
  it("starts checkout for a member without a billing customer", async () => {
    mocks.auth.subscription.stripeCustomerId = ""; mocks.auth.subscription.planId = "free";
    open();
    fireEvent.click(screen.getByRole("button", { name: /Choose Plus/ }));
    await waitFor(() => expect(mocks.checkout).toHaveBeenCalledWith("plus"));
    expect(mocks.portal).not.toHaveBeenCalled();
  });
  it("does not permit profile writes after loading fails", async () => {
    mocks.getDoc.mockRejectedValue(new Error("offline")); open();
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: /Save changes/ })).not.toBeInTheDocument();
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });
});
