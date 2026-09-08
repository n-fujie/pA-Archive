jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));

import { hasRole, canManageRecord } from "@/lib/auth/guards";

describe("role hierarchy", () => {
  it("hasRole respects admin > editor > reviewer > submitter > reader", () => {
    expect(hasRole("ADMIN", "EDITOR")).toBe(true);
    expect(hasRole("EDITOR", "ADMIN")).toBe(false);
    expect(hasRole("REVIEWER", "REVIEWER")).toBe(true);
    expect(hasRole("SUBMITTER", "REVIEWER")).toBe(false);
    expect(hasRole(undefined, "READER")).toBe(false);
  });

  it("canManageRecord allows the submitter or any editor+", () => {
    const owner = { id: "u1", email: "", name: null, role: "SUBMITTER" as const };
    const other = { id: "u2", email: "", name: null, role: "SUBMITTER" as const };
    const editor = { id: "u3", email: "", name: null, role: "EDITOR" as const };
    expect(canManageRecord(owner, { submitterId: "u1" })).toBe(true);
    expect(canManageRecord(other, { submitterId: "u1" })).toBe(false);
    expect(canManageRecord(editor, { submitterId: "u1" })).toBe(true);
  });
});
