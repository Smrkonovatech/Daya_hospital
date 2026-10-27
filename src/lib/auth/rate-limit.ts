interface RateLimitRecord {
  count: number;
  firstAttemptAt: number;
  blockedUntil?: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const BLOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes lockout

export function checkAuthRateLimit(key: string): {
  allowed: boolean;
  remaining: number;
  retryAfterSecs: number;
} {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record) {
    return { allowed: true, remaining: MAX_FAILED_ATTEMPTS, retryAfterSecs: 0 };
  }

  // Check if blocked
  if (record.blockedUntil && record.blockedUntil > now) {
    const retryAfterSecs = Math.ceil((record.blockedUntil - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSecs };
  }

  // Check if window expired
  if (now - record.firstAttemptAt > WINDOW_MS) {
    rateLimitStore.delete(key);
    return { allowed: true, remaining: MAX_FAILED_ATTEMPTS, retryAfterSecs: 0 };
  }

  const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - record.count);
  return { allowed: remaining > 0, remaining, retryAfterSecs: 0 };
}

export function recordFailedAttempt(key: string): {
  blocked: boolean;
  retryAfterSecs: number;
} {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now - record.firstAttemptAt > WINDOW_MS) {
    rateLimitStore.set(key, { count: 1, firstAttemptAt: now });
    return { blocked: false, retryAfterSecs: 0 };
  }

  record.count += 1;
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_DURATION_MS;
    const retryAfterSecs = Math.ceil(BLOCK_DURATION_MS / 1000);
    return { blocked: true, retryAfterSecs };
  }

  return { blocked: false, retryAfterSecs: 0 };
}

export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

// For unit testing
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}
