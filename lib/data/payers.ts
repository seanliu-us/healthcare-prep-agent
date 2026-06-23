import type { SearchResult } from "@/lib/types";

/**
 * Curated payer knowledge base used by the search tool's offline fallback.
 *
 * When a live search provider (Tavily / Brave) is configured the agent uses it
 * for real-time research. When no key is present, the search tool synthesizes
 * realistic, source-attributed results from this knowledge base so the demo is
 * fully functional offline. All content here is general, synthetic guidance —
 * not a substitute for a payer's live policy bulletin.
 */

interface PayerProfile {
  name: string;
  aliases: string[];
  priorAuthVendor?: string;
  portal: string;
  generalPriorAuth: string[];
  imagingPriorAuth: string[];
  documentationNeeded: string[];
  coverageNotes: string[];
}

const PAYERS: PayerProfile[] = [
  {
    name: "Aetna",
    aliases: ["aetna"],
    priorAuthVendor: "Aetna uses eviCore / Carelon for advanced imaging review",
    portal: "Availity provider portal",
    generalPriorAuth: [
      "Advanced imaging (MRI, CT, PET) generally requires prior authorization through Aetna's radiology benefits manager.",
      "Submit requests via Availity; expect 1-3 business day turnaround for standard review.",
    ],
    imagingPriorAuth: [
      "Document failed conservative treatment (typically 4-6 weeks) before approving musculoskeletal MRI.",
      "Include relevant prior imaging (e.g., X-ray) and clinical notes supporting medical necessity.",
    ],
    documentationNeeded: [
      "Ordering provider NPI and clinical notes",
      "ICD-10 diagnosis supporting medical necessity",
      "Conservative treatment history (PT, NSAIDs, rest)",
    ],
    coverageNotes: [
      "Verify the imaging center is in-network to avoid out-of-network cost share.",
      "Confirm member deductible status; high-deductible plans may leave large patient responsibility.",
    ],
  },
  {
    name: "UnitedHealthcare",
    aliases: ["unitedhealthcare", "united healthcare", "uhc", "united"],
    priorAuthVendor: "UnitedHealthcare uses its own advanced imaging notification/prior auth program",
    portal: "UHC Provider Portal (UnitedHealthcare Provider)",
    generalPriorAuth: [
      "Outpatient advanced imaging usually requires prior authorization or advance notification.",
      "Use the UHC provider portal's prior authorization & notification tool to confirm requirement by CPT code.",
    ],
    imagingPriorAuth: [
      "Medical necessity review expects documented conservative management for joint MRI.",
      "Site-of-service review may steer imaging to a free-standing center over a hospital outpatient department.",
    ],
    documentationNeeded: [
      "CPT and ICD-10 codes",
      "Clinical rationale and prior treatment notes",
      "Member ID and ordering provider details",
    ],
    coverageNotes: [
      "Site-of-service policies can affect cost — free-standing imaging centers are often preferred.",
      "Check whether the member has a separate imaging copay or coinsurance.",
    ],
  },
  {
    name: "Cigna",
    aliases: ["cigna"],
    priorAuthVendor: "Cigna uses eviCore for advanced imaging",
    portal: "CignaforHCP / Availity",
    generalPriorAuth: [
      "Advanced imaging requires prior authorization through eviCore for most Cigna plans.",
      "Submit via eviCore web portal; peer-to-peer review is available if initially denied.",
    ],
    imagingPriorAuth: [
      "eviCore guidelines require documented conservative therapy and a clear clinical question.",
      "Attach prior radiographs and exam findings to reduce denial risk.",
    ],
    documentationNeeded: [
      "eviCore case with clinical notes",
      "ICD-10 and CPT codes",
      "Conservative treatment timeline",
    ],
    coverageNotes: [
      "Confirm benefits and accumulator status before the visit.",
      "Out-of-network imaging may not be covered without authorization.",
    ],
  },
  {
    name: "Blue Cross Blue Shield",
    aliases: ["bcbs", "blue cross", "blue shield", "blue cross blue shield", "anthem"],
    priorAuthVendor: "Varies by Blue plan; many use AIM Specialty Health / Carelon",
    portal: "Availity (most Blue plans)",
    generalPriorAuth: [
      "Prior authorization requirements vary by local Blue plan; verify against the member's specific plan.",
      "Many Blue plans route advanced imaging through AIM/Carelon for medical necessity review.",
    ],
    imagingPriorAuth: [
      "Expect conservative-treatment documentation requirements similar to other major payers.",
      "Confirm the member's home plan since BlueCard out-of-area rules can change requirements.",
    ],
    documentationNeeded: [
      "Member's specific Blue plan and prefix",
      "Clinical notes and ICD-10",
      "Prior imaging where available",
    ],
    coverageNotes: [
      "BlueCard members may have different networks — verify the imaging center participates.",
      "Confirm whether referral from PCP is also required.",
    ],
  },
  {
    name: "Medicare",
    aliases: ["medicare", "cms", "original medicare"],
    portal: "Medicare Administrative Contractor (MAC) portal",
    generalPriorAuth: [
      "Original Medicare generally does not require prior authorization for diagnostic imaging, but documentation of medical necessity is still required.",
      "Medicare Advantage plans DO often require prior authorization — confirm the plan type first.",
    ],
    imagingPriorAuth: [
      "Ensure the order meets Medicare medical necessity (LCD/NCD) criteria.",
      "Appropriate Use Criteria (AUC) consultation may apply for advanced imaging.",
    ],
    documentationNeeded: [
      "Signed order with medical necessity",
      "ICD-10 supporting an LCD/NCD",
    ],
    coverageNotes: [
      "Confirm whether the patient has Original Medicare vs. Medicare Advantage — requirements differ significantly.",
      "Patient may owe 20% coinsurance under Part B unless they have a supplement.",
    ],
  },
];

export function findPayer(carrier: string): PayerProfile {
  const c = (carrier || "").toLowerCase().trim();
  const match = PAYERS.find(
    (p) => p.aliases.some((a) => c.includes(a)) || c.includes(p.name.toLowerCase()),
  );
  return match ?? GENERIC_PAYER(carrier);
}

function GENERIC_PAYER(carrier: string): PayerProfile {
  return {
    name: carrier || "Unknown Payer",
    aliases: [],
    portal: "payer provider portal",
    generalPriorAuth: [
      "Prior authorization requirements are payer-specific; verify directly with the carrier's provider portal.",
      "For advanced imaging, assume prior authorization may be required until confirmed otherwise.",
    ],
    imagingPriorAuth: [
      "Most commercial payers require documented conservative treatment before advanced musculoskeletal imaging.",
    ],
    documentationNeeded: ["Clinical notes", "ICD-10 and CPT codes", "Ordering provider information"],
    coverageNotes: [
      "Verify network status and member benefits before the visit.",
      "Confirm deductible and coinsurance to set patient cost expectations.",
    ],
  };
}

/**
 * Produce synthetic-but-realistic search results for a query, attributing them
 * to plausible source domains. Used only when no live search provider is set.
 */
export function knowledgeBaseSearch(query: string, carrier: string): SearchResult[] {
  const payer = findPayer(carrier);
  const q = query.toLowerCase();
  const results: SearchResult[] = [];
  const slug = payer.name.toLowerCase().replace(/[^a-z]+/g, "");

  const wantsPriorAuth = /(prior auth|authorization|precert|pre-cert|approval)/.test(q);
  const wantsCoverage = /(coverage|cover|benefit|cost|deductible|network)/.test(q);
  const wantsPrep = /(prep|preparation|before|instruction|fast)/.test(q);

  if (wantsPriorAuth || (!wantsCoverage && !wantsPrep)) {
    results.push({
      title: `${payer.name} prior authorization requirements for advanced imaging`,
      url: `https://provider.${slug || "payer"}.com/prior-authorization/imaging`,
      snippet: [...payer.generalPriorAuth, ...payer.imagingPriorAuth].join(" "),
      publishedHint: "Provider policy bulletin",
    });
    if (payer.priorAuthVendor) {
      results.push({
        title: `Radiology benefits management — ${payer.name}`,
        url: `https://provider.${slug || "payer"}.com/radiology-benefits`,
        snippet: `${payer.priorAuthVendor}. Submit through ${payer.portal}. Required documentation: ${payer.documentationNeeded.join(", ")}.`,
        publishedHint: "Provider manual",
      });
    }
  }

  if (wantsCoverage) {
    results.push({
      title: `${payer.name} coverage and cost-share considerations`,
      url: `https://provider.${slug || "payer"}.com/coverage/imaging`,
      snippet: payer.coverageNotes.join(" "),
      publishedHint: "Member benefits guide",
    });
  }

  if (wantsPrep) {
    results.push({
      title: "Patient preparation guidance for diagnostic imaging",
      url: "https://www.radiologyinfo.org/en/info/prep",
      snippet:
        "Preparation depends on modality. For MRI: remove all metal and screen for implants; no fasting for non-contrast exams. For contrast studies: verify renal function and screen for allergies. Patients should arrive 15 minutes early with insurance card and referral.",
      publishedHint: "RadiologyInfo.org (RSNA/ACR)",
    });
  }

  if (results.length === 0) {
    results.push({
      title: `${payer.name} provider resources`,
      url: `https://provider.${slug || "payer"}.com`,
      snippet: payer.generalPriorAuth.join(" "),
      publishedHint: "Provider portal",
    });
  }

  return results.slice(0, 4);
}
