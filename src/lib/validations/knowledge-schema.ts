import { z } from "zod";

export const KNOWLEDGE_CATEGORY_CONFIG: Record<
  string,
  { label: string; labelMalayalam: string; description: string; badgeColor: string }
> = {
  HOSPITAL_INFORMATION: {
    label: "Hospital Information",
    labelMalayalam: "ആശുപത്രി വിവരങ്ങൾ",
    description: "General background, accreditations, NABH standards, campus overview",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
  DEPARTMENTS_SERVICES: {
    label: "Departments & Services",
    labelMalayalam: "വിഭാഗങ്ങളും സേവനങ്ങളും",
    description: "Clinical specialities, diagnostics, ICU, dialysis, pharmacy",
    badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
  },
  DOCTOR_INFORMATION: {
    label: "Doctor Information",
    labelMalayalam: "ഡോക്ടർ വിവരങ്ങൾ",
    description: "Consultant profiles, specialisations, OPD schedules",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  CONSULTATION_FEES: {
    label: "Consultation & Registration Fees",
    labelMalayalam: "കൺസൾട്ടേഷൻ & ഒപി ഫീസ്",
    description: "OP registration fees, doctor consultation charges, revisit validity",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  TIMINGS_LOCATIONS: {
    label: "Hospital Timings & Locations",
    labelMalayalam: "സമയക്രമവും ലൊക്കേഷനുകളും",
    description: "OPD hours, IP visiting slots, counter locations, building floors",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
  },
  APPOINTMENT_POLICIES: {
    label: "Appointment Policies",
    labelMalayalam: "അപ്പോയിന്റ്മെന്റ് പോളിസികൾ",
    description: "Booking window, cancellation, rescheduling, walk-in tokens",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
  },
  FAQS: {
    label: "Frequently Asked Questions",
    labelMalayalam: "പതിവു ചോദ്യങ്ങൾ (FAQs)",
    description: "Patient queries, lab report collection, bystander guidelines",
    badgeColor: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  CONTACT_ESCALATION: {
    label: "Contact & Escalation Information",
    labelMalayalam: "ബന്ധപ്പെടേണ്ട വിവരങ്ങൾ & എസ്കലേഷൻ",
    description: "24/7 casualty hotline, ambulance dispatch, PRO desk, clinical escalation",
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
  },
  // Legacy aliases
  DEPARTMENTS: {
    label: "Departments (Legacy)",
    labelMalayalam: "വിഭാഗങ്ങൾ",
    description: "Clinical departments",
    badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
  },
  DOCTORS_SCHEDULE: {
    label: "Doctors Schedule (Legacy)",
    labelMalayalam: "ഡോക്ടർമാരുടെ സമയം",
    description: "OPD schedules",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  FEES_CHARGES: {
    label: "Fees & Charges (Legacy)",
    labelMalayalam: "ഫീസ് നിരക്കുകൾ",
    description: "Fees and charges",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  HOSPITAL_POLICIES: {
    label: "Hospital Policies (Legacy)",
    labelMalayalam: "ആശുപത്രി നിയമങ്ങൾ",
    description: "Hospital policies",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
  },
  EMERGENCY_AMBULANCE: {
    label: "Emergency & Ambulance (Legacy)",
    labelMalayalam: "അടിയന്തിര സേവനങ്ങൾ",
    description: "Casualty and ambulance",
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
  },
  INSURANCE_TPA: {
    label: "Insurance & TPA (Legacy)",
    labelMalayalam: "ഇൻഷുറൻസ്",
    description: "Cashless insurance and TPA",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
};

export const CATEGORY_OPTIONS = [
  { value: "HOSPITAL_INFORMATION", label: "Hospital Information (ആശുപത്രി വിവരങ്ങൾ)" },
  { value: "DEPARTMENTS_SERVICES", label: "Departments & Services (വിഭാഗങ്ങളും സേവനങ്ങളും)" },
  { value: "DOCTOR_INFORMATION", label: "Doctor Information (ഡോക്ടർ വിവരങ്ങൾ)" },
  { value: "CONSULTATION_FEES", label: "Consultation & Registration Fees (ഫീസ് വിവരങ്ങൾ)" },
  { value: "TIMINGS_LOCATIONS", label: "Hospital Timings & Locations (സമയക്രമവും ലൊക്കേഷനും)" },
  { value: "APPOINTMENT_POLICIES", label: "Appointment Policies (അപ്പോയിന്റ്മെന്റ് പോളിസികൾ)" },
  { value: "FAQS", label: "Frequently Asked Questions (പതിവു ചോദ്യങ്ങൾ)" },
  { value: "CONTACT_ESCALATION", label: "Contact & Escalation Information (എസ്കലേഷൻ & കോൺടാക്റ്റ്)" },
] as const;

export const knowledgeFormSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(140, "Title must not exceed 140 characters"),
  titleMalayalam: z.string().optional().default(""),
  category: z.string().min(1, "Please select an approved category"),
  summary: z
    .string()
    .min(5, "Summary must be at least 5 characters for clinical indexing")
    .max(300, "Summary must not exceed 300 characters"),
  content: z
    .string()
    .min(10, "Approved English content guidelines must be at least 10 characters"),
  contentMalayalam: z.string().optional().default(""),
  sourceReference: z.string().max(120, "Reference must be under 120 characters").optional().default(""),
  internalNotes: z
    .string()
    .min(3, "Mandatory change/audit note required for regulatory hospital provenance")
    .max(250, "Audit note must not exceed 250 characters"),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED", "UNDER_REVIEW"]).default("DRAFT"),
});

export type KnowledgeFormData = z.infer<typeof knowledgeFormSchema>;
