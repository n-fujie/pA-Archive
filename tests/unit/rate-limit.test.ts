import { rateLimit, clientIpFrom } from "@/lib/rate-limit";

describe("rateLimit — fixed window", () => {
  const preset = { name: `test-${Math.random()}`, limit: 3, windowSeconds: 60 };

  it("allows up to the limit then blocks", () => {
    const id = "1.2.3.4";
    expect(rateLimit(id, preset).ok).toBe(true);
    expect(rateLimit(id, preset).ok).toBe(true);
    expect(rateLimit(id, preset).ok).toBe(true);
    const blocked = rateLimit(id, preset);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks identifiers independently", () => {
    const p = { name: `iso-${Math.random()}`, limit: 1, windowSeconds: 60 };
    expect(rateLimit("a", p).ok).toBe(true);
    expect(rateLimit("a", p).ok).toBe(false);
    expect(rateLimit("b", p).ok).toBe(true);
  });

  it("reports decreasing remaining allowance", () => {
    const p = { name: `rem-${Math.random()}`, limit: 5, windowSeconds: 60 };
    expect(rateLimit("x", p).remaining).toBe(4);
    expect(rateLimit("x", p).remaining).toBe(3);
  });
});

describe("clientIpFrom", () => {
  it("prefers the first x-forwarded-for entry", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
    expect(clientIpFrom(h)).toBe("203.0.113.9");
  });
  it("falls back to x-real-ip then unknown", () => {
    expect(clientIpFrom(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIpFrom(new Headers())).toBe("unknown");
  });
});
