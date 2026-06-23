import type { ProcedureRecord } from "@/lib/types";

/**
 * Mock procedure catalog that backs the Source 1 JSON API
 * (`/api/procedures/[code]`). In a real deployment this would be an EHR /
 * charge-master service or a public CPT lookup; the shape mirrors what such an
 * API would return.
 */
export const PROCEDURE_CATALOG: Record<string, ProcedureRecord> = {
  MRI_KNEE: {
    procedureCode: "MRI_KNEE",
    cptCode: "73721",
    description: "MRI of the knee without contrast",
    category: "Diagnostic Imaging",
    modality: "MRI",
    bodyPart: "Knee",
    usesContrast: false,
    estimatedDurationMinutes: 45,
    typicalPriorAuthRequired: true,
    commonIndications: [
      "Persistent knee pain after conservative treatment",
      "Suspected meniscus or ligament (ACL/MCL) tear",
      "Unexplained joint effusion or locking",
    ],
    patientPrepSummary:
      "No fasting required. Remove all metal objects. Screen for pacemakers, implants, or prior metal injury to the eye.",
    averageCostUsdRange: [700, 2000],
  },
  MRI_BRAIN: {
    procedureCode: "MRI_BRAIN",
    cptCode: "70551",
    description: "MRI of the brain without contrast",
    category: "Diagnostic Imaging",
    modality: "MRI",
    bodyPart: "Brain",
    usesContrast: false,
    estimatedDurationMinutes: 50,
    typicalPriorAuthRequired: true,
    commonIndications: ["Chronic headaches", "Seizure work-up", "Suspected stroke or mass"],
    patientPrepSummary:
      "No fasting required. Remove metal objects and screen for implants. Notify if claustrophobic.",
    averageCostUsdRange: [1000, 3000],
  },
  CT_ABDOMEN: {
    procedureCode: "CT_ABDOMEN",
    cptCode: "74177",
    description: "CT of the abdomen and pelvis with contrast",
    category: "Diagnostic Imaging",
    modality: "CT",
    bodyPart: "Abdomen/Pelvis",
    usesContrast: true,
    estimatedDurationMinutes: 30,
    typicalPriorAuthRequired: true,
    commonIndications: ["Abdominal pain", "Suspected appendicitis", "Cancer staging"],
    patientPrepSummary:
      "Fast 4 hours before exam. Confirm renal function (eGFR) for contrast. Screen for contrast allergy.",
    averageCostUsdRange: [500, 1500],
  },
  COLONOSCOPY: {
    procedureCode: "COLONOSCOPY",
    cptCode: "45378",
    description: "Diagnostic colonoscopy",
    category: "Endoscopy",
    modality: "Endoscopy",
    bodyPart: "Colon",
    usesContrast: false,
    estimatedDurationMinutes: 60,
    typicalPriorAuthRequired: false,
    commonIndications: ["Colorectal cancer screening", "Rectal bleeding", "Chronic diarrhea"],
    patientPrepSummary:
      "Full bowel prep the day before. Clear liquid diet. Arrange a driver for after sedation.",
    averageCostUsdRange: [1000, 3500],
  },
  ECHO_TTE: {
    procedureCode: "ECHO_TTE",
    cptCode: "93306",
    description: "Transthoracic echocardiogram with Doppler",
    category: "Cardiology",
    modality: "Ultrasound",
    bodyPart: "Heart",
    usesContrast: false,
    estimatedDurationMinutes: 45,
    typicalPriorAuthRequired: false,
    commonIndications: ["Heart murmur", "Shortness of breath", "Suspected heart failure"],
    patientPrepSummary: "No special preparation. Wear a two-piece outfit for chest access.",
    averageCostUsdRange: [300, 1200],
  },
  PT_EVAL: {
    procedureCode: "PT_EVAL",
    cptCode: "97162",
    description: "Physical therapy evaluation, moderate complexity",
    category: "Rehabilitation",
    modality: "Therapy",
    bodyPart: "Musculoskeletal",
    usesContrast: false,
    estimatedDurationMinutes: 60,
    typicalPriorAuthRequired: true,
    commonIndications: ["Post-surgical rehab", "Chronic musculoskeletal pain", "Mobility deficits"],
    patientPrepSummary: "Wear comfortable clothing. Bring referral and a list of current medications.",
    averageCostUsdRange: [100, 350],
  },
};

export function getProcedure(code: string): ProcedureRecord | undefined {
  if (!code) return undefined;
  return PROCEDURE_CATALOG[code.trim().toUpperCase()];
}

export function listProcedureCodes(): string[] {
  return Object.keys(PROCEDURE_CATALOG);
}

/**
 * Synthesize a best-effort record for an unknown code so the agent degrades
 * gracefully instead of failing hard — a realistic requirement for an office
 * tool that will inevitably encounter codes outside its seed catalog.
 */
export function synthesizeProcedure(code: string): ProcedureRecord {
  const normalized = code.trim().toUpperCase();
  const guessModality = normalized.includes("MRI")
    ? "MRI"
    : normalized.includes("CT")
      ? "CT"
      : normalized.includes("XR") || normalized.includes("XRAY")
        ? "X-Ray"
        : "Unknown";
  return {
    procedureCode: normalized,
    cptCode: "UNKNOWN",
    description: `Unrecognized procedure code "${normalized}"`,
    category: "Unknown",
    modality: guessModality,
    bodyPart: "Unknown",
    usesContrast: false,
    estimatedDurationMinutes: 30,
    typicalPriorAuthRequired: guessModality === "MRI" || guessModality === "CT",
    commonIndications: [],
    patientPrepSummary:
      "Procedure not found in catalog. Manually confirm prep instructions and coding before the visit.",
    averageCostUsdRange: [0, 0],
  };
}
