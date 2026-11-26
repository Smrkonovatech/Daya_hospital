import { hospitalRoutingService } from "../../src/lib/services/hospital-routing-service";
import { getHospitalConfig } from "../../src/lib/config/hospital-config";

async function main() {
  console.log("=== INSPECT DAYA HOSPITAL CONFIGURATION ===");
  const staticConfig = getHospitalConfig("hosp_daya_thrissur");
  console.log("1. Static config routing:", {
    casualtyExtension: staticConfig.routing.casualtyExtension,
    casualtyDirectNumber: staticConfig.routing.casualtyDirectNumber,
    receptionistNumber: staticConfig.routing.receptionistNumber,
    receiverClassification: staticConfig.routing.receiverClassification,
    emergencyLivePstnTransferEnabled: staticConfig.routing.emergencyLivePstnTransferEnabled,
  });

  const defaultRouting = hospitalRoutingService.getDefaultRoutingConfig("hosp_daya_thrissur");
  console.log("\n2. Default baseline routing config:", {
    hospitalId: defaultRouting.hospitalId,
    emergencyDestination: defaultRouting.emergencyDestination,
    receptionistDestination: defaultRouting.receptionistDestination,
    receptionistRingTimeoutSeconds: defaultRouting.receptionistRingTimeoutSeconds,
    aiOverflowEnabled: defaultRouting.aiOverflowEnabled,
    afterHoursDestination: defaultRouting.afterHoursDestination,
    humanFallbackDestination: defaultRouting.humanFallbackDestination,
  });

  const published = await hospitalRoutingService.getPublishedVersion("hosp_daya_thrissur");
  console.log("\n3. Published version snapshot:", {
    versionNumber: published?.versionNumber,
    publishedAt: published?.publishedAt,
    publishedBy: published?.publishedBy,
    changelog: published?.changelog,
    emergencyDestination: published?.emergencyDestination,
    receptionistDestination: published?.receptionistDestination,
    receptionistRingTimeoutSeconds: published?.receptionistRingTimeoutSeconds,
  });
}

main().catch(console.error);
