import { prisma } from "../../src/lib/db/prisma";

async function run() {
  try {
    const count = await prisma.durableIdempotencyRecord.count();
    console.log("SUCCESS: DurableIdempotencyRecord count in Neon DB:", count);
  } catch (err: any) {
    console.error("ERROR querying DurableIdempotencyRecord:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();

