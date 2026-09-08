import { assertSameOrigin } from "@/lib/api";
import { assertStorageSafeForRuntime } from "@/lib/env";

describe("assertSameOrigin — CSRF defence for state-changing routes", () => {
  const base = "http://localhost:3000";

  it("allows requests with no Origin header (server-to-server / curl)", () => {
    const req = new Request(`${base}/api/records`, { method: "POST" });
    expect(assertSameOrigin(req)).toBeNull();
  });

  it("allows a same-origin browser request", () => {
    const req = new Request(`${base}/api/records`, {
      method: "POST",
      headers: { origin: base, host: "localhost:3000" },
    });
    expect(assertSameOrigin(req)).toBeNull();
  });

  it("rejects a cross-origin browser request", async () => {
    const req = new Request(`${base}/api/records`, {
      method: "POST",
      headers: { origin: "https://evil.example", host: "localhost:3000" },
    });
    const res = assertSameOrigin(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });
});

describe("assertStorageSafeForRuntime", () => {
  it("does not throw under the test runtime (NODE_ENV=test, local storage)", () => {
    // env.isProduction is fixed at import; in jest it is false, so local
    // storage is permitted. The production-throw path is covered by the
    // production smoke test / manual review.
    expect(() => assertStorageSafeForRuntime()).not.toThrow();
  });
});
