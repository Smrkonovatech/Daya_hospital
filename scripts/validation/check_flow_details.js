const { PrismaClient } = require("@prisma/client");

async function checkFlowDetails() {
  const prisma = new PrismaClient();
  try {
    const flow = await prisma.ivrFlow.findUnique({
      where: { id: "flow_hosp_daya_thrissur_main_inbound" },
      include: {
        versions: {
          where: { versionNumber: 1 },
        },
      },
    });

    if (!flow || !flow.versions[0]) {
      console.log("Flow or version 1 not found");
      return;
    }

    const version = flow.versions[0];
    const snapshot = version.snapshotJson;
    console.log("=== FLOW NODES ===");
    for (const n of snapshot.nodes) {
      console.log(`Node: id=${n.id}, type=${n.type}`);
      console.log("   data:", JSON.stringify(n.data, null, 2));
    }

    console.log("\n=== FLOW EDGES ===");
    for (const e of snapshot.edges) {
      console.log(`Edge: ${e.sourceNodeId} [${e.sourcePortId || "default"}] ---> ${e.targetNodeId}`);
    }
  } catch (err) {
    console.error("Error checking flow:", err);
  } finally {
    await prisma.$disconnect();
  }
}

checkFlowDetails();

