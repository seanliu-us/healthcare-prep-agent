import type { OfficeSummary } from "./types";

/**
 * Patient Outreach Kit — turns an OfficeSummary into office-ready artifacts:
 * a patient SMS, a confirmation email, a "what to bring" checklist, and an
 * internal payer-verification call script. Generated deterministically so it
 * always works (no API key required); optionally refined by the LLM.
 */
export interface Outreach {
  sms: string;
  emailSubject: string;
  emailBody: string;
  checklist: string[];
  callScript: string[];
}

const ACRONYMS = new Set(["MRI", "CT", "PET", "EKG", "ECG", "US", "XRAY", "DEXA", "CBC"]);

export function readableProcedure(code: string): string {
  return code
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .map((word) => {
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function formatDate(iso: string): string {
  if (!iso) return "your upcoming appointment";
  // Treat bare YYYY-MM-DD as a local calendar date (avoid UTC off-by-one).
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function buildOutreach(s: OfficeSummary): Outreach {
  const proc = readableProcedure(s.procedureCode);
  const when = formatDate(s.appointmentDate);
  const fname = firstName(s.patientName);
  const paRequired = s.priorAuthorization.likelyRequired;

  // Patient-friendly prior-auth line (no jargon).
  const paPatientLine = paRequired
    ? `Your ${s.insuranceCarrier} plan may require pre-approval for this visit. Our team is handling that for you — we'll only reach out if we need anything.`
    : `Pre-approval typically isn't required for this visit, but we'll confirm your benefits before you arrive.`;

  // What to bring.
  const checklist = [
    `Your ${s.insuranceCarrier} insurance card`,
    "A photo ID",
    paRequired ? "Any referral or prior-authorization paperwork you've received" : null,
    "A list of your current medications",
    s.estimatedPatientCost
      ? `A payment method (estimated patient cost: ${s.estimatedPatientCost})`
      : "A payment method for any copay or coinsurance",
    ...s.patientPrepInstructions.slice(0, 3),
  ].filter((x): x is string => Boolean(x));

  // SMS — short and warm.
  const prepOneLiner = s.patientPrepInstructions[0]
    ? ` ${s.patientPrepInstructions[0].replace(/\.$/, "")}.`
    : "";
  const sms =
    `Hi ${fname}, this is your care team confirming your ${proc} on ${when}. ` +
    `Please bring your ${s.insuranceCarrier} insurance card and a photo ID.${prepOneLiner} ` +
    `Reply here with any questions — see you soon!`;

  // Email.
  const emailSubject = `Getting ready for your ${proc} on ${when}`;
  const emailBody = [
    `Hi ${fname},`,
    "",
    `We're looking forward to seeing you for your ${proc} on ${when}. Here's everything you need to be ready:`,
    "",
    "What to bring:",
    ...checklist.map((c) => `  • ${c}`),
    "",
    ...(s.patientPrepInstructions.length
      ? ["Before your visit:", ...s.patientPrepInstructions.map((p) => `  • ${p}`), ""]
      : []),
    "Insurance:",
    `  ${paPatientLine}`,
    "",
    ...(s.questionsForPatient.length
      ? [
          "A few things we may ask when you arrive (no need to prepare answers in advance):",
          ...s.questionsForPatient.slice(0, 4).map((q) => `  • ${q}`),
          "",
        ]
      : []),
    "If you have any questions or need to reschedule, just reply to this email or give us a call.",
    "",
    "Warm regards,",
    "Your Care Team",
  ].join("\n");

  // Internal payer-verification call script.
  const callScript = [
    `Call ${s.insuranceCarrier} provider services (or use the provider portal) to verify benefits for ${s.patientName}.`,
    `Confirm member eligibility and that coverage is active on ${formatDate(s.appointmentDate)}.`,
    `Verify benefits and coverage for ${s.procedureCode} (${proc}).`,
    paRequired
      ? `Confirm prior authorization requirements (flagged ${s.priorAuthorization.risk} risk)${
          s.priorAuthorization.requirements.length
            ? `; have ready: ${s.priorAuthorization.requirements.join(", ")}`
            : ""
        }.`
      : `Confirm whether prior authorization is required (currently assessed as not typically required).`,
    `Capture the patient's cost share: deductible remaining, coinsurance, and copay.`,
    ...s.coverageConsiderations.slice(0, 2).map((c) => `Note: ${c}`),
    `Document the reference number and rep name in the patient record.`,
  ];

  return { sms, emailSubject, emailBody, checklist, callScript };
}
