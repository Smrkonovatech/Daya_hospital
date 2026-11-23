import * as fs from "fs";

// Load .env
if (fs.existsSync(".env")) {
  const envContent = fs.readFileSync(".env", "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import { prisma } from "../../src/lib/db/prisma";

async function main() {
  console.log("Checking Neon DB...");
  const configs = await prisma.emergencyRoutingConfig.findMany();
  console.log("EmergencyRoutingConfigs in DB:", JSON.stringify(configs, null, 2));

  const dayaFlow = await prisma.ivrFlow.findUnique({
    where: { id: "flow_hosp_daya_thrissur_main_inbound" },
  });
  const nodes = (dayaFlow?.nodesJson as any[]) || [];
  const em = nodes.find((n) => n.type === "EMERGENCY_HANDLING");
  const tr = nodes.find((n) => n.type === "HUMAN_TRANSFER");
  console.log("EMERGENCY NODE DATA:", JSON.stringify(em?.data, null, 2));
  console.log("TRANSFER NODE DATA:", JSON.stringify(tr?.data, null, 2));
}

main()
  .catch((e) => console.error("Error:", e))
  .finally(async () => {
    await prisma.$disconnect();
  });
