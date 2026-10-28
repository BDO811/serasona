import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
const { logIn, redirect, signedIn } = vi.hoisted(() => ({ logIn: vi.fn().mockResolvedValue(undefined), redirect: vi.fn(), signedIn: { value: false } }));
vi.mock("@/lib/member-navigation", () => ({ redirectToMemberDashboard: redirect }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ logIn, user: signedIn.value ? { uid: "member" } : null, subscription: { planId: "free" } }) }));
import Login from "@/pages/Login";
describe("member login destination", () => {
  it.each([
    ["auth/user-not-found", "That account doesn't exist."],
    ["auth/invalid-credential", "We couldn't find an account matching those details."],
    ["auth/invalid-login-credentials", "We couldn't find an account matching those details."],
  ])("explains %s and gives a working signup link", async (code, message) => {
    cleanup(); signedIn.value = false; redirect.mockClear();
    logIn.mockRejectedValueOnce({ code });
    render(<MemoryRouter initialEntries={["/login?next=/checkin"]}><Routes><Route path="/login" element={<Login />} /><Route path="/signup" element={<h1>Create your account</h1>} /></Routes></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-only-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(message);
    const signup = within(alert).getByRole("link", { name: "Sign up for a new account" });
    expect(signup).toHaveAttribute("href", "/signup?next=%2Fcheckin");
    expect(redirect).not.toHaveBeenCalled();
    fireEvent.click(signup);
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
  });
  it("does not call an existing account missing when only the password is wrong", async () => {
    cleanup(); signedIn.value = false; logIn.mockRejectedValueOnce({ code: "auth/wrong-password" });
    render(<MemoryRouter><Login /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "member@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That password didn't match.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("account doesn't exist");
  });
  it.each([{ search: "?next=/admin" }, { state: { from: "/admin/" } }])("returns administrator login to admin: %j", async (destination) => {
    cleanup(); redirect.mockClear(); signedIn.value = false;
    render(<MemoryRouter initialEntries={[{ pathname: "/login", ...destination }]}><Routes><Route path="/login" element={<Login />} /><Route path="/admin" element={<h1>Administration</h1>} /></Routes></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-only-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await screen.findByRole("heading", { name: "Administration" });
    expect(redirect).not.toHaveBeenCalled();
  });
  it("always lands on the live dashboard, including an older account redirect", async () => {
    cleanup(); redirect.mockClear();
    render(<MemoryRouter initialEntries={[{ pathname: "/login", search: "?next=/checkin", state: { from: "/account" } }]}><Routes><Route path="/login" element={<Login />} /><Route path="/dashboard" element={<h1>Live member dashboard</h1>} /></Routes></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "member@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-only-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(redirect).toHaveBeenCalledTimes(1));
    expect(logIn).toHaveBeenCalledWith("member@example.invalid", "test-only-password");
  });
  it("reloads the dashboard when an authenticated member opens login", async () => {
    cleanup(); redirect.mockClear(); signedIn.value = true;
    render(<MemoryRouter><Login /></MemoryRouter>);
    await waitFor(() => expect(redirect).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent("Opening your dashboard");
    signedIn.value = false;
  });

});
