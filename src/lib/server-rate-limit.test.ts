import { describe, expect, it, vi } from "vitest";
import { RATE_LIMITS } from "@/lib/rate-limit-config";
import {
  checkRateLimit,
  enforceRateLimit,
  getClientIp,
  normalizeIp,
  type RateLimitStore,
} from "@/lib/server-rate-limit";

vi.mock("@/lib/prisma", () => ({ default: {} }));

function memoryStore(): RateLimitStore {
  const counts = new Map<string, number>();
  const windows = new Map<string, number>();
  return {
    async increment(key, windowStart) {
      const start = windowStart.getTime();
      const current = windows.get(key);
      const count =
        current !== undefined && current >= start
          ? (counts.get(key) ?? 0) + 1
          : 1;
      counts.set(key, count);
      windows.set(key, Math.max(current ?? start, start));
      return count;
    },
    async deleteExpired() {},
  };
}

const noCleanup = () => 1;

describe("checkRateLimit", () => {
  it("allows requests up to the per-minute limit and rejects the next one", async () => {
    const store = memoryStore();
    const now = new Date("2026-10-22T12:00:10Z");
    const { limit } = RATE_LIMITS.image.rules[0];

    for (let i = 0; i < limit; i++) {
      await expect(
        checkRateLimit("image", "1.2.3.4", { now, store, random: noCleanup }),
      ).resolves.toEqual({ ok: true });
    }

    await expect(
      checkRateLimit("image", "1.2.3.4", { now, store, random: noCleanup }),
    ).resolves.toEqual({ ok: false, reason: "limited", retryAfterSeconds: 50 });
    await expect(
      checkRateLimit("image", "5.6.7.8", { now, store, random: noCleanup }),
    ).resolves.toEqual({ ok: true });
  });

  it("resets the counter in a new window", async () => {
    const store = memoryStore();
    const { limit } = RATE_LIMITS.image.rules[0];
    const first = new Date("2026-10-22T12:00:10Z");
    for (let i = 0; i <= limit; i++) {
      await checkRateLimit("image", "ip", {
        now: first,
        store,
        random: noCleanup,
      });
    }

    await expect(
      checkRateLimit("image", "ip", {
        now: new Date("2026-10-22T12:01:10Z"),
        store,
        random: noCleanup,
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("fails closed when the store errors", async () => {
    const store: RateLimitStore = {
      increment: async () => {
        throw new Error("db down");
      },
      deleteExpired: async () => {},
    };
    vi.spyOn(console, "error").mockImplementation(() => {});

    for (const bucket of Object.keys(
      RATE_LIMITS,
    ) as (keyof typeof RATE_LIMITS)[]) {
      await expect(checkRateLimit(bucket, "ip", { store })).resolves.toEqual({
        ok: false,
        reason: "unavailable",
      });
    }

    const response = await enforceRateLimit("summarize", new Headers(), {
      store,
    });
    expect(response?.status).toBe(503);
  });
});

describe("getClientIp", () => {
  it("prefers Vercel-set headers over x-forwarded-for", () => {
    const headers = new Headers({
      "x-forwarded-for": "6.6.6.6",
      "x-real-ip": "1.2.3.4",
    });
    expect(getClientIp(headers, { VERCEL: "1" })).toBe("1.2.3.4");
  });

  it("ignores x-forwarded-for on Vercel", () => {
    const headers = new Headers({ "x-forwarded-for": "6.6.6.6" });
    expect(getClientIp(headers, { VERCEL: "1" })).toBe("unknown");
  });

  it("groups IPv6 clients by /64", () => {
    expect(normalizeIp("2001:db8:1:2:3:4:5:6")).toBe("2001:db8:1:2::/64");
    expect(normalizeIp("::ffff:1.2.3.4")).toBe("1.2.3.4");
  });
});
