import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
const logIn = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ logIn, user: null, subscription: { planId: "free" } }) }));
import Login from "@/pages/Login";
describe("member login destination", () => {
  it("always lands on the live dashboard, including an older account redirect", async () => {
    cleanup();
    render(<MemoryRouter initialEntries={[{ pathname: "/login", search: "?next=/checkin", state: { from: "/account" } }]}><Routes><Route path="/login" element={<Login />} /><Route path="/dashboard" element={<h1>Live member dashboard</h1>} /></Routes></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "member@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-only-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("heading", { name: "Live member dashboard" })).toBeInTheDocument();
    expect(logIn).toHaveBeenCalledWith("member@example.invalid", "test-only-password");
  });
});
