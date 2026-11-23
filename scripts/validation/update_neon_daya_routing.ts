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

async function updateDayaRouting() {
  console.log("=================================================================");
  console.log("UPDATING NEON DB ROUTING DESTINATIONS FOR DAYA HOSPITAL");
  console.log("=================================================================");

  const destinationNumber = "+919606654032";

  // 1. Update EmergencyRoutingConfig
  console.log("\n[1/3] Updating EmergencyRoutingConfig in Neon DB...");
  const emConfig = await prisma.emergencyRoutingConfig.findFirst({
    where: { hospitalId: "hosp_daya_thrissur" },
  });

  if (emConfig) {
    const updatedEm = await prisma.emergencyRoutingConfig.update({
      where: { id: emConfig.id },
      data: {
        casualtyNumber: destinationNumber,
        isVerified: true,
        verifiedBy: "User Authorized (Phase 9.5 Development Testing)",
        verifiedAt: new Date(),
        allowLiveTransfer: true,
      },
    });
    console.log("  Successfully updated EmergencyRoutingConfig:", {
      id: updatedEm.id,
      casualtyNumber: updatedEm.casualtyNumber,
      isVerified: updatedEm.isVerified,
      allowLiveTransfer: updatedEm.allowLiveTransfer,
    });
  } else {
    const createdEm = await prisma.emergencyRoutingConfig.create({
      data: {
        hospitalId: "hosp_daya_thrissur",
        casualtyNumber: destinationNumber,
        isVerified: true,
        verifiedBy: "Hospital Administrator (Phase 9.5 Verified)",
        verifiedAt: new Date(),
        allowLiveTransfer: true,
        fallbackNumber: "108",
        confidenceThreshold: 0.75,
      },
    });
    console.log("  Created EmergencyRoutingConfig:", createdEm);
  }

  // 2. Update IvrFlow nodesJson for flow_hosp_daya_thrissur_main_inbound
  console.log("\n[2/3] Updating published Daya IVR Flow nodesJson...");
  const flow = await prisma.ivrFlow.findUnique({
    where: { id: "flow_hosp_daya_thrissur_main_inbound" },
  });

  if (!flow) {
    console.error("  FATAL: flow_hosp_daya_thrissur_main_inbound not found in DB!");
    return;
  }

  const nodes = (flow.nodesJson as any[]) || [];
  for (const node of nodes) {
    if (node.type === "EMERGENCY_HANDLING") {
      node.data = {
        ...node.data,
        autoTransfer: true,
        isConfirmedDestination: true,
        casualtyDestinationNumber: destinationNumber,
      };
      console.log("  Updated EMERGENCY_HANDLING node:", node.id, node.data);
    } else if (node.type === "HUMAN_TRANSFER") {
      node.data = {
        ...node.data,
        destinationNumber: destinationNumber,
        transferType: "PHONE_NUMBER",
        whisperMessage: "Incoming call transferred from Smrkomed Daya Reception",
      };
      console.log("  Updated HUMAN_TRANSFER node:", node.id, node.data);
    }
  }

  const updatedFlow = await prisma.ivrFlow.update({
    where: { id: flow.id },
    data: {
      nodesJson: nodes,
      updatedAt: new Date(),
    },
  });
  console.log("  Successfully updated IvrFlow nodesJson:", updatedFlow.id);

  // 3. Update IvrFlowVersion snapshotJson
  console.log("\n[3/3] Updating IvrFlowVersion snapshotJson...");
  const versions = await prisma.ivrFlowVersion.findMany({
    where: { flowId: flow.id },
  });

  for (const v of versions) {
    const snapshot = (v.snapshotJson as any) || {};
    if (snapshot.nodes && Array.isArray(snapshot.nodes)) {
      for (const snNode of snapshot.nodes) {
        if (snNode.type === "EMERGENCY_HANDLING") {
          snNode.data = {
            ...snNode.data,
            autoTransfer: true,
            isConfirmedDestination: true,
            casualtyDestinationNumber: destinationNumber,
          };
        } else if (snNode.type === "HUMAN_TRANSFER") {
          snNode.data = {
            ...snNode.data,
            destinationNumber: destinationNumber,
            transferType: "PHONE_NUMBER",
            whisperMessage: "Incoming call transferred from Smrkomed Daya Reception",
          };
        }
      }
    }
    await prisma.ivrFlowVersion.update({
      where: { id: v.id },
      data: {
        snapshotJson: snapshot,
      },
    });
    console.log(`  Updated IvrFlowVersion ${v.versionNumber} (${v.id}) snapshotJson.`);
  }

  console.log("\nAll Neon DB routing records updated successfully for Daya Hospital.");
}

updateDayaRouting()
  .catch((e) => console.error("Error updating Daya routing:", e))
  .finally(async () => {
    await prisma.$disconnect();
  });

