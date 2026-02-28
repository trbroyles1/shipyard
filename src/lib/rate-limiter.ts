import { createLogger } from "./logger";

const log = createLogger("rate-limiter");

const MAX_TOKENS = 2000;
const REFILL_INTERVAL_MS = 60_000; // 1 minute
const WARN_THRESHOLD = 0.8;

let tokens = MAX_TOKENS;
let lastRefill = Date.now();

function refill() {
  const now = Date.now();
  const elapsed = now - lastRefill;
  const refillAmount = (elapsed / REFILL_INTERVAL_MS) * MAX_TOKENS;
  tokens = Math.min(MAX_TOKENS, tokens + refillAmount);
  lastRefill = now;
}

export async function acquire(): Promise<void> {
  refill();

  if (tokens < 1) {
    const waitMs = ((1 - tokens) / MAX_TOKENS) * REFILL_INTERVAL_MS;
    log.warn(`Rate limit exhausted, waiting ${Math.ceil(waitMs)}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    refill();
  }

  const utilization = 1 - tokens / MAX_TOKENS;
  if (utilization >= WARN_THRESHOLD) {
    log.warn(`Rate limiter at ${Math.round(utilization * 100)}% utilization (${Math.floor(tokens)} tokens remaining)`);
  }

  tokens -= 1;
}

export function remainingTokens(): number {
  refill();
  return Math.floor(tokens);
}
