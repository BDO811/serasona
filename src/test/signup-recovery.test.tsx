import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
const mocks = vi.hoisted(() => ({ create: vi.fn(), login: vi.fn(), getDoc: vi.fn(), setDoc: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/firebase", () => ({ auth: {}, db: {}, isFirebaseConfigured: true }));
vi.mock("firebase/auth", () => ({ createUserWithEmailAndPassword: mocks.create, signInWithEmailAndPassword: mocks.login, updateProfile: mocks.update, onAuthStateChanged: () => () => {}, signOut: vi.fn(), sendPasswordResetEmail: vi.fn() }));
vi.mock("firebase/firestore", () => ({ doc: (_db: unknown, ...parts: string[]) => parts.join("/"), getDoc: mocks.getDoc, setDoc: mocks.setDoc, serverTimestamp: () => "timestamp", onSnapshot: () => () => {} }));
const consent = { termsAcceptedAt: "now", biometricConsentAt: "now", consentPolicyVersion: "current" };
const credential = { user: { uid: "signup-member" } };
const duplicate = { code: "auth/email-already-in-use" };
beforeEach(() => { cleanup(); vi.resetAllMocks(); mocks.create.mockResolvedValue(credential); mocks.login.mockResolvedValue(credential); mocks.update.mockResolvedValue(undefined); mocks.setDoc.mockResolvedValue(undefined); });
function open() { return renderHook(() => useAuth(), { wrapper: AuthProvider }); }
describe("signup recovery", () => {
  it("trims fields and saves consent without client entitlements", async () => {
    const { result } = open();
    await act(() => result.current.signUp(" member@example.com ", "password", " Member ", consent));
    expect(mocks.create).toHaveBeenCalledWith({}, "member@example.com", "password");
    expect(mocks.setDoc).toHaveBeenCalledWith("users/signup-member", { email: "member@example.com", fullName: "Member", createdAt: "timestamp", ...consent });
  });
  it("retries an interrupted profile save only after proving account ownership", async () => {
    mocks.create.mockRejectedValue(duplicate); mocks.getDoc.mockResolvedValue({ exists: () => false });
    const { result } = open();
    await act(() => result.current.signUp("member@example.com", "password", "Member", consent));
    expect(mocks.login).toHaveBeenCalledWith({}, "member@example.com", "password");
    expect(mocks.setDoc).toHaveBeenCalledTimes(1);
  });
  it("preserves an existing member's consent and subscription", async () => {
    mocks.create.mockRejectedValue(duplicate); mocks.getDoc.mockResolvedValue({ exists: () => true });
    const { result } = open();
    await act(() => result.current.signUp("member@example.com", "password", "Member", consent));
    expect(mocks.setDoc).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("never reads or writes a profile when the password is wrong", async () => {
    mocks.create.mockRejectedValue(duplicate); mocks.login.mockRejectedValue({ code: "auth/invalid-credential" });
    const { result } = open();
    await expect(result.current.signUp("member@example.com", "wrong", "Member", consent)).rejects.toBe(duplicate);
    expect(mocks.getDoc).not.toHaveBeenCalled(); expect(mocks.setDoc).not.toHaveBeenCalled();
  });
});
