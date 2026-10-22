// Per-IP limits for every public entry point, enforced by
// lib/server-rate-limit.ts.
//
// "closed" policies reject requests when the limiter's database is unavailable.

export type RateLimitRule = {
  limit: number;
  windowSeconds: number;
};

export type RateLimitPolicy = {
  failMode: "open" | "closed";
  rules: readonly RateLimitRule[];
};

const MINUTE = 60;
const DAY = 24 * 60 * 60;

export const RATE_LIMITS = {
  // POST /api/summarize (paid). One PDF makes one request per chunk plus a
  // final quick-summary request.
  summarize: {
    failMode: "closed",
    rules: [
      { limit: 60, windowSeconds: MINUTE },
      { limit: 600, windowSeconds: DAY },
    ],
  },
  // POST /api/image (paid: text model + image model + S3 write)
  image: {
    failMode: "closed",
    rules: [
      { limit: 5, windowSeconds: MINUTE },
      { limit: 30, windowSeconds: DAY },
    ],
  },
  // POST /api/s3-upload (presigned PDF upload)
  pdfUpload: {
    failMode: "closed",
    rules: [
      { limit: 10, windowSeconds: MINUTE },
      { limit: 50, windowSeconds: DAY },
    ],
  },
  // sharePdf server action (database write)
  sharePdf: {
    failMode: "closed",
    rules: [
      { limit: 10, windowSeconds: MINUTE },
      { limit: 50, windowSeconds: DAY },
    ],
  },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

// Rows older than this are deleted opportunistically.
export const RATE_LIMIT_RETENTION_SECONDS = 2 * DAY;
