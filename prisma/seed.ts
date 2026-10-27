import { PrismaClient, UserRole, UserStatus, CallStatus, CallSource, CallLanguage, IntentCategory, FollowUpStatus, ActionType, ActionStatus, KnowledgeStatus } from "@prisma/client";
import * as crypto from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  console.log("🏥 Seeding Daya General Hospital Database...");

  // 1. HOSPITAL SETTINGS
  await prisma.hospitalSetting.upsert({
    where: { id: "default_hospital_settings" },
    update: {},
    create: {
      id: "default_hospital_settings",
      retentionDays: "30",
      enableMalayalamConsent: true,
      strictMasking: true,
      defaultStaffRecordingAccess: false,
      missedCallThreshold: 30,
      urgentFollowUpAlerts: true,
      emergencyCasualtyAlerts: true,
      dailyDigestEmail: true,
      hmsTimeoutThresholdMs: 3000,
      lastUpdatedBy: "System Setup (Seed)",
    },
  });
  console.log("✓ Hospital settings configured");

  // 2. USERS
  const users = [
    {
      id: "usr_admin",
      name: "Dr. Anjali Menon",
      email: "admin@dayahospital.com",
      passwordHash: hashPassword("DayaAdmin@2026"),
      role: UserRole.HOSPITAL_ADMIN,
      status: UserStatus.ACTIVE,
      department: "Informatics & Medical Administration",
      employeeId: "DGH-ADM-001",
      phone: "+91 94470 11001",
      canAccessRecordings: true,
    },
    {
      id: "usr_staff",
      name: "Sister Mary",
      email: "staff@dayahospital.com",
      passwordHash: hashPassword("DayaStaff@2026"),
      role: UserRole.HOSPITAL_STAFF,
      status: UserStatus.ACTIVE,
      department: "OPD Triage Lead",
      employeeId: "DGH-NUR-104",
      phone: "+91 94470 22002",
      canAccessRecordings: false,
    },
    {
      id: "usr_reviewer",
      name: "Manoj Varma",
      email: "reviewer@dayahospital.com",
      passwordHash: hashPassword("DayaStaff@2026"),
      role: UserRole.CALL_REVIEWER,
      status: UserStatus.ACTIVE,
      department: "Patient Experience & Quality",
      employeeId: "DGH-REV-301",
      phone: "+91 94470 33003",
      canAccessRecordings: false,
    },
    {
      id: "usr_dr_rajesh",
      name: "Dr. Rajesh Kumar",
      email: "rajesh.ent@dayahospital.com",
      passwordHash: hashPassword("DayaStaff@2026"),
      role: UserRole.HOSPITAL_STAFF,
      status: UserStatus.ACTIVE,
      department: "ENT & Head-Neck Surgery",
      employeeId: "DGH-DOC-012",
      phone: "+91 94470 44004",
      canAccessRecordings: true,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        department: u.department,
        canAccessRecordings: u.canAccessRecordings,
      },
      create: u,
    });
  }
  console.log(`✓ Seeded ${users.length} hospital users`);

  // 3. ROLE PERMISSIONS
  const defaultPermissions = [
    { role: UserRole.HOSPITAL_ADMIN, resource: "CALLS", action: "READ" },
    { role: UserRole.HOSPITAL_ADMIN, resource: "CALLS", action: "EXPORT" },
    { role: UserRole.HOSPITAL_ADMIN, resource: "RECORDINGS", action: "READ" },
    { role: UserRole.HOSPITAL_ADMIN, resource: "KNOWLEDGE_BASE", action: "READ" },
    { role: UserRole.HOSPITAL_ADMIN, resource: "KNOWLEDGE_BASE", action: "WRITE" },
    { role: UserRole.HOSPITAL_ADMIN, resource: "KNOWLEDGE_BASE", action: "PUBLISH" },
    { role: UserRole.HOSPITAL_ADMIN, resource: "USERS", action: "READ" },
    { role: UserRole.HOSPITAL_ADMIN, resource: "USERS", action: "WRITE" },
    { role: UserRole.HOSPITAL_ADMIN, resource: "SETTINGS", action: "READ" },
    { role: UserRole.HOSPITAL_ADMIN, resource: "SETTINGS", action: "WRITE" },
    { role: UserRole.HOSPITAL_ADMIN, resource: "AUDIT_LOGS", action: "READ" },

    { role: UserRole.HOSPITAL_STAFF, resource: "CALLS", action: "READ" },
    { role: UserRole.HOSPITAL_STAFF, resource: "CALLS", action: "WRITE" },
    { role: UserRole.HOSPITAL_STAFF, resource: "KNOWLEDGE_BASE", action: "READ" },
    { role: UserRole.HOSPITAL_STAFF, resource: "KNOWLEDGE_BASE", action: "WRITE" }, // Can draft, cannot publish
    { role: UserRole.HOSPITAL_STAFF, resource: "SETTINGS", action: "READ" },

    { role: UserRole.CALL_REVIEWER, resource: "CALLS", action: "READ" },
    { role: UserRole.CALL_REVIEWER, resource: "CALLS", action: "WRITE" },
  ];

  for (const p of defaultPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        role_resource_action: {
          role: p.role,
          resource: p.resource,
          action: p.action,
        },
      },
      update: { isAllowed: true },
      create: {
        role: p.role,
        resource: p.resource,
        action: p.action,
        isAllowed: true,
      },
    });
  }
  console.log(`✓ Seeded ${defaultPermissions.length} role permissions`);

  // 4. CALL RECORDS WITH TRANSCRIPTS, AUDIO METADATA, & ACTIONS
  const callsData = [
    {
      id: "call_901",
      externalCallId: "sarvam_sess_084f1a",
      telephonySessionId: "sip_daya_in_901",
      callerNumber: "+91 94471 •••••",
      callerName: "Saritha Varma",
      patientUhid: "DGH-2026-4412",
      startTime: new Date("2026-10-27T08:30:15+05:30"),
      endTime: new Date("2026-10-27T08:32:37+05:30"),
      durationSeconds: 142,
      callStatus: CallStatus.ANSWERED,
      callSource: CallSource.IVR_ROLLOVER,
      language: CallLanguage.MALAYALAM,
      intentCategory: IntentCategory.APPOINTMENT_BOOKING,
      aiSummary: "Patient requested appointment with Dr. Rajesh Kumar (ENT) for persistent sinus pain. Assistant verified morning OPD slot and confirmed token #14 for 28-Oct-2026 at 10:30 AM.",
      aiConfidence: 0.98,
      requiresFollowUp: false,
      followUpStatus: FollowUpStatus.NOT_REQUIRED,
      hmsTransactionRef: "HMS-TXN-884102",
      isReviewed: true,
      reviewedBy: "Dr. Anjali Menon",
      reviewedAt: new Date("2026-10-27T09:15:00+05:30"),
      transcripts: [
        { speaker: "AI_AGENT", text: "നമസ്കാരം, ദയാ ജനറൽ ഹോസ്പിറ്റൽ വോയ്സ് അസിസ്റ്റന്റാണ്. ഞാൻ എങ്ങനെ സഹായിക്കണം?", textMalayalam: "നമസ്കാരം, ദയാ ജനറൽ ഹോസ്പിറ്റൽ വോയ്സ് അസിസ്റ്റന്റാണ്. ഞാൻ എങ്ങനെ സഹായിക്കണം?", timestampMs: 800, confidence: 0.99 },
        { speaker: "CALLER", text: "ഡോക്ടർ രാജേഷ് കുമാറിനെ കാണാൻ നാളെ രാവിലെ സമയം ഉണ്ടോ? സൈനസ് വേദന കാരണം ബുദ്ധിമുട്ടാണ്.", textMalayalam: "ഡോക്ടർ രാജേഷ് കുമാറിനെ കാണാൻ നാളെ രാവിലെ സമയം ഉണ്ടോ? സൈനസ് വേദന കാരണം ബുദ്ധിമുട്ടാണ്.", timestampMs: 3200, confidence: 0.97 },
        { speaker: "AI_AGENT", text: "തീർച്ചയായും. നാളെ ഒക്ടോബർ 28 രാവിലെ 10:30 ന് ഇഎൻടി ഒപിയിൽ ടോക്കൺ 14 ലഭ്യമാണ്. ബുക്ക് ചെയ്യട്ടെ?", textMalayalam: "തീർച്ചയായും. നാളെ ഒക്ടോബർ 28 രാവിലെ 10:30 ന് ഇഎൻടി ഒപിയിൽ ടോക്കൺ 14 ലഭ്യമാണ്. ബുക്ക് ചെയ്യട്ടെ?", timestampMs: 9800, confidence: 0.98 },
        { speaker: "CALLER", text: "അതെ, ബുക്ക് ചെയ്തോളൂ. സരിത വർമ്മ എന്നാണ് പേര്.", textMalayalam: "അതെ, ബുക്ക് ചെയ്തോളൂ. സരിത വർമ്മ എന്നാണ് പേര്.", timestampMs: 14500, confidence: 0.96 },
        { speaker: "AI_AGENT", text: "സരിത വർമ്മയ്ക്ക് ടോക്കൺ 14 ബുക്ക് ചെയ്തിട്ടുണ്ട്. കൺഫർമേഷൻ എസ്എംഎസ് അയച്ചിട്ടുണ്ട്. നന്ദി.", textMalayalam: "സരിത വർമ്മയ്ക്ക് ടോക്കൺ 14 ബുക്ക് ചെയ്തിട്ടുണ്ട്. കൺഫർമേഷൻ എസ്എംഎസ് അയച്ചിട്ടുണ്ട്. നന്ദി.", timestampMs: 19000, confidence: 0.99 },
      ],
      recording: {
        externalSessionId: "sarvam_sess_084f1a",
        storageKey: "daya-recordings/2026-10-27/call_901.opus",
        mimeType: "audio/webm;codecs=opus",
        durationSeconds: 142,
        fileSizeBytes: 485000,
        hasConsent: true,
        retentionExpiry: new Date("2026-11-26T08:30:15+05:30"),
      },
      action: {
        id: "act_401",
        actionType: ActionType.BOOK_APPOINTMENT,
        status: ActionStatus.CONFIRMED,
        idempotencyKey: "idemp_dgh_book_901_01",
        externalReference: "HMS-TXN-884102",
        doctorName: "Dr. Rajesh Kumar",
        department: "ENT",
        appointmentSlot: "28-Oct-2026 10:30 AM",
        patientUhid: "DGH-2026-4412",
        patientName: "Saritha Varma",
        payloadJson: JSON.stringify({ doctorId: "DOC-ENT-012", date: "2026-10-28", slot: "10:30", uhid: "DGH-2026-4412" }),
        responseJson: JSON.stringify({ status: "SUCCESS", tokenNumber: 14, hmsRef: "HMS-TXN-884102" }),
      },
    },
    {
      id: "call_902",
      externalCallId: "sarvam_sess_084f1b",
      telephonySessionId: "sip_daya_in_902",
      callerNumber: "+91 98460 •••••",
      callerName: "K. R. Narayanan",
      patientUhid: "DGH-2025-8819",
      startTime: new Date("2026-10-27T08:42:00+05:30"),
      endTime: new Date("2026-10-27T08:44:10+05:30"),
      durationSeconds: 130,
      callStatus: CallStatus.ANSWERED,
      callSource: CallSource.IVR_ROLLOVER,
      language: CallLanguage.MALAYALAM,
      intentCategory: IntentCategory.DOCTOR_AVAILABILITY,
      aiSummary: "Enquired about Dr. Vinod (Gastroenterology) OPD schedule. Advised clinic days on Tuesday and Saturday from 9:00 AM to 1:00 PM.",
      aiConfidence: 0.97,
      requiresFollowUp: false,
      followUpStatus: FollowUpStatus.NOT_REQUIRED,
      isReviewed: false,
      transcripts: [
        { speaker: "AI_AGENT", text: "നമസ്കാരം, ദയാ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം. എന്താണ് താങ്കളുടെ അന്വേഷണം?", textMalayalam: "നമസ്കാരം, ദയാ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം. എന്താണ് താങ്കളുടെ അന്വേഷണം?", timestampMs: 700, confidence: 0.99 },
        { speaker: "CALLER", text: "ഗ്യാസ്ട്രോ ഡോക്ടർ വിനോദ് ഇന്ന് ഉണ്ടോ?", textMalayalam: "ഗ്യാസ്ട്രോ ഡോക്ടർ വിനോദ് ഇന്ന് ഉണ്ടോ?", timestampMs: 3100, confidence: 0.98 },
        { speaker: "AI_AGENT", text: "ഡോ. വിനോദ് ചൊവ്വ, ശനി ദിവസങ്ങളിലാണ് ഒപി കൺസൾട്ടേഷൻ നടത്തുന്നത്. നാളെ രാവിലെ ഒൻപത് മണിക്ക് ഒപി ലഭ്യമാണ്.", textMalayalam: "ഡോ. വിനോദ് ചൊവ്വ, ശനി ദിവസങ്ങളിലാണ് ഒപി കൺസൾട്ടേഷൻ നടത്തുന്നത്. നാളെ രാവിലെ ഒൻപത് മണിക്ക് ഒപി ലഭ്യമാണ്.", timestampMs: 7800, confidence: 0.97 },
      ],
      recording: {
        externalSessionId: "sarvam_sess_084f1b",
        storageKey: "daya-recordings/2026-10-27/call_902.opus",
        mimeType: "audio/webm;codecs=opus",
        durationSeconds: 130,
        fileSizeBytes: 440000,
        hasConsent: true,
        retentionExpiry: new Date("2026-11-26T08:42:00+05:30"),
      },
      action: {
        id: "act_402",
        actionType: ActionType.CHECK_DOCTOR_SLOT,
        status: ActionStatus.CONFIRMED,
        idempotencyKey: "idemp_dgh_slot_902_01",
        doctorName: "Dr. Vinod",
        department: "Gastroenterology",
        payloadJson: JSON.stringify({ doctor: "Dr. Vinod", department: "Gastroenterology" }),
        responseJson: JSON.stringify({ schedule: "Tue, Sat (09:00 - 13:00)" }),
      },
    },
    {
      id: "call_903",
      externalCallId: "sarvam_sess_084f1c",
      telephonySessionId: "sip_daya_in_903",
      callerNumber: "+91 97451 •••••",
      callerName: "Unnikrishnan K.",
      startTime: new Date("2026-10-27T08:50:00+05:30"),
      endTime: new Date("2026-10-27T08:52:15+05:30"),
      durationSeconds: 135,
      callStatus: CallStatus.TRANSFERRED,
      callSource: CallSource.IVR_ROLLOVER,
      language: CallLanguage.MALAYALAM,
      intentCategory: IntentCategory.EMERGENCY_AMBULANCE,
      aiSummary: "Patient relative reported severe chest tightness. Immediate protocol triggered: warm transfer routed to Daya Emergency Casualty desk within 6 seconds.",
      aiConfidence: 0.99,
      requiresFollowUp: true,
      followUpStatus: FollowUpStatus.PENDING,
      followUpNotes: "Urgent casualty handover initiated. Staff follow-up requested to confirm arrival at triage.",
      isReviewed: true,
      reviewedBy: "Sister Mary",
      reviewedAt: new Date("2026-10-27T09:00:00+05:30"),
      transcripts: [
        { speaker: "AI_AGENT", text: "ദയാ ജനറൽ ഹോസ്പിറ്റൽ. എനിക്ക് എന്തുസഹായം നൽകാനാകും?", textMalayalam: "ദയാ ജനറൽ ഹോസ്പിറ്റൽ. എനിക്ക് എന്തുസഹായം നൽകാനാകും?", timestampMs: 600, confidence: 0.99 },
        { speaker: "CALLER", text: "നെഞ്ചിൽ ഭയങ്കര വേദനയും ശ്വാസംമുട്ടലും ഉണ്ട്! വേഗം ആംബുലൻസ് വേണം!", textMalayalam: "നെഞ്ചിൽ ഭയങ്കര വേദനയും ശ്വാസംമുട്ടലും ഉണ്ട്! വേഗം ആംബുലൻസ് വേണം!", timestampMs: 2800, confidence: 0.98 },
        { speaker: "AI_AGENT", text: "ഇതൊരു എമർജൻസിയാണ്. ഞാൻ ഉടൻ തന്നെ എമർജൻസി കാഷ്വാലിറ്റി ഡെസ്കിലേക്ക് കണക്ട് ചെയ്യുന്നു, ലൈനിൽ തുടരൂ.", textMalayalam: "ഇതൊരു എമർജൻസിയാണ്. ഞാൻ ഉടൻ തന്നെ എമർജൻസി കാഷ്വാലിറ്റി ഡെസ്കിലേക്ക് കണക്ട് ചെയ്യുന്നു, ലൈനിൽ തുടരൂ.", timestampMs: 6200, confidence: 0.99 },
      ],
      recording: {
        externalSessionId: "sarvam_sess_084f1c",
        storageKey: "daya-recordings/2026-10-27/call_903.opus",
        mimeType: "audio/webm;codecs=opus",
        durationSeconds: 135,
        fileSizeBytes: 460000,
        hasConsent: true,
        retentionExpiry: new Date("2026-11-26T08:50:00+05:30"),
      },
      action: {
        id: "act_403",
        actionType: ActionType.TRANSFER_CALL_TO_STAFF,
        status: ActionStatus.CONFIRMED,
        idempotencyKey: "idemp_dgh_trans_903_01",
        department: "Emergency Casualty",
        failureReason: null,
        staffNotes: "Transferred to Casualty extension 101. Protocol 01 executed.",
      },
    },
  ];

  for (const c of callsData) {
    const { transcripts, recording, action, ...callRecord } = c;

    await prisma.callRecord.upsert({
      where: { id: callRecord.id },
      update: callRecord,
      create: callRecord,
    });

    // Transcript entries
    for (const t of transcripts) {
      await prisma.transcriptEntry.create({
        data: {
          callId: callRecord.id,
          speaker: t.speaker,
          text: t.text,
          textMalayalam: t.textMalayalam,
          timestampMs: t.timestampMs,
          confidence: t.confidence,
        },
      });
    }

    // Recording metadata
    if (recording) {
      await prisma.recordingMetadata.upsert({
        where: { callId: callRecord.id },
        update: recording,
        create: {
          callId: callRecord.id,
          ...recording,
        },
      });
    }

    // AI Action
    if (action) {
      await prisma.aiAction.upsert({
        where: { id: action.id },
        update: action,
        create: {
          callId: callRecord.id,
          ...action,
        },
      });

      // Action event
      await prisma.actionEvent.create({
        data: {
          actionId: action.id,
          eventType: "HMS_CONFIRMED",
          status: "SUCCESS",
          details: "Adapter processed action event synchronously",
        },
      });
    }

    // Follow-up task if required
    if (callRecord.requiresFollowUp) {
      await prisma.followUpTask.create({
        data: {
          callId: callRecord.id,
          callerNumber: callRecord.callerNumber,
          callerName: callRecord.callerName,
          reason: "Emergency casualty transfer follow-up",
          priority: "URGENT",
          status: FollowUpStatus.PENDING,
          notes: callRecord.followUpNotes,
        },
      });
    }
  }
  console.log(`✓ Seeded ${callsData.length} call records, transcripts, audio recordings, and actions`);

  // 5. KNOWLEDGE ARTICLES & VERSIONS
  const articlesData = [
    {
      id: "kb_01",
      title: "OPD Registration & Doctor Consultation Fees [DEMO DATA]",
      titleMalayalam: "ഒപി രജിസ്ട്രേഷൻ & ഡോക്ടർ ഫീസ് [ഡെമോ]",
      category: "CONSULTATION_FEES",
      summary: "Approved outpatient registration charges, general physician charges, super-speciality consultation fees, and revisit validity windows.",
      content: "1. General Outpatient Registration fee is ₹100, valid for 7 calendar days.\n2. General Physician consultation fee is ₹250.\n3. Super-speciality consultations (Cardiology, Neurology, Gastroenterology, Oncology) are ₹500 - ₹600.\n4. Senior Citizen counter (Counter #2) provides direct token issuance without queue delays.",
      contentMalayalam: "1. ജനറൽ ഒപി രജിസ്ട്രേഷൻ ഫീസ് 100 രൂപയാണ് (7 ദിവസത്തെ കാലാവധി).\n2. ജനറൽ ഫിസിഷ്യൻ കൺസൾട്ടേഷൻ ഫീസ് 250 രൂപ.\n3. സൂപ്പർ സ്പെഷ്യാലിറ്റി കൺസൾട്ടേഷൻ ഫീസ് 500 രൂപ മുതൽ 600 രൂപ വരെ.\n4. മുതിർന്ന പൗരന്മാർക്കായി കൗണ്ടർ #2 ൽ പ്രത്യേക സൗകര്യം ഒരുക്കിയിട്ടുണ്ട്.",
      sourceReference: "Hospital Management Circular #2026/04",
      internalNotes: "Verified with Daya Billing Office. Revisit policy covers up to 1 review within 7 days.",
      status: KnowledgeStatus.PUBLISHED,
      version: 4,
      lastUpdatedBy: "Dr. Anjali Menon (Medical Supt.)",
      lastPublishedBy: "Dr. Anjali Menon",
      lastPublishedAt: new Date("2026-10-24T14:35:10+05:30"),
      publishedContent: "1. General Outpatient Registration fee is ₹100, valid for 7 calendar days.\n2. General Physician consultation fee is ₹250.\n3. Super-speciality consultations (Cardiology, Neurology, Gastroenterology, Oncology) are ₹500 - ₹600.\n4. Senior Citizen counter (Counter #2) provides direct token issuance without queue delays.",
      isDemoData: true,
      versions: [
        { versionNumber: 1, action: "CREATED", summaryOfChanges: "Initial baseline consultation fees draft.", createdByName: "Sister Mary", previousStatus: "DRAFT", newStatus: "DRAFT" },
        { versionNumber: 2, action: "PUBLISHED", summaryOfChanges: "Authorized initial published schedule.", createdByName: "Dr. Anjali Menon", previousStatus: "DRAFT", newStatus: "PUBLISHED" },
        { versionNumber: 3, action: "PUBLISHED", summaryOfChanges: "Clarified 7-day revisit policy validity rules.", createdByName: "Mathew George (Admin)", previousStatus: "DRAFT", newStatus: "PUBLISHED" },
        { versionNumber: 4, action: "PUBLISHED", summaryOfChanges: "Updated super-speciality consultation charge to ₹600 as per management circular #2026/18.", createdByName: "Dr. Anjali Menon (Medical Supt.)", previousStatus: "DRAFT", newStatus: "PUBLISHED" },
      ],
    },
    {
      id: "kb_02",
      title: "Hospital Timings & Emergency Casualty Operations [DEMO DATA]",
      titleMalayalam: "ആശുപത്രി സമയങ്ങളും എമർജൻസി കാഷ്വാലിറ്റിയും [ഡെമോ]",
      category: "HOSPITAL_TIMINGS",
      summary: "24/7 Casualty & Trauma care operations, regular OPD consultation clinic hours, diagnostic lab collection timings, and visiting rules.",
      content: "1. Emergency Casualty & Trauma Care operates 24 hours a day, 7 days a week, 365 days a year.\n2. Regular OPD timings: 08:00 AM to 01:00 PM (Morning), 04:00 PM to 07:00 PM (Evening).\n3. Central Diagnostic Laboratory: 24/7 sample collection with online report delivery.\n4. ICU Visiting Hours: Strictly 04:30 PM to 05:30 PM (one attendant per patient).",
      contentMalayalam: "1. അത്യാഹിത വിഭാഗവും ട്രോമ കെയറും 24 മണിക്കൂറും പ്രവർത്തിക്കുന്നു.\n2. ഒപി സമയം: രാവിലെ 8:00 മുതൽ 1:00 വരെ, വൈകുന്നേരം 4:00 മുതൽ 7:00 വരെ.\n3. ലാബ്: 24 മണിക്കൂറും പ്രവർത്തിക്കുന്നു.\n4. ഐസിയു സന്ദർശന സമയം: വൈകുന്നേരം 4:30 മുതൽ 5:30 വരെ മാത്രം.",
      sourceReference: "Daya Hospital Operations Manual Rev 3.2",
      status: KnowledgeStatus.PUBLISHED,
      version: 2,
      lastUpdatedBy: "Sister Mary (Triage Lead)",
      lastPublishedBy: "Dr. Anjali Menon",
      lastPublishedAt: new Date("2026-09-15T10:00:00+05:30"),
      publishedContent: "1. Emergency Casualty & Trauma Care operates 24 hours a day, 7 days a week, 365 days a year.\n2. Regular OPD timings: 08:00 AM to 01:00 PM (Morning), 04:00 PM to 07:00 PM (Evening).\n3. Central Diagnostic Laboratory: 24/7 sample collection with online report delivery.\n4. ICU Visiting Hours: Strictly 04:30 PM to 05:30 PM (one attendant per patient).",
      isDemoData: true,
      versions: [
        { versionNumber: 1, action: "CREATED", summaryOfChanges: "Initial baseline operations timing.", createdByName: "Sister Mary", previousStatus: "DRAFT", newStatus: "DRAFT" },
        { versionNumber: 2, action: "PUBLISHED", summaryOfChanges: "Updated ICU visiting restrictions.", createdByName: "Dr. Anjali Menon", previousStatus: "DRAFT", newStatus: "PUBLISHED" },
      ],
    },
  ];

  for (const art of articlesData) {
    const { versions, ...article } = art;

    await prisma.knowledgeArticle.upsert({
      where: { id: article.id },
      update: article,
      create: article,
    });

    for (const v of versions) {
      await prisma.knowledgeVersion.upsert({
        where: {
          articleId_versionNumber: {
            articleId: article.id,
            versionNumber: v.versionNumber,
          },
        },
        update: {
          title: article.title,
          content: article.content,
          action: v.action,
          summaryOfChanges: v.summaryOfChanges,
          createdByName: v.createdByName,
        },
        create: {
          articleId: article.id,
          versionNumber: v.versionNumber,
          title: article.title,
          content: article.content,
          action: v.action,
          summaryOfChanges: v.summaryOfChanges,
          previousStatus: v.previousStatus,
          newStatus: v.newStatus,
          createdByName: v.createdByName,
        },
      });
    }
  }
  console.log(`✓ Seeded ${articlesData.length} approved knowledge articles and version history`);

  // 6. INTEGRATION HEALTH SNAPSHOTS
  const gateways = [
    {
      id: "gw_sarvam",
      integration: "sarvam_ai",
      name: "Sarvam AI Voice Assistant (Malayalam)",
      status: "Connected (Demo Mode)",
      health: "HEALTHY" as const,
      latencyMs: 240,
      lastEventReceived: new Date(),
      metadataJson: JSON.stringify({ engine: "Saarathi Malayalam v2.4", mode: "DEMO_MODE" }),
    },
    {
      id: "gw_hms",
      integration: "daya_hms",
      name: "Daya Hospital Management System (HMS)",
      status: "Connected (Demo Mode)",
      health: "HEALTHY" as const,
      latencyMs: 180,
      lastEventReceived: new Date(),
      metadataJson: JSON.stringify({ protocol: "REST with Idempotency", mode: "DEMO_MODE" }),
    },
    {
      id: "gw_ivr",
      integration: "telephony_ivr",
      name: "Hospital IVR & SIP Telephony Provider",
      status: "Connected (Demo Mode)",
      health: "HEALTHY" as const,
      latencyMs: 65,
      lastEventReceived: new Date(),
      metadataJson: JSON.stringify({ channels: 30, active: 18, mode: "DEMO_MODE" }),
    },
  ];

  for (const gw of gateways) {
    await prisma.integrationHealthSnapshot.upsert({
      where: { id: gw.id },
      update: gw,
      create: gw,
    });
  }
  console.log(`✓ Seeded ${gateways.length} integration health snapshots`);

  // 7. AUDIT LOG INITIAL RECORD
  await prisma.auditLog.create({
    data: {
      entityType: "SYSTEM",
      entityId: "daya_db_init",
      action: "DATABASE_SEEDED",
      performedBy: "Dr. Anjali Menon (Seed Automation)",
      details: "Initial relational hospital database schema seeded with safe test records and masked caller numbers.",
    },
  });
  console.log("✓ Recorded initial database seed in audit logs");

  console.log("🌟 Database seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
