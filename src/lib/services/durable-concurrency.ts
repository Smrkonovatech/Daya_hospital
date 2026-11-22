/**
 * ============================================================================
 * SMRKOMED DURABLE CONCURRENCY & IDEMPOTENCY ENGINE
 * ============================================================================
 *
 * Distributed idempotency reservation and durable token-bucket rate limiting
 * backed by PostgreSQL (Prisma) with sub-millisecond in-memory cache fallback.
 *
 * Prevents race conditions and duplicate Exotel API calls across multiple
 * serverless Next.js instances and persistent gateway containers.
 */

import { prisma, checkDatabaseConnection } from "@/lib/db/prisma";

export interface ReservationResult {
  isFirstAcquisition: boolean;
  status: "PENDING" | "COMPLETED" | "FAILED";
  cachedResponse?: Record<string, unknown>;
  callSid?: string;
  callId?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  maxLimit: number;
  retryAfterSeconds?: number;
  resetAt: string;
}

// Fast in-memory cache for ultra-fast local checks
const inMemoryReservations = new Map<
  string,
  {
    status: "PENDING" | "COMPLETED" | "FAILED";
    callSid?: string;
    callId?: string;
    responseJson?: string;
    expiresAt: number;
  }
>();

const inMemoryRateLimits = new Map<
  string,
  {
    count: number;
    windowEnd: number;
  }
>();

export class DurableConcurrencyService {
  /**
   * Atomically acquires or checks an idempotency reservation for a hospital request.
   * If another concurrent request has already reserved this key, returns isFirstAcquisition = false.
   */
  public async acquireIdempotencyReservation(
    hospitalId: string,
    idempotencyKey: string,
    resourceType: "OUTBOUND_CALL" | "CONFIG_PUBLISH" | "AGENT_UPDATE",
    ttlMinutes = 30
  ): Promise<ReservationResult> {
    const memoryKey = `${hospitalId}:${idempotencyKey}`;
    const now = Date.now();
    const expiresAt = new Date(now + ttlMinutes * 60 * 1000);

    // 1. Check in-memory fast cache first
    const cached = inMemoryReservations.get(memoryKey);
    if (cached && now < cached.expiresAt) {
      let parsedResponse: Record<string, unknown> | undefined;
      if (cached.responseJson) {
        try {
          parsedResponse = JSON.parse(cached.responseJson);
        } catch {
          // ignore parse error
        }
      }
      return {
        isFirstAcquisition: false,
        status: cached.status,
        cachedResponse: parsedResponse,
        callSid: cached.callSid,
        callId: cached.callId,
      };
    }

    // 2. Check Database if connected
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        // Attempt atomic insert. If unique constraint fails, record already exists.
        await prisma.durableIdempotencyRecord.create({
          data: {
            hospitalId,
            idempotencyKey,
            resourceType,
            status: "PENDING",
            expiresAt,
          },
        });

        inMemoryReservations.set(memoryKey, {
          status: "PENDING",
          expiresAt: expiresAt.getTime(),
        });

        return {
          isFirstAcquisition: true,
          status: "PENDING",
        };
      } catch {
        // Unique constraint violation (P2002) means duplicate exists
        const existing = await prisma.durableIdempotencyRecord.findUnique({
          where: {
            hospitalId_idempotencyKey: { hospitalId, idempotencyKey },
          },
        });

        if (existing) {
          let parsedResponse: Record<string, unknown> | undefined;
          if (existing.responseJson) {
            try {
              parsedResponse = JSON.parse(existing.responseJson);
            } catch {
              // ignore
            }
          }

          inMemoryReservations.set(memoryKey, {
            status: existing.status as "PENDING" | "COMPLETED" | "FAILED",
            callSid: existing.callSid || undefined,
            callId: existing.callId || undefined,
            responseJson: existing.responseJson || undefined,
            expiresAt: existing.expiresAt.getTime(),
          });

          return {
            isFirstAcquisition: false,
            status: existing.status as "PENDING" | "COMPLETED" | "FAILED",
            cachedResponse: parsedResponse,
            callSid: existing.callSid || undefined,
            callId: existing.callId || undefined,
          };
        }
      }
    }

    // 3. Fallback to memory store
    if (!cached || now >= cached.expiresAt) {
      inMemoryReservations.set(memoryKey, {
        status: "PENDING",
        expiresAt: expiresAt.getTime(),
      });
      return {
        isFirstAcquisition: true,
        status: "PENDING",
      };
    }

    return {
      isFirstAcquisition: false,
      status: cached.status,
      callSid: cached.callSid,
      callId: cached.callId,
    };
  }

  /**
   * Finalizes an idempotency reservation with success or failure details and cached response.
   */
  public async completeIdempotencyReservation(
    hospitalId: string,
    idempotencyKey: string,
    result: {
      status: "COMPLETED" | "FAILED";
      callSid?: string;
      callId?: string;
      responseJson?: Record<string, unknown>;
    }
  ): Promise<void> {
    const memoryKey = `${hospitalId}:${idempotencyKey}`;
    const stringified = result.responseJson ? JSON.stringify(result.responseJson) : undefined;

    const existing = inMemoryReservations.get(memoryKey);
    inMemoryReservations.set(memoryKey, {
      status: result.status,
      callSid: result.callSid || existing?.callSid,
      callId: result.callId || existing?.callId,
      responseJson: stringified || existing?.responseJson,
      expiresAt: existing?.expiresAt || Date.now() + 30 * 60 * 1000,
    });

    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        await prisma.durableIdempotencyRecord.updateMany({
          where: { hospitalId, idempotencyKey },
          data: {
            status: result.status,
            callSid: result.callSid,
            callId: result.callId,
            responseJson: stringified,
          },
        });
      } catch (err) {
        console.warn("[DurableConcurrency] DB completeIdempotencyReservation failed:", err);
      }
    }
  }

  /**
   * Enforces durable rate limiting across serverless instances.
   */
  public async checkRateLimit(
    hospitalId: string,
    bucketKey: string,
    maxLimit: number,
    windowSeconds = 60
  ): Promise<RateLimitResult> {
    const key = `${hospitalId}:${bucketKey}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    // Fast memory check
    const memBucket = inMemoryRateLimits.get(key);
    if (!memBucket || now >= memBucket.windowEnd) {
      inMemoryRateLimits.set(key, {
        count: 1,
        windowEnd: now + windowMs,
      });
    } else {
      memBucket.count++;
      if (memBucket.count > maxLimit) {
        const retryAfterSeconds = Math.ceil((memBucket.windowEnd - now) / 1000);
        return {
          allowed: false,
          currentCount: memBucket.count,
          maxLimit,
          retryAfterSeconds,
          resetAt: new Date(memBucket.windowEnd).toISOString(),
        };
      }
    }

    // Try DB synchronization if connected
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const record = await prisma.durableRateLimitBucket.findUnique({
          where: { hospitalId_bucketKey: { hospitalId, bucketKey } },
        });

        if (!record || record.windowEnd.getTime() <= now) {
          const windowEnd = new Date(now + windowMs);
          await prisma.durableRateLimitBucket.upsert({
            where: { hospitalId_bucketKey: { hospitalId, bucketKey } },
            create: {
              hospitalId,
              bucketKey,
              count: 1,
              windowStart: new Date(now),
              windowEnd,
            },
            update: {
              count: 1,
              windowStart: new Date(now),
              windowEnd,
            },
          });
          return {
            allowed: true,
            currentCount: 1,
            maxLimit,
            resetAt: windowEnd.toISOString(),
          };
        } else {
          const updated = await prisma.durableRateLimitBucket.update({
            where: { hospitalId_bucketKey: { hospitalId, bucketKey } },
            data: { count: { increment: 1 } },
          });

          if (updated.count > maxLimit) {
            const retryAfterSeconds = Math.ceil((record.windowEnd.getTime() - now) / 1000);
            return {
              allowed: false,
              currentCount: updated.count,
              maxLimit,
              retryAfterSeconds,
              resetAt: record.windowEnd.toISOString(),
            };
          }

          return {
            allowed: true,
            currentCount: updated.count,
            maxLimit,
            resetAt: record.windowEnd.toISOString(),
          };
        }
      } catch {
        // Fall back to memory result on DB collision
      }
    }

    const current = inMemoryRateLimits.get(key)!;
    return {
      allowed: current.count <= maxLimit,
      currentCount: current.count,
      maxLimit,
      retryAfterSeconds:
        current.count > maxLimit ? Math.ceil((current.windowEnd - now) / 1000) : undefined,
      resetAt: new Date(current.windowEnd).toISOString(),
    };
  }
}

export const durableConcurrencyService = new DurableConcurrencyService();
