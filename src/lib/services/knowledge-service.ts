import { KnowledgeArticle, KnowledgeCategory, KnowledgeStatus } from "@/types";
import { sarvamKnowledgeSync, SarvamSyncResult } from "@/lib/integrations/sarvam/knowledge-sync";

export const INITIAL_KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    id: "kb_01",
    title: "OPD Registration & Doctor Consultation Fees [DEMO DATA]",
    titleMalayalam: "ഒപി രജിസ്ട്രേഷനും ഡോക്ടർ കൺസൾട്ടേഷൻ ഫീസും [ഡെമോ]",
    category: "CONSULTATION_FEES",
    summary: "Standard fees for new registration, follow-ups, general OPD and super-speciality consultants.",
    content: `[DEMO DATA - Sample for AI Calling Testing]
1. New Patient Registration: ₹100 (one-time lifetime registration with Digital UHID card).
2. General Medicine OPD Consultation: ₹250 (valid for 7 days revisit).
3. Specialist Consultation (Orthopaedics, Paediatrics, ENT, Ophthalmology, OBG): ₹450.
4. Super Speciality (Cardiology, Neurology, Urology, Gastro): ₹600.
5. Emergency Casualty Triage & Doctor Fee: ₹500 (24/7).
6. Payment modes: UPI (GPay/PhonePe), Credit/Debit Cards, Cash, and Approved TPA Cashless.`,
    contentMalayalam: `[ഡെമോ ഡാറ്റ]
1. പുതിയ പേഷ്യന്റ് രജിസ്ട്രേഷൻ: ₹100 (ആജീവനാന്ത ഡിജിറ്റൽ UHID കാർഡ്).
2. ജനറൽ മെഡിസിൻ ഒപി കൺസൾട്ടേഷൻ: ₹250 (7 ദിവസത്തിനുള്ളിൽ സൗജന്യ റീവിസിറ്റ്).
3. സ്പെഷ്യലിസ്റ്റ് കൺസൾട്ടേഷൻ (ഓർത്തോ, പീഡിയാട്രിക്സ്, ഇഎൻടി, ഗൈനക്കോളജി): ₹450.
4. സൂപ്പർ സ്പെഷ്യാലിറ്റി (കാർഡിയോളജി, ന്യൂറോളജി, ഗാസ്ട്രോ): ₹600.
5. കാഷ്വാലിറ്റി എമർജൻസി ഫീസ്: ₹500 (24 മണിക്കൂറും).
6. പണമായും കാർഡ് വഴിയും യുപിഐ വഴിയും പണമടയ്ക്കാം.`,
    sourceReference: "Management Tariff Circular #2026/18",
    internalNotes: "Revised super-speciality fee from ₹550 to ₹600.",
    status: "PUBLISHED",
    version: 4,
    lastUpdatedBy: "Dr. Anjali Menon (Medical Supt.)",
    updatedAt: "2026-10-24T14:30:00+05:30",
    lastPublishedAt: "2026-10-24T14:35:10+05:30",
    lastPublishedBy: "Dr. Anjali Menon (Medical Supt.)",
    publishedContent: `[DEMO DATA - Sample for AI Calling Testing]
1. New Patient Registration: ₹100 (one-time lifetime registration with Digital UHID card).
2. General Medicine OPD Consultation: ₹250 (valid for 7 days revisit).
3. Specialist Consultation (Orthopaedics, Paediatrics, ENT, Ophthalmology, OBG): ₹450.
4. Super Speciality (Cardiology, Neurology, Urology, Gastro): ₹600.
5. Emergency Casualty Triage & Doctor Fee: ₹500 (24/7).
6. Payment modes: UPI (GPay/PhonePe), Credit/Debit Cards, Cash, and Approved TPA Cashless.`,
    publishedContentMalayalam: `[ഡെമോ ഡാറ്റ]
1. പുതിയ പേഷ്യന്റ് രജിസ്ട്രേഷൻ: ₹100 (ആജീവനാന്ത ഡിജിറ്റൽ UHID കാർഡ്).
2. ജനറൽ മെഡിസിൻ ഒപി കൺസൾട്ടേഷൻ: ₹250 (7 ദിവസത്തിനുള്ളിൽ സൗജന്യ റീവിസിറ്റ്).
3. സ്പെഷ്യലിസ്റ്റ് കൺസൾട്ടേഷൻ: ₹450.
4. സൂപ്പർ സ്പെഷ്യാലിറ്റി: ₹600.
5. കാഷ്വാലിറ്റി എമർജൻസി ഫീസ്: ₹500 (24 മണിക്കൂറും).`,
    hasUnpublishedChanges: false,
    syncedToSarvam: false,
    syncStatus: "NOT_SYNCED_DEMO",
    isDemoData: true,
    auditHistory: [
      {
        version: 4,
        updatedBy: "Dr. Anjali Menon (Medical Supt.)",
        timestamp: "2026-10-24T14:35:10+05:30",
        action: "PUBLISHED",
        summaryOfChanges: "Updated super-speciality consultation charge to ₹600 as per management circular #2026/18.",
        previousStatus: "DRAFT",
        newStatus: "PUBLISHED",
      },
      {
        version: 3,
        updatedBy: "Mathew George (Admin)",
        timestamp: "2026-08-10T11:15:00+05:30",
        action: "PUBLISHED",
        summaryOfChanges: "Clarified 7-day revisit policy validity rules.",
        previousStatus: "DRAFT",
        newStatus: "PUBLISHED",
      },
    ],
  },
  {
    id: "kb_02",
    title: "Daya General Hospital Profile & Accreditations [DEMO DATA]",
    titleMalayalam: "ദയ ജനറൽ ഹോസ്പിറ്റൽ വിവരങ്ങളും അംഗീകാരങ്ങളും [ഡെമോ]",
    category: "HOSPITAL_INFORMATION",
    summary: "NABH-accredited 300-bed multi-speciality tertiary care hospital located in Thrissur, Kerala.",
    content: `[DEMO DATA - Sample for AI Calling Testing]
1. Overview: Daya General Hospital & Speciality Surgical Centre is a premier 300-bed NABH-accredited multi-speciality hospital in Thrissur.
2. Address: Near State Bank of India, Shornur Road, Thrissur, Kerala - 680022.
3. Key Features: 24/7 Advanced Emergency & Cardiac Care, 7 State-of-the-art Modular Operation Theatres, Level-3 NICU & PICU.
4. Core Values: Compassionate patient-first healthcare, ethical transparent pricing, and clinical excellence.
5. Spoken Languages: Malayalam, English, Hindi, Tamil.`,
    contentMalayalam: `[ഡെമോ ഡാറ്റ]
1. തൃശൂർ ഷോർണൂർ റോഡിൽ സ്ഥിതി ചെയ്യുന്ന 300 കിടക്കകളുള്ള NABH അംഗീകൃത മൾട്ടി-സ്പെഷ്യാലിറ്റി ആശുപത്രിയാണ് ദയ ജനറൽ ഹോസ്പിറ്റൽ.
2. വിലാസം: സ്റ്റേറ്റ് ബാങ്ക് ഓഫ് ഇന്ത്യക്ക് സമീപം, ഷോർണൂർ റോഡ്, തൃശൂർ - 680022.
3. 24 മണിക്കൂറും പ്രവർത്തിക്കുന്ന എമർജൻസി കെയർ, കാർഡിയാക് കെയർ, ആധുനിക ഐസിയു സൗകര്യങ്ങൾ ലഭ്യമാണ്.
4. സംഭാഷണ ഭാഷകൾ: മലയാളം, ഇംഗ്ലീഷ്, ഹിന്ദി, തമിഴ്.`,
    sourceReference: "Daya Quality Manual & NABH Certificate #NABH-2024-0891",
    internalNotes: "Standard institutional overview for telephone inquiries.",
    status: "PUBLISHED",
    version: 2,
    lastUpdatedBy: "Sister Alphonsa (Quality Officer)",
    updatedAt: "2026-09-01T10:00:00+05:30",
    lastPublishedAt: "2026-09-01T10:15:00+05:30",
    lastPublishedBy: "Sister Alphonsa (Quality Officer)",
    publishedContent: `[DEMO DATA - Sample for AI Calling Testing]
1. Overview: Daya General Hospital & Speciality Surgical Centre is a premier 300-bed NABH-accredited multi-speciality hospital in Thrissur.
2. Address: Near State Bank of India, Shornur Road, Thrissur, Kerala - 680022.
3. Key Features: 24/7 Advanced Emergency & Cardiac Care, 7 State-of-the-art Modular Operation Theatres, Level-3 NICU & PICU.`,
    publishedContentMalayalam: `[ഡെമോ ഡാറ്റ] തൃശൂർ ഷോർണൂർ റോഡിൽ സ്ഥിതി ചെയ്യുന്ന 300 കിടക്കകളുള്ള NABH അംഗീകൃത മൾട്ടി-സ്പെഷ്യാലിറ്റി ആശുപത്രിയാണ് ദയ ജനറൽ ഹോസ്പിറ്റൽ.`,
    hasUnpublishedChanges: false,
    syncedToSarvam: false,
    syncStatus: "NOT_SYNCED_DEMO",
    isDemoData: true,
    auditHistory: [
      {
        version: 2,
        updatedBy: "Sister Alphonsa (Quality Officer)",
        timestamp: "2026-09-01T10:15:00+05:30",
        action: "PUBLISHED",
        summaryOfChanges: "Updated latest NABH reaccreditation status.",
      },
    ],
  },
  {
    id: "kb_03",
    title: "Clinical Departments & Speciality Services [DEMO DATA]",
    titleMalayalam: "വിഭാഗങ്ങളും പ്രത്യേക മെഡിക്കൽ സേവനങ്ങളും [ഡെമോ]",
    category: "DEPARTMENTS_SERVICES",
    summary: "24 medical and surgical departments including Cardiology, Orthopaedics, Neurology and Mother & Child Care.",
    content: `[DEMO DATA - Sample for AI Calling Testing]
1. Major Clinical Departments:
   - Cardiology & Interventional Cath Lab
   - Orthopaedics, Joint Replacement & Sports Medicine
   - Paediatrics & Neonatology (Level-3 NICU)
   - Obstetrics & Gynaecology (Comprehensive Mother & Child Centre)
   - General & Laparoscopic Surgery
   - Neurology & Neurosurgery
   - Nephrology & 24/7 Haemodialysis
   - ENT, Head & Neck Surgery
   - Pulmonology & Respiratory Medicine
2. Diagnostic Facilities: 1.5 Tesla MRI, 128-slice CT, 4D Ultrasound, Digital Mammography, 24/7 NABL-accredited Clinical Pathology.
3. Support Services: 24/7 In-house Pharmacy, Blood Storage Centre, Physiotherapy & Rehabilitation.`,
    contentMalayalam: `[ഡെമോ ഡാറ്റ]
1. പ്രധാന വിഭാഗങ്ങൾ: കാർഡിയോളജി, ഓർത്തോപീഡിക്സ്, പീഡിയാട്രിക്സ്, ഗൈനക്കോളജി, ജനറൽ സർജറി, ന്യൂറോളജി, നെഫ്രോളജി (ഡയാലിസിസ്), ഇഎൻടി, ശ്വാസകോശ വിഭാഗം.
2. പരിശോധനാ സൗകര്യങ്ങൾ: എംആർഐ, സിടി സ്കാൻ, അൾട്രാസൗണ്ട്, ഡിജിറ്റൽ എക്സ്-റേ, 24 മണിക്കൂർ ലാബ്.
3. 24 മണിക്കൂർ പ്രവർത്തിക്കുന്ന ഫാർമസിയും ബ്ലഡ് ബാങ്ക് സൗകര്യവും ഉണ്ട്.`,
    sourceReference: "Hospital Service Directory 2026",
    internalNotes: "Verified list of active clinical services for patient phone enquiries.",
    status: "PUBLISHED",
    version: 3,
    lastUpdatedBy: "Dr. Anjali Menon (Medical Supt.)",
    updatedAt: "2026-10-10T11:00:00+05:30",
    lastPublishedAt: "2026-10-10T11:20:00+05:30",
    lastPublishedBy: "Dr. Anjali Menon (Medical Supt.)",
    publishedContent: `[DEMO DATA - Sample for AI Calling Testing]
1. Major Clinical Departments: Cardiology, Orthopaedics, Paediatrics, Gynaecology, Surgery, Neurology, Nephrology, ENT.
2. Diagnostics: MRI, CT, Ultrasound, Digital X-Ray, 24/7 Laboratory.`,
    publishedContentMalayalam: `[ഡെമോ ഡാറ്റ] കാർഡിയോളജി, ഓർത്തോപീഡിക്സ്, പീഡിയാട്രിക്സ്, ഗൈനക്കോളജി, ജനറൽ സർജറി, ന്യൂറോളജി, നെഫ്രോളജി, ഇഎൻടി തുടങ്ങിയ 24 വിഭാഗങ്ങൾ പ്രവർത്തിക്കുന്നു.`,
    hasUnpublishedChanges: false,
    syncedToSarvam: false,
    syncStatus: "NOT_SYNCED_DEMO",
    isDemoData: true,
    auditHistory: [
      {
        version: 3,
        updatedBy: "Dr. Anjali Menon (Medical Supt.)",
        timestamp: "2026-10-10T11:20:00+05:30",
        action: "PUBLISHED",
        summaryOfChanges: "Added new 128-slice CT scanner diagnostic availability.",
      },
    ],
  },
  {
    id: "kb_04",
    title: "Doctor Information & Roster Overview [DEMO DATA]",
    titleMalayalam: "ഡോക്ടർമാരുടെ വിവരങ്ങളും ഒപി സമയക്രമവും [ഡെമോ]",
    category: "DOCTOR_INFORMATION",
    summary: "Senior consultants, OP days and consulting timings across major hospital departments.",
    content: `[DEMO DATA - Sample for AI Calling Testing]
• Cardiology:
  - Dr. K. R. Balakrishnan (MD, DM, Senior Interventional Cardiologist): Mon, Wed, Fri (9:00 AM - 1:00 PM)
  - Dr. Mathew Joseph (MD, DM, Consultant Cardiologist): Tue, Thu, Sat (10:00 AM - 2:00 PM)

• Orthopaedics & Joint Replacement:
  - Dr. Suresh Kumar (MS Ortho, Joint Replacement Surgeon): Mon to Sat (9:30 AM - 1:00 PM)
  - Dr. Praveen Menon (MS Ortho, Arthroscopy & Sports Medicine): Mon to Fri (2:00 PM - 5:00 PM)

• Paediatrics & Child Health:
  - Dr. Radhika Nair (MD Paediatrics): Mon to Sat (9:00 AM - 2:00 PM)
  - Evening Paediatric Clinic: Daily 4:30 PM - 7:00 PM

• Obstetrics & Gynaecology:
  - Dr. Lakshmi Nambiar (MD, DGO, Senior Obstetrician): Mon to Sat (9:00 AM - 1:00 PM)
  - Dr. Sneha Thomas (MS OBG): Mon, Wed, Fri (2:00 PM - 6:00 PM)

• General Medicine & Diabetology:
  - Dr. Anitha Varghese (MD Gen Med): Mon to Sat (9:00 AM - 1:00 PM & 4:00 PM - 7:00 PM)`,
    contentMalayalam: `[ഡെമോ ഡാറ്റ]
• കാർഡിയോളജി: ഡോ. കെ. ആർ. ബാലകൃഷ്ണൻ (തിങ്കൾ, ബുധൻ, വെള്ളി 9 AM - 1 PM), ഡോ. മാത്യു ജോസഫ് (ചൊവ്വ, വ്യാഴം, ശനി 10 AM - 2 PM).
• ഓർത്തോപീഡിക്സ്: ഡോ. സുരേഷ് കുമാർ (തിങ്കൾ - ശനി 9:30 AM - 1 PM), ഡോ. പ്രവീൺ മേനോൻ (തിങ്കൾ - വെള്ളി 2 PM - 5 PM).
• പീഡിയാട്രിക്സ്: ഡോ. രാധിക നായർ (തിങ്കൾ - ശനി 9 AM - 2 PM).
• ഗൈനക്കോളജി: ഡോ. ലക്ഷ്മി നമ്പിയാർ (തിങ്കൾ - ശനി 9 AM - 1 PM).
• 24 മണിക്കൂറും കാഷ്വാലിറ്റിയിൽ ഡ്യൂട്ടി മെഡിക്കൽ ഓഫീസർമാർ ലഭ്യമാണ്.`,
    sourceReference: "Clinical Roster Circular - October 2026",
    internalNotes: "Demonstration roster. AI voice agent must verify live slot availability with HMS before confirming.",
    status: "PUBLISHED",
    version: 5,
    lastUpdatedBy: "Dr. Anjali Menon (Medical Supt.)",
    updatedAt: "2026-10-26T16:00:00+05:30",
    lastPublishedAt: "2026-10-26T16:10:00+05:30",
    lastPublishedBy: "Dr. Anjali Menon (Medical Supt.)",
    publishedContent: `[DEMO DATA - Sample for AI Calling Testing] Doctor consultation schedule for Cardiology, Orthopaedics, Paediatrics and Gynaecology.`,
    publishedContentMalayalam: `[ഡെമോ ഡാറ്റ] പ്രധാന ഒപി ഡോക്ടർമാരുടെ സമയക്രമം.`,
    hasUnpublishedChanges: false,
    syncedToSarvam: false,
    syncStatus: "NOT_SYNCED_DEMO",
    isDemoData: true,
    auditHistory: [
      {
        version: 5,
        updatedBy: "Dr. Anjali Menon (Medical Supt.)",
        timestamp: "2026-10-26T16:10:00+05:30",
        action: "PUBLISHED",
        summaryOfChanges: "Updated Dr. Praveen Menon afternoon sports medicine clinic timings.",
      },
    ],
  },
  {
    id: "kb_05",
    title: "Hospital Timings, OPD Counters & Locations [DEMO DATA]",
    titleMalayalam: "ആശുപത്രി സമയക്രമവും ഒപി കൗണ്ടർ ലൊക്കേഷനുകളും [ഡെമോ]",
    category: "TIMINGS_LOCATIONS",
    summary: "OP registration timings, pharmacy hours, visiting rules and building counter floor plans.",
    content: `[DEMO DATA - Sample for AI Calling Testing]
1. Outpatient (OPD) Timings:
   - Morning OPD: 8:30 AM to 1:00 PM (Monday to Saturday)
   - Evening OPD: 4:00 PM to 7:00 PM (Selected specialities)
   - Sunday OPD: 9:00 AM to 1:00 PM (General Medicine & Paediatrics only)
2. Inpatient Visiting Hours:
   - General Wards: 11:30 AM - 1:00 PM and 4:30 PM - 6:30 PM
   - Intensive Care Units (ICU / CCU): 12:00 PM - 1:00 PM and 5:00 PM - 6:00 PM (1 visitor only)
3. Counter & Department Locations:
   - Ground Floor (Main Block): OP Registration, Billing Counter 1-4, 24/7 Pharmacy, Casualty & Triage
   - 1st Floor: Cardiology, ECG, Echo, Cath Lab, General Medicine, Orthopaedics
   - 2nd Floor: Paediatrics, NICU, Immunization Clinic, Gynaecology & Labour Suites
   - Basement: Radiology (MRI, CT, X-Ray) and Clinical Laboratory sample collection`,
    contentMalayalam: `[ഡെമോ ഡാറ്റ]
1. ഒപി സമയക്രമം: രാവിലെ 8:30 മുതൽ 1:00 വരെ; വൈകുന്നേരം 4:00 മുതൽ 7:00 വരെ. ഞായറാഴ്ച രാവിലെ 9:00 മുതൽ 1:00 വരെ.
2. സന്ദർശന സമയം: ഉച്ചയ്ക്ക് 11:30 - 1:00, വൈകുന്നേരം 4:30 - 6:30.
3. കൗണ്ടറുകൾ: ഗ്രൗണ്ട് ഫ്ലോറിൽ ഒപി രജിസ്ട്രേഷൻ, ബില്ലിംഗ്, 24 മണിക്കൂർ ഫാർമസി, കാഷ്വാലിറ്റി. ഒന്നാം നിലയിൽ കാർഡിയോളജി, ഓർത്തോ. രണ്ടാം നിലയിൽ പീഡിയാട്രിക്സ്, ഗൈനക്കോളജി. ബേസ്മെന്റിൽ ലാബും എക്സ്-റേ, സ്കാനിംഗ് സെന്ററും.`,
    sourceReference: "Patient Experience & Floor Navigation Guide 2026",
    internalNotes: "Ensures AI provides clear counter and floor instructions to callers.",
    status: "PUBLISHED",
    version: 2,
    lastUpdatedBy: "Mathew George (Admin)",
    updatedAt: "2026-09-20T14:00:00+05:30",
    lastPublishedAt: "2026-09-20T14:15:00+05:30",
    lastPublishedBy: "Mathew George (Admin)",
    publishedContent: `[DEMO DATA - Sample for AI Calling Testing] OPD Timings: Morning 8:30 AM - 1:00 PM, Evening 4:00 PM - 7:00 PM. Visiting hours 4:30 PM - 6:30 PM.`,
    publishedContentMalayalam: `[ഡെമോ ഡാറ്റ] ഒപി സമയവും സന്ദർശന സമയവും.`,
    hasUnpublishedChanges: false,
    syncedToSarvam: false,
    syncStatus: "NOT_SYNCED_DEMO",
    isDemoData: true,
    auditHistory: [
      {
        version: 2,
        updatedBy: "Mathew George (Admin)",
        timestamp: "2026-09-20T14:15:00+05:30",
        action: "PUBLISHED",
        summaryOfChanges: "Updated Sunday OPD speciality roster.",
      },
    ],
  },
  {
    id: "kb_06",
    title: "Appointment Booking, Rescheduling & Cancellation Policies [DEMO DATA]",
    titleMalayalam: "അപ്പോയിന്റ്മെന്റ് ബുക്കിംഗ്, റീ-ഷെഡ്യൂളിംഗ് പോളിസികൾ [ഡെമോ]",
    category: "APPOINTMENT_POLICIES",
    summary: "Advance booking windows, cancellation time limits, token allocation and no-show policies.",
    content: `[DEMO DATA - Sample for AI Calling Testing]
1. Advance Booking Window: Patients can book doctor consultations up to 14 days in advance via AI Phone Assistant, Website, or Hospital Desk.
2. Token Allocation: Appointments booked via AI receive a provisional time slot and token number. Patients are advised to arrive 20 minutes prior to token time for registration verification.
3. Rescheduling: Appointments can be rescheduled at least 2 hours before the scheduled slot without penalty.
4. Cancellation: Free cancellation up to 1 hour prior. No advance cancellation fee is charged for telephonic OPD bookings.
5. Revisit Validity: A consultation fee payment is valid for 1 free review with the same doctor within 7 calendar days.
6. Walk-in Policy: Walk-in patients are accommodated based on emergency priority and token availability between advance slots.`,
    contentMalayalam: `[ഡെമോ ഡാറ്റ]
1. അപ്പോയിന്റ്മെന്റ് ബുക്കിംഗ്: 14 ദിവസം മുമ്പ് വരെ ഫോൺ വഴിയോ വെബ്സൈറ്റ് വഴിയോ അപ്പോയിന്റ്മെന്റ് ബുക്ക് ചെയ്യാം.
2. ടോക്കൺ നമ്പർ: ബുക്കിംഗ് കൺഫർമേഷൻ എസ്എംഎസ് വഴി ലഭിക്കും. സമയത്തിന് 20 മിനിറ്റ് മുമ്പ് എത്തേണ്ടതാണ്.
3. റീ-ഷെഡ്യൂളിംഗ് & കാൻസലേഷൻ: സമയം മാറ്റാനോ റദ്ദാക്കാനോ മുൻകൂട്ടി അറിയിക്കാവുന്നതാണ്.
4. 7 ദിവസത്തിനുള്ളിൽ അതേ ഡോക്ടറെ കാണാൻ സൗജന്യ റീവിസിറ്റ് സൗകര്യം ലഭ്യമാണ്.`,
    sourceReference: "OP Policy Document #OP-POL-2026-03",
    internalNotes: "Standard appointment rules enforced by AI voice agent during conversation.",
    status: "PUBLISHED",
    version: 3,
    lastUpdatedBy: "Dr. Anjali Menon (Medical Supt.)",
    updatedAt: "2026-10-15T09:30:00+05:30",
    lastPublishedAt: "2026-10-15T09:45:00+05:30",
    lastPublishedBy: "Dr. Anjali Menon (Medical Supt.)",
    publishedContent: `[DEMO DATA - Sample for AI Calling Testing] Advance booking window: 14 days. Rescheduling allowed up to 2 hours prior. 7 days revisit validity.`,
    publishedContentMalayalam: `[ഡെമോ ഡാറ്റ] അപ്പോയിന്റ്മെന്റ് ബുക്കിംഗ് നിയമങ്ങൾ.`,
    hasUnpublishedChanges: false,
    syncedToSarvam: false,
    syncStatus: "NOT_SYNCED_DEMO",
    isDemoData: true,
    auditHistory: [
      {
        version: 3,
        updatedBy: "Dr. Anjali Menon (Medical Supt.)",
        timestamp: "2026-10-15T09:45:00+05:30",
        action: "PUBLISHED",
        summaryOfChanges: "Clarified token arrival buffer recommendation (20 mins prior).",
      },
    ],
  },
  {
    id: "kb_07",
    title: "Frequently Asked Patient Questions (FAQs) [DEMO DATA]",
    titleMalayalam: "പതിവായി ചോദിക്കുന്ന ചോദ്യങ്ങൾ (FAQs) [ഡെമോ]",
    category: "FAQS",
    summary: "Common patient queries regarding lab reports online, parking, bystander passes and discharge.",
    content: `[DEMO DATA - Sample for AI Calling Testing]
1. How do I download my blood test / diagnostic reports online?
   - Reports can be accessed via the Daya Patient Portal or sent via WhatsApp to the registered mobile number within 24 hours of sample collection.
2. Can I get a bystander pass for ICU patients?
   - In ICU, only 1 authorized bystander is permitted outside the unit with an issued security pass.
3. Is car parking available on campus?
   - Yes, free multi-level parking is available behind the Main Diagnostic Block with 24-hour security.
4. What documents are needed for cashless insurance admission?
   - Patient Aadhaar Card, Active TPA Health Card, and Doctor's Admission Advice slip.
5. What are the discharge clearance timings?
   - Standard IP discharges are processed between 11:00 AM and 2:00 PM daily.`,
    contentMalayalam: `[ഡെമോ ഡാറ്റ]
1. ലാബ് റിപ്പോർട്ടുകൾ എങ്ങനെ ലഭിക്കും? രജിസ്റ്റർ ചെയ്ത മൊബൈൽ നമ്പറിലേക്ക് വാട്സാപ്പ് വഴിയോ ഹോസ്പിറ്റൽ പോർട്ടൽ വഴിയോ റിപ്പോർട്ടുകൾ ലഭിക്കും.
2. പാർക്കിംഗ് സൗകര്യമുണ്ടോ? അതെ, ആശുപത്രി ക്യാമ്പസിൽ സൗജന്യ പാർക്കിംഗ് സൗകര്യമുണ്ട്.
3. ഇൻഷുറൻസിന് എന്ത് രേഖകൾ വേണം? ആധാർ കാർഡ്, ഹെൽത്ത് ഇൻഷുറൻസ് കാർഡ്, ഡോക്ടറുടെ പ്രിസ്ക്രിപ്ഷൻ.`,
    sourceReference: "Hospital Public Relations Desk FAQ manual",
    internalNotes: "Standard answers for frequent telephone inquiries.",
    status: "DRAFT",
    version: 1,
    lastUpdatedBy: "Mathew George (Admin)",
    updatedAt: "2026-10-25T11:00:00+05:30",
    hasUnpublishedChanges: true,
    syncedToSarvam: false,
    syncStatus: "NOT_SYNCED_DEMO",
    isDemoData: true,
    auditHistory: [
      {
        version: 1,
        updatedBy: "Mathew George (Admin)",
        timestamp: "2026-10-25T11:00:00+05:30",
        action: "CREATED",
        summaryOfChanges: "Created new Draft FAQ article for patient self-service queries.",
        newStatus: "DRAFT",
      },
    ],
  },
  {
    id: "kb_08",
    title: "Emergency Casualty, Ambulance & Escalation Directory [DEMO DATA]",
    titleMalayalam: "24 മണിക്കൂർ എമർജൻസി, ആംബുലൻസ്, എസ്കലേഷൻ വിവരങ്ങൾ [ഡെമോ]",
    category: "CONTACT_ESCALATION",
    summary: "24/7 Casualty Hotline, ICU ambulance dispatch, Duty Medical Officer and urgent clinical escalation policies.",
    content: `[DEMO DATA - Sample for AI Calling Testing]
1. 24x7 Emergency Casualty Helpline:
   - Primary Telephone: 0487 2475000 (Extension 100)
   - Direct Casualty Line: 0487 2475100
2. Advanced Cardiac Life Support (ACLS) Ambulance Dispatch:
   - Mobile: +91 94470 12345
   - Equipped with portable ventilator, defibrillator, oxygen and trained paramedic.
3. Critical Escalation Protocol:
   - For chest pain, stroke symptoms, severe breathing difficulty, profuse bleeding, or acute trauma: AI Assistant must immediately advise the caller to proceed to Casualty or connect to Extension 100 without attempting appointment booking.
4. Administrative Escalation & Patient Relations:
   - Public Relations Officer (PRO): Extension 150 (8:30 AM to 8:00 PM)
   - Night Duty Administrative Officer: Extension 105 (8:00 PM to 8:30 AM)
   - TPA / Insurance Helpdesk: Extension 204`,
    contentMalayalam: `[ഡെമോ ഡാറ്റ]
1. ദയ 24 മണിക്കൂർ എമർജൻസി കാഷ്വാലിറ്റി ഫോൺ: 0487 2475000 (എക്സ്റ്റൻഷൻ 100) / 0487 2475100.
2. ആംബുലൻസ് അടിയന്തിര നമ്പർ: +91 94470 12345 (വെന്റിലേറ്റർ സൗകര്യമുള്ള ഐസിയു ആംബുലൻസ്).
3. നെഞ്ചുവേദനയോ പക്ഷാഘാത ലക്ഷണങ്ങളോ ഗുരുതരമായ ശ്വാസതടസ്സമോ ഉണ്ടായാൽ ഉടൻ കാഷ്വാലിറ്റിയിൽ എത്തുക അല്ലെങ്കിൽ 100-ലേക്ക് വിളിക്കുക.
4. പേഷ്യന്റ് റിലേഷൻസ് ഓഫീസർ (PRO): എക്സ്റ്റൻഷൻ 150.`,
    sourceReference: "Daya Hospital Disaster & Emergency Response SOP #EM-01",
    internalNotes: "CRITICAL: Under no circumstances should AI guess emergency advice. Must quote approved numbers.",
    status: "PUBLISHED",
    version: 4,
    lastUpdatedBy: "Dr. Anjali Menon (Medical Supt.)",
    updatedAt: "2026-10-27T08:00:00+05:30",
    lastPublishedAt: "2026-10-27T08:15:00+05:30",
    lastPublishedBy: "Dr. Anjali Menon (Medical Supt.)",
    publishedContent: `[DEMO DATA - Sample for AI Calling Testing]
1. 24x7 Casualty Helpline: 0487 2475000 / Ext 100
2. ACLS Ambulance: +91 94470 12345
3. Emergency protocol: Immediate transfer to Casualty for severe acute symptoms.`,
    publishedContentMalayalam: `[ഡെമോ ഡാറ്റ] 24 മണിക്കൂർ എമർജൻസി നമ്പർ: 0487 2475000 (Ext 100). ആംബുലൻസ്: +91 94470 12345.`,
    hasUnpublishedChanges: false,
    syncedToSarvam: false,
    syncStatus: "NOT_SYNCED_DEMO",
    isDemoData: true,
    auditHistory: [
      {
        version: 4,
        updatedBy: "Dr. Anjali Menon (Medical Supt.)",
        timestamp: "2026-10-27T08:15:00+05:30",
        action: "PUBLISHED",
        summaryOfChanges: "Reconfirmed direct casualty line and emergency escalation numbers.",
      },
    ],
  },
  {
    id: "kb_09",
    title: "Seasonal Monsoon Fever Triage Protocol (2025) [DEMO DATA]",
    titleMalayalam: "മൺസൂൺ പനി പരിശോധനാ പ്രോട്ടോക്കോൾ 2025 [ഡെമോ]",
    category: "HOSPITAL_INFORMATION",
    summary: "Temporary 2025 Dengue and Leptospirosis epidemic screening protocol, now archived.",
    content: `[DEMO DATA - Sample for AI Calling Testing]
Special monsoon fever triage counter was located at Ground Floor Counter 6. Protocol concluded on 31-Dec-2025. Standard General Medicine OPD now handles all seasonal viral fever inquiries.`,
    contentMalayalam: `[ഡെമോ ഡാറ്റ] 2025 ലെ പ്രത്യേക പനി ക്ലിനിക് പ്രോട്ടോക്കോൾ. നിലവിൽ കാലാവധി കഴിഞ്ഞതിനാൽ ആർക്കൈവ് ചെയ്തിരിക്കുന്നു.`,
    sourceReference: "District Medical Office Circular #DMO/2025/44",
    internalNotes: "Archived after monsoon season ended. Preserved for clinical audit history.",
    status: "ARCHIVED",
    version: 2,
    lastUpdatedBy: "Dr. Anjali Menon (Medical Supt.)",
    updatedAt: "2026-01-05T10:00:00+05:30",
    lastPublishedAt: "2025-07-01T09:00:00+05:30",
    lastPublishedBy: "Dr. Anjali Menon (Medical Supt.)",
    publishedContent: `[DEMO DATA] Monsoon Fever Clinic Protocol 2025.`,
    hasUnpublishedChanges: false,
    syncedToSarvam: false,
    syncStatus: "NOT_SYNCED_DEMO",
    isDemoData: true,
    auditHistory: [
      {
        version: 2,
        updatedBy: "Dr. Anjali Menon (Medical Supt.)",
        timestamp: "2026-01-05T10:00:00+05:30",
        action: "ARCHIVED",
        summaryOfChanges: "Archived protocol following conclusion of seasonal monitoring period.",
        previousStatus: "PUBLISHED",
        newStatus: "ARCHIVED",
      },
    ],
  },
];

export interface CreateArticleInput {
  title: string;
  titleMalayalam?: string;
  category: KnowledgeCategory;
  summary: string;
  content: string;
  contentMalayalam?: string;
  sourceReference?: string;
  internalNotes?: string;
  status?: KnowledgeStatus;
}

export interface UpdateArticleInput {
  title?: string;
  titleMalayalam?: string;
  category?: KnowledgeCategory;
  summary?: string;
  content?: string;
  contentMalayalam?: string;
  sourceReference?: string;
  internalNotes?: string;
}

class KnowledgeService {
  private articles: KnowledgeArticle[] = [];

  constructor() {
    this.resetToMockData();
  }

  resetToMockData(): void {
    this.articles = JSON.parse(JSON.stringify(INITIAL_KNOWLEDGE_ARTICLES));
  }

  getArticles(params?: {
    query?: string;
    category?: string;
    status?: string;
    syncStatus?: string;
  }): KnowledgeArticle[] {
    let result = [...this.articles];

    if (params?.query && params.query.trim()) {
      const q = params.query.trim().toLowerCase();
      result = result.filter(
        (art) =>
          art.title.toLowerCase().includes(q) ||
          art.titleMalayalam.toLowerCase().includes(q) ||
          art.summary.toLowerCase().includes(q) ||
          art.content.toLowerCase().includes(q) ||
          (art.contentMalayalam && art.contentMalayalam.toLowerCase().includes(q)) ||
          (art.sourceReference && art.sourceReference.toLowerCase().includes(q))
      );
    }

    if (params?.category && params.category !== "ALL") {
      result = result.filter((art) => art.category === params.category);
    }

    if (params?.status && params.status !== "ALL") {
      result = result.filter((art) => art.status === params.status);
    }

    if (params?.syncStatus && params.syncStatus !== "ALL") {
      result = result.filter((art) => art.syncStatus === params.syncStatus);
    }

    // Sort by updatedAt descending
    return result.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  getArticleById(id: string): KnowledgeArticle | undefined {
    return this.articles.find((art) => art.id === id);
  }

  createArticle(
    input: CreateArticleInput,
    authorName = "Hospital Content Editor"
  ): KnowledgeArticle {
    const now = new Date().toISOString();
    const id = `kb_${Date.now().toString().slice(-6)}`;
    const status = input.status || "DRAFT";

    const newArticle: KnowledgeArticle = {
      id,
      title: input.title,
      titleMalayalam: input.titleMalayalam || input.title,
      category: input.category,
      summary: input.summary,
      content: input.content,
      contentMalayalam: input.contentMalayalam,
      sourceReference: input.sourceReference,
      internalNotes: input.internalNotes,
      status,
      version: 1,
      lastUpdatedBy: authorName,
      updatedAt: now,
      lastPublishedAt: status === "PUBLISHED" ? now : undefined,
      lastPublishedBy: status === "PUBLISHED" ? authorName : undefined,
      publishedContent: status === "PUBLISHED" ? input.content : undefined,
      publishedContentMalayalam: status === "PUBLISHED" ? input.contentMalayalam : undefined,
      hasUnpublishedChanges: false,
      syncedToSarvam: false,
      syncStatus: "NOT_SYNCED_DEMO",
      isDemoData: true,
      auditHistory: [
        {
          version: 1,
          updatedBy: authorName,
          timestamp: now,
          action: "CREATED",
          summaryOfChanges: input.internalNotes || "Initial article creation.",
          newStatus: status,
        },
      ],
    };

    this.articles.unshift(newArticle);
    return newArticle;
  }

  /**
   * Safe Draft Editing:
   * Editing an existing article does NOT silently overwrite the live published version.
   * If the article is currently PUBLISHED, changes are saved as pending draft modifications,
   * marking `hasUnpublishedChanges: true`. The live publishedContent remains unchanged
   * until an explicit, authorized publish action is taken.
   */
  updateDraft(
    id: string,
    input: UpdateArticleInput,
    authorName = "Hospital Content Editor"
  ): KnowledgeArticle {
    const index = this.articles.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new Error(`Knowledge article with ID ${id} not found.`);
    }

    const current = this.articles[index];
    const now = new Date().toISOString();
    const isCurrentlyPublished = current.status === "PUBLISHED";

    const updated: KnowledgeArticle = {
      ...current,
      title: input.title ?? current.title,
      titleMalayalam: input.titleMalayalam ?? current.titleMalayalam,
      category: input.category ?? current.category,
      summary: input.summary ?? current.summary,
      content: input.content ?? current.content,
      contentMalayalam: input.contentMalayalam ?? current.contentMalayalam,
      sourceReference: input.sourceReference ?? current.sourceReference,
      internalNotes: input.internalNotes ?? current.internalNotes,
      updatedAt: now,
      lastUpdatedBy: authorName,
      // If currently published, flag that unapproved draft changes exist; do not overwrite publishedContent!
      hasUnpublishedChanges: isCurrentlyPublished ? true : current.hasUnpublishedChanges,
      auditHistory: [
        {
          version: current.version,
          updatedBy: authorName,
          timestamp: now,
          action: "EDITED_DRAFT",
          summaryOfChanges:
            input.internalNotes ||
            (isCurrentlyPublished
              ? `Saved draft revisions. Live v${current.version} remains active in voice grounding until publication.`
              : `Draft content updated.`),
          previousStatus: current.status,
          newStatus: current.status,
        },
        ...current.auditHistory,
      ],
    };

    this.articles[index] = updated;
    return updated;
  }

  /**
   * Authorized Publication:
   * Promotes the edited draft content to the active published version.
   * Increments version number, logs an audit entry, updates lastPublishedAt,
   * and clears hasUnpublishedChanges.
   */
  publishArticle(
    id: string,
    authorName = "Dr. Anjali Menon (Authorized Medical Reviewer)",
    changeNote?: string
  ): KnowledgeArticle {
    const index = this.articles.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new Error(`Knowledge article with ID ${id} not found.`);
    }

    const current = this.articles[index];
    const now = new Date().toISOString();
    const nextVersion = current.version + 1;

    const published: KnowledgeArticle = {
      ...current,
      status: "PUBLISHED",
      version: nextVersion,
      publishedContent: current.content,
      publishedContentMalayalam: current.contentMalayalam,
      lastPublishedAt: now,
      lastPublishedBy: authorName,
      updatedAt: now,
      lastUpdatedBy: authorName,
      hasUnpublishedChanges: false,
      syncedToSarvam: false,
      syncStatus: "NOT_SYNCED_DEMO",
      auditHistory: [
        {
          version: nextVersion,
          updatedBy: authorName,
          timestamp: now,
          action: "PUBLISHED",
          summaryOfChanges:
            changeNote ||
            `Authorized publication of version ${nextVersion}. Active in hospital grounding context.`,
          previousStatus: current.status,
          newStatus: "PUBLISHED",
        },
        ...current.auditHistory,
      ],
    };

    this.articles[index] = published;
    return published;
  }

  /**
   * Archive Article:
   * Removes article from active voice grounding and marks it ARCHIVED.
   */
  archiveArticle(
    id: string,
    authorName = "Hospital Content Editor",
    reason?: string
  ): KnowledgeArticle {
    const index = this.articles.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new Error(`Knowledge article with ID ${id} not found.`);
    }

    const current = this.articles[index];
    const now = new Date().toISOString();

    const archived: KnowledgeArticle = {
      ...current,
      status: "ARCHIVED",
      hasUnpublishedChanges: false,
      updatedAt: now,
      lastUpdatedBy: authorName,
      auditHistory: [
        {
          version: current.version,
          updatedBy: authorName,
          timestamp: now,
          action: "ARCHIVED",
          summaryOfChanges: reason || "Archived article from active voice assistant grounding.",
          previousStatus: current.status,
          newStatus: "ARCHIVED",
        },
        ...current.auditHistory,
      ],
    };

    this.articles[index] = archived;
    return archived;
  }

  /**
   * Synchronise knowledge base with Sarvam AI voice agent.
   * Clearly delegates to sarvamKnowledgeSync adapter.
   * When in Demo Mode, returns NOT_SYNCED_DEMO and never claims false success.
   */
  async syncWithSarvam(): Promise<SarvamSyncResult> {
    const result = await sarvamKnowledgeSync.syncApprovedArticles(this.articles);
    const now = new Date().toISOString();

    if (result.synced) {
      this.articles = this.articles.map((art) =>
        art.status === "PUBLISHED"
          ? {
              ...art,
              syncedToSarvam: true,
              syncStatus: "SYNCED",
              lastSyncedAt: now,
            }
          : art
      );
    } else {
      // In demo mode, mark syncStatus as NOT_SYNCED_DEMO
      this.articles = this.articles.map((art) => ({
        ...art,
        syncedToSarvam: false,
        syncStatus: "NOT_SYNCED_DEMO",
        lastSyncedAt: now,
      }));
    }

    return result;
  }
}

export const knowledgeService = new KnowledgeService();
