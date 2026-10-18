import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
const { logIn, redirect, signedIn } = vi.hoisted(() => ({ logIn: vi.fn().mockResolvedValue(undefined), redirect: vi.fn(), signedIn: { value: false } }));
vi.mock("@/lib/member-navigation", () => ({ redirectToMemberDashboard: redirect }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ logIn, user: signedIn.value ? { uid: "member" } : null, subscription: { planId: "free" } }) }));
import Login from "@/pages/Login";
describe("member login destination", () => {
  it("always lands on the live dashboard, including an older account redirect", async () => {
    cleanup();
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
