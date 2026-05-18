/**
 * Customer-facing glossary of health-insurance terms. Used by the
 * `<HighlightTerms>` helper in member coverage cards and elsewhere — known
 * jargon gets wrapped with a click-to-learn tooltip so first-time customers
 * aren't left guessing what "proportionate deduction" or "day-care" means.
 *
 * Add new terms here. Keep `short` ≤ 280 chars (it's a tooltip, not a wiki
 * page). `example` is optional and shows under the definition in italic.
 *
 * Aliases are matched case-insensitively against the rendered text. Order
 * the regex carefully — longest patterns first so e.g. "sub-limit" wins
 * over "limit". The renderer dedupes overlapping matches.
 */

export interface GlossaryTerm {
  /** Display label inside the tooltip header. */
  label: string;
  /** Short plain-language definition, ≤ 280 chars. */
  short: string;
  /** Optional concrete example (italic, smaller). */
  example?: string;
  /** Regexes that match the term in rendered text. Use `gi` flags. */
  aliases: RegExp[];
}

export const GLOSSARY: Record<string, GlossaryTerm> = {
  proportionate_deduction: {
    label: 'Proportionate deduction',
    short:
      "If you choose a room category higher than what your policy entitles you to, EVERY other hospital charge (doctor fees, surgery, medicines) is reduced in the same proportion as the room-rent overshoot — not just the room rent.",
    example:
      "Eligible for ₹5k/day room but take a ₹10k/day room → all charges paid at 50%, so a ₹3 L bill becomes ₹1.5 L payout.",
    aliases: [/proportionate\s+deduction[s]?/gi, /proportional\s+deduction[s]?/gi],
  },
  day_care: {
    label: 'Day-care procedure',
    short:
      "Medical procedures that finish in under 24 hours — cataract, dialysis, chemotherapy, lithotripsy, dental surgery. Most policies cover them fully even though there's no overnight hospital stay.",
    example: 'A 4-hour cataract surgery still qualifies as a covered claim.',
    aliases: [/day[-\s]?care(?:\s+(?:treatment|procedure)s?)?/gi],
  },
  sub_limit: {
    label: 'Sub-limit',
    short:
      "A cap on how much the policy pays for a SPECIFIC item or condition, even though the overall sum insured is higher. Sub-limits are the silent ceiling — they trump the headline cover.",
    example:
      'A ₹10 L policy with a ₹50k cataract sub-limit pays at most ₹50k for cataract — not ₹10 L.',
    aliases: [/sub[-\s]?limit[s]?/gi],
  },
  waiting_period: {
    label: 'Waiting period',
    short:
      "A clock that starts when you buy the policy. Claims for certain conditions are NOT paid until this clock expires. Different conditions have different timers — initial 30 days, pre-existing 24-48 months, specified diseases 1-2 years.",
    example: 'Most policies will not pay for diabetes-related claims for the first 24-48 months.',
    aliases: [/waiting\s+period[s]?/gi],
  },
  co_pay: {
    label: 'Co-pay',
    short:
      "The percentage of every approved claim that YOU must pay out of pocket. Co-pay is per-claim, not per-year — small claims add up quickly. Tiered policies often raise co-pay with age or non-network treatment.",
    example: '20% co-pay on a ₹5 L bill = ₹1 L out of your pocket on each claim.',
    aliases: [/co[-\s]?pay(?:ment)?/gi, /\bcopay(?:ment)?\b/gi],
  },
  deductible: {
    label: 'Deductible',
    short:
      "The annual amount YOU pay before the policy pays anything. Common in super-top-ups (₹3-5 L deductible) and some base plans. Below the deductible the cover is zero; above it the policy kicks in.",
    example: '₹3 L deductible super-top-up only pays once your bills cross ₹3 L in a policy year.',
    aliases: [/\bdeductible[s]?\b/gi],
  },
  ped: {
    label: 'Pre-existing disease (PED)',
    short:
      "Any condition you had before buying the policy — diabetes, hypertension, thyroid, asthma. Most policies have a 24-48 month waiting period before they cover PED claims, unless you bought a 'PED waiver' add-on.",
    aliases: [
      /pre[-\s]?existing\s+(?:condition|disease|illness)s?/gi,
      /\bPED[s]?\b/g,
    ],
  },
  network_hospital: {
    label: 'Network hospital',
    short:
      "A hospital that has a tie-up with your insurer. Cashless treatment only works at network hospitals — outside, you pay first and claim reimbursement later (slower, higher rejection rate).",
    aliases: [/network\s+hospital[s]?/gi, /\bcashless\b/gi],
  },
  restore: {
    label: 'Restore / reinstatement',
    short:
      "If you exhaust your sum insured during the year, the policy 'restores' it for a NEW illness or sometimes for OTHER family members. The trigger and reach vary — read whether it's same-illness, same-person, or unlimited.",
    example: '₹5 L exhausted on father → ₹5 L restored for mother to use, but only for a different illness.',
    aliases: [/restor(?:e|ation)\s+benefit/gi, /reinstatement\s+(?:benefit|of\s+sum\s+insured)/gi],
  },
  ncb: {
    label: 'No-Claim Bonus (NCB)',
    short:
      "Sum insured boost you earn for each claim-free year — typically 10-50% per year, capped at 100% of base SI. One claim usually wipes the accumulated bonus on most policies.",
    aliases: [/no[-\s]?claim\s+bonus/gi, /\bNCB\b/g, /cumulative\s+bonus/gi],
  },
  domiciliary: {
    label: 'Domiciliary hospitalisation',
    short:
      "Treatment received at HOME instead of in a hospital. Most policies cover it only if (a) the patient cannot be moved or (b) the hospital had no bed. Both usually need a doctor's certificate.",
    aliases: [/domiciliary(?:\s+(?:treatment|hospitalisation))?/gi, /at[-\s]?home\s+hospitalisation/gi],
  },
  ayush: {
    label: 'AYUSH treatment',
    short:
      "Ayurveda, Yoga, Unani, Siddha, Homoeopathy. IRDAI mandates cover, but typically only at government-recognised AYUSH hospitals and often under a separate sub-limit.",
    aliases: [/\bAYUSH\b/g],
  },
  opd: {
    label: 'OPD',
    short:
      "Out-Patient Department — doctor consultations, diagnostics, pharmacy bills WITHOUT 24-hour admission. Most base policies do NOT cover OPD; it's an add-on rider with its own annual cap.",
    aliases: [/\bOPD\b/g, /out[-\s]?patient\s+department/gi],
  },
  room_rent: {
    label: 'Room-rent cap',
    short:
      "Daily limit on hospital room charges. Stay above the cap and proportionate-deduction usually triggers, shrinking the entire claim. '1% of sum insured per day' is common but rarely covers a metro room.",
    example: '1% of ₹5 L SI = ₹5k/day — most metro hospitals charge ₹8-12k/day.',
    aliases: [/room[-\s]?rent(?:\s+(?:cap|limit))?/gi, /room[-\s]?charge[s]?/gi],
  },
  icu: {
    label: 'ICU',
    short:
      "Intensive Care Unit. Often has its OWN sub-limit (separate from room rent), commonly 2% of SI per day. Many policies waive proportionate deduction for ICU stays — but not all.",
    aliases: [/\bICU\b/g, /intensive\s+care\s+unit/gi],
  },
  pre_post_hospitalisation: {
    label: 'Pre / Post-hospitalisation',
    short:
      "Medical bills incurred BEFORE admission (typically 30-60 days) and AFTER discharge (typically 60-180 days) for the same illness — diagnostics, consults, medicines. Outside these windows: not covered.",
    aliases: [/pre[-\s]?(?:and|&|\/)?\s*post[-\s]?hospitalisation/gi, /pre[-\s]?hospitalisation/gi, /post[-\s]?hospitalisation/gi],
  },
  copay_age_triggered: {
    label: 'Age-triggered co-pay',
    short:
      "Co-pay percentage that rises after a certain age (often 55, 60, or 65). A policy bought at 50 with a 'no co-pay' headline can quietly impose 20-30% co-pay after retirement.",
    aliases: [/age[-\s]?triggered\s+co[-\s]?pay/gi],
  },
  super_topup: {
    label: 'Super top-up',
    short:
      "A second-layer policy that kicks in only AFTER your bills cross a fixed deductible (usually ₹3-5 L per year). Cheap (~₹3-5k/yr for ₹50 L cover) and great for catastrophic risk.",
    aliases: [/super[-\s]?top[-\s]?up/gi],
  },
  port_portability: {
    label: 'Portability',
    short:
      "Switching insurer while KEEPING your accumulated waiting-period credit. Must be done within 45 days of renewal. Most customers don't know this — they buy fresh and lose 24-48 months of credit.",
    aliases: [/portability/gi, /\bport(?:ing)?\s+(?:the\s+)?policy\b/gi],
  },
  modern_treatments: {
    label: 'Modern treatments',
    short:
      "12 advanced procedures IRDAI mandates cover for: robotic surgery, oral chemo, immunotherapy, stem cell, deep brain stimulation, balloon sinuplasty, etc. Each commonly capped at 50% of SI or ₹5 L.",
    aliases: [/modern\s+treatment[s]?/gi, /advanced\s+treatment[s]?/gi],
  },
  tpa: {
    label: 'TPA',
    short:
      "Third-Party Administrator — the company your insurer uses to process claims. Even if a TPA delays your claim, the INSURER is the legally accountable party. Escalate to insurer customer-care if the TPA stalls.",
    aliases: [/\bTPA\b/g, /third[-\s]?party\s+administrator/gi],
  },
  ombudsman: {
    label: 'Insurance Ombudsman',
    short:
      "Free dispute-resolution body for claims under ₹50 L. 12 regional offices. Most cases resolved in 90 days. Use it before going to consumer court.",
    aliases: [/\bombudsman\b/gi],
  },
};

/**
 * Find every glossary match in a string and return non-overlapping matches
 * sorted by start position. Used by the renderer to splice tooltip nodes
 * into a text run.
 */
export interface GlossaryMatch {
  start: number;
  end: number;
  termKey: keyof typeof GLOSSARY;
  text: string;
}

export function findGlossaryMatches(text: string): GlossaryMatch[] {
  const matches: GlossaryMatch[] = [];
  for (const [key, term] of Object.entries(GLOSSARY) as [
    keyof typeof GLOSSARY,
    GlossaryTerm,
  ][]) {
    for (const re of term.aliases) {
      // Reset the regex's lastIndex — global regexes are stateful.
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length, termKey: key, text: m[0] });
        // Avoid infinite loops on zero-width matches (shouldn't happen here, defensive).
        if (m.index === re.lastIndex) re.lastIndex += 1;
      }
    }
  }
  // Sort by start, then prefer longer matches at same start position.
  matches.sort((a, b) => (a.start - b.start) || (b.end - b.start) - (a.end - a.start));
  // Dedupe overlaps — keep the FIRST match (which is the earliest-starting,
  // longest at that start).
  const out: GlossaryMatch[] = [];
  let cursor = -1;
  for (const m of matches) {
    if (m.start >= cursor) {
      out.push(m);
      cursor = m.end;
    }
  }
  return out;
}
