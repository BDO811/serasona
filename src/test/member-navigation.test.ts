import { describe, it, expect } from "vitest";
import { memberDashboardPath } from "@/lib/member-navigation";
describe("fresh dashboard entry", () => {
  it("uses a fresh document URL rather than the legacy account route", () => {
    expect(memberDashboardPath("release-123")).toBe("/dashboard/?release=release-123");
  });
  it("encodes cache keys as query values", () => {
    expect(memberDashboardPath("v1&next=/account")).toBe("/dashboard/?release=v1%26next%3D%2Faccount");
  });
});
