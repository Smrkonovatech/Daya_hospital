import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

/**
 * Validates database environment variables.
 */
export function getDatabaseConfig(): {
  isConfigured: boolean;
  databaseUrl?: string;
  isDemoMode: boolean;
} {
  const url = process.env.DATABASE_URL?.trim();

  // If no URL or placeholder/dummy URL, run in Development Demo Mode
  if (!url || url.includes("dummy") || url.includes("example.com")) {
    return {
      isConfigured: false,
      isDemoMode: true,
    };
  }

  return {
    isConfigured: true,
    databaseUrl: url,
    isDemoMode: false,
  };
}

/**
 * Singleton Prisma Client instance configured for Next.js.
 */
export const prisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

let cachedConnectionStatus: {
  connected: boolean;
  isDemoMode: boolean;
  checkedAt: number;
  message: string;
} | null = null;

/**
 * Verifies live database connectivity.
 * Caches status for 15 seconds to avoid query thrashing.
 */
export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  isDemoMode: boolean;
  message: string;
}> {
  const now = Date.now();
  if (cachedConnectionStatus && now - cachedConnectionStatus.checkedAt < 15000) {
    return {
      connected: cachedConnectionStatus.connected,
      isDemoMode: cachedConnectionStatus.isDemoMode,
      message: cachedConnectionStatus.message,
    };
  }

  const config = getDatabaseConfig();

  if (!config.isConfigured) {
    cachedConnectionStatus = {
      connected: false,
      isDemoMode: true,
      checkedAt: now,
      message:
        "DATABASE_URL not configured. Running in Development Demo Mode with in-memory relational store.",
    };
    return cachedConnectionStatus;
  }

  try {
    // Attempt a lightweight ping query with 2s timeout
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection timeout")), 2000)
      ),
    ]);

    cachedConnectionStatus = {
      connected: true,
      isDemoMode: false,
      checkedAt: now,
      message: "PostgreSQL connected and verified.",
    };
    return cachedConnectionStatus;
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown database connection error";
    cachedConnectionStatus = {
      connected: false,
      isDemoMode: true,
      checkedAt: now,
      message: `Database connection failed (${errorMsg}). Falling back to Development Demo Mode.`,
    };
    return cachedConnectionStatus;
  }
}
