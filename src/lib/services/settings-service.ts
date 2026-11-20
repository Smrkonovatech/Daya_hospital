import { SystemIncident, UserRole } from "@/types";

export interface HospitalSettings {
  retentionDays: "15" | "30" | "60" | "90";
  enableMalayalamConsent: boolean;
  strictMasking: boolean;
  defaultStaffRecordingAccess: boolean;
  missedCallThreshold: number;
  urgentFollowUpAlerts: boolean;
  emergencyCasualtyAlerts: boolean;
  dailyDigestEmail: boolean;
  hmsTimeoutThresholdMs: number;
  lastUpdatedBy: string;
  updatedAt: string;
}

const INITIAL_SETTINGS: HospitalSettings = {
  retentionDays: "30",
  enableMalayalamConsent: true,
  strictMasking: true,
  defaultStaffRecordingAccess: false,
  missedCallThreshold: 10,
  urgentFollowUpAlerts: true,
  emergencyCasualtyAlerts: true,
  dailyDigestEmail: true,
  hmsTimeoutThresholdMs: 3000,
  lastUpdatedBy: "Dr. Anjali Menon (Medical Supt.)",
  updatedAt: "2026-10-24T12:00:00+05:30",
};

const INITIAL_INCIDENTS: SystemIncident[] = [
  {
    id: "inc_01",
    timestamp: "2026-10-26T14:20:00+05:30",
    service: "sarvam_ai",
    severity: "RESOLVED",
    title: "Smrko Voice Model Latency Normalised",
    description: "Brief peak latency spike of 420ms observed during morning rush. Automated failover restored baseline 240ms.",
    resolvedAt: "2026-10-26T14:35:00+05:30",
  },
  {
    id: "inc_02",
    timestamp: "2026-10-25T09:10:00+05:30",
    service: "daya_hms",
    severity: "RESOLVED",
    title: "HMS OPD Token Microservice Reconnected",
    description: "Database connection pool saturated during Monday morning registration peak. Pool expanded, slot lookup verified.",
    resolvedAt: "2026-10-25T09:22:00+05:30",
  },
  {
    id: "inc_03",
    timestamp: "2026-10-22T19:00:00+05:30",
    service: "telephony_ivr",
    severity: "INFO",
    title: "Scheduled SIP Trunk Redundancy Test",
    description: "Routine failover testing between Primary Trunk (BSNL PRI) and Secondary Trunk (Airtel SIP). All 30 channels operational.",
    resolvedAt: "2026-10-22T19:15:00+05:30",
  },
];

class SettingsService {
  private settings: HospitalSettings;
  private incidents: SystemIncident[];

  constructor() {
    this.settings = { ...INITIAL_SETTINGS };
    this.incidents = [...INITIAL_INCIDENTS];
  }

  getSettings(): HospitalSettings {
    return { ...this.settings };
  }

  updateSettings(
    updates: Partial<HospitalSettings>,
    actorRole: UserRole,
    actorName: string
  ): HospitalSettings {
    if (actorRole !== "HOSPITAL_ADMIN") {
      throw new Error("Forbidden: Only Hospital Administrators can modify hospital privacy and calling settings.");
    }

    this.settings = {
      ...this.settings,
      ...updates,
      lastUpdatedBy: actorName,
      updatedAt: new Date().toISOString(),
    };

    return { ...this.settings };
  }

  getIncidents(): SystemIncident[] {
    return [...this.incidents].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  getSystemStatusOverview() {
    return {
      integrations: [
        {
          id: "sarvam_ai",
          name: "Smrko Voice Assistant (Malayalam)",
          status: "Connected (Demo Mode)",
          health: "HEALTHY",
          latencyMs: 240,
          lastHealthCheck: new Date().toISOString(),
          lastEventReceived: "2026-10-27T08:30:15+05:30",
          engine: "Saarathi Malayalam v2.4",
          mode: "DEMO_MODE",
        },
        {
          id: "daya_hms",
          name: "Daya Hospital Management System (HMS)",
          status: "Connected (Demo Mode)",
          health: "HEALTHY",
          latencyMs: 180,
          lastHealthCheck: new Date().toISOString(),
          lastEventReceived: "2026-10-27T08:29:40+05:30",
          protocol: "REST with Idempotency",
          mode: "DEMO_MODE",
        },
        {
          id: "telephony_ivr",
          name: "Hospital IVR & SIP Telephony Provider",
          status: "Connected (Demo Mode)",
          health: "HEALTHY",
          latencyMs: 65,
          lastHealthCheck: new Date().toISOString(),
          lastEventReceived: "2026-10-27T08:31:00+05:30",
          capacity: "30 concurrent channels",
          activeChannels: 18,
          mode: "DEMO_MODE",
        },
      ],
      incidents: this.getIncidents(),
    };
  }
}

export const settingsService = new SettingsService();
