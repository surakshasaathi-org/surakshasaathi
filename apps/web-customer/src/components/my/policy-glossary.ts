/**
 * Plain-English definitions for every clause type the policy detail view
 * renders. Triggered from the <LearnMore> popover next to each section
 * heading. Copy is written for a non-insurance-literate reader — no jargon
 * without immediate translation, concrete numbers where possible.
 */

export interface GlossaryEntry {
  title: string;
  short: string;                 // one-sentence TL;DR shown in the collapsed chip
  body: Array<string | { em: string }>; // paragraphs; { em: "..." } = emphasised pullquote
  example?: string;              // concrete number scenario
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  waiting_period: {
    title: 'Waiting periods',
    short:
      "A period during which some (or all) claims aren't admissible — even though you're already paying premiums.",
    body: [
      'Every Indian health policy has at least one waiting period. You pay the premium from day 1, but certain claims only become admissible after the wait is over.',
      'There are five common flavours: Initial (usually 30 days, nothing except accidents), Pre-existing (24–48 months for conditions you had before buying), Specified-disease (24–36 months for a named list like cataract or knee replacement, applies even to healthy people), Maternity (9–36 months), and policy-specific condition waits.',
    ],
    example:
      'If you buy a policy today with a 24-month diabetes wait, a diabetes-related hospitalisation 18 months from now won\'t be covered — even if you declared diabetes up front.',
  },
  initial_wait: {
    title: 'Initial waiting period',
    short:
      'The first 30 days of a new policy — only accidents are admissible, nothing illness-related.',
    body: [
      'The initial wait protects insurers from people who buy a policy after getting sick. It only applies in the very first policy year — renewals skip it.',
      'Accidents are always covered from day 1, even during the initial wait.',
    ],
  },
  ped_wait: {
    title: 'Pre-existing disease (PED) waiting period',
    short:
      'Conditions you had BEFORE buying the policy are excluded for the PED wait — usually 24 to 48 months.',
    body: [
      "A pre-existing disease is anything diagnosed, treated, or advised for in the last 48 months before you bought the policy. You must declare them up front — hiding a PED is grounds for claim rejection under non-disclosure.",
      "During the PED wait, claims related to that condition aren't admissible. Related complications count too.",
    ],
    example:
      "You declared hypertension. You have a stroke in month 18. With a 36-month PED wait, the claim is rejected because the stroke is a hypertension-related complication.",
  },
  specified_disease_wait: {
    title: 'Specified-disease waiting period',
    short:
      'A named list of conditions (cataract, hernia, knee replacement, etc.) has a separate wait — applies even if you never had them before.',
    body: [
      "IRDAI allows insurers to publish a 'specified disease' list where even healthy members have to wait 24–36 months after buying. Common names: cataract, hernia, piles, hysterectomy, knee replacement, gallstones.",
      "Different from PED — the specified-disease wait applies regardless of whether you had the condition before. It's about which conditions the insurer considers 'non-urgent' planned surgeries.",
    ],
  },
  maternity_wait: {
    title: 'Maternity waiting period',
    short:
      'Maternity benefits (delivery, newborn cover) are subject to their own wait — usually 9 to 36 months.',
    body: [
      "Most Indian base policies don't cover maternity at all, or require a long wait. If you're planning a family, check the maternity wait + sub-limit carefully — some policies cap payout at ₹15-50k even when covered.",
    ],
  },
  sub_limits: {
    title: 'Sub-limits',
    short:
      'Caps on specific items or procedures — even within your overall sum assured.',
    body: [
      "A sub-limit caps how much the insurer will pay for a specific thing — a room rent per day, or a procedure like cataract surgery. They exist INSIDE your sum assured; hitting one doesn't use up the whole SA.",
      "Why it matters: sub-limits are the #1 source of out-of-pocket surprises. Your policy says ₹5 lakh cover; your bill is ₹3.5 lakh; you still pay ₹1.2 lakh because you hit 3 sub-limits.",
    ],
  },
  room_rent: {
    title: 'Room-rent cap',
    short:
      'The daily room rent you can claim — usually capped at 1-2% of sum assured, or "single private room".',
    body: [
      "This is the single most consequential clause in your policy. If your actual room charge exceeds the cap, most insurers apply a PROPORTIONATE DEDUCTION to ALL your other hospital charges.",
      { em: 'The 30–40% rule: exceeding room rent by X% typically shrinks your entire admissible claim by roughly the same X%.' },
      'Always check what the cap maps to in your city. A ₹5,000/day cap = city-hospital double room in most metros; ₹3,000/day = shared room only.',
    ],
    example:
      'Cap is ₹5,000/day. Your room is ₹8,000/day (60% over). On a ₹2L bill, the insurer will pay only about ₹1.25L — the 60% overage gets deducted across ALL charges, not just room rent.',
  },
  procedure_caps: {
    title: 'Procedure caps (disease-level limits)',
    short:
      'Specific procedures have their own spending ceiling — cataract ₹40k, hernia ₹60k, etc.',
    body: [
      "Even inside your sum assured, procedures on the insurer's named list have their own ceiling. If your cataract costs ₹80k and the cap is ₹40k, you pay ₹40k out of pocket.",
      'Common procedure caps: cataract, hernia, knee replacement, piles, hysterectomy, tonsillectomy.',
    ],
  },
  modern_treatment: {
    title: 'Modern-treatment sub-limits',
    short:
      'IRDAI-defined list of 12 advanced treatments (robotic surgery, stem cell, etc.) with their own caps.',
    body: [
      'IRDAI mandates coverage for 12 modern treatments since 2019 — but insurers can (and do) sub-limit them. Common examples: robotic surgery, oral chemotherapy, stem-cell therapy, deep-brain stimulation.',
      'If you need one of these, expect 50-100% of your sum assured as the effective cap (e.g. ₹2L on a ₹5L policy).',
    ],
  },
  ancillary: {
    title: 'Ancillary sub-limits',
    short:
      'Caps on non-room, non-procedure items: ambulance, ICU, pre-post hospitalisation.',
    body: [
      'Ambulance: typically ₹1,500-3,000 per hospitalisation. ICU: sometimes a separate daily cap (higher than regular room). Pre-hospitalisation: 30-60 days of expenses before admission. Post-hospitalisation: 60-90 days after discharge.',
    ],
  },
  copay: {
    title: 'Co-pay',
    short:
      'A percentage of every admissible claim you pay out of pocket, even on covered items.',
    body: [
      "A co-pay is a share-of-cost: on a ₹1L admissible claim with 10% co-pay, you pay ₹10k and the insurer pays ₹90k.",
      "Co-pays come in flavours:",
      "• Voluntary — you chose it in exchange for a lower premium.\n• Mandatory — the insurer imposes it (common on senior-citizen plans).\n• Age-triggered — 10-20% kicks in after you turn 60 or 65.\n• Zone-based — higher co-pay if you're treated outside your home zone.\n• Non-network — 20-30% extra if you skip the network hospital list.\n• Condition-specific — a separate % just for diabetes, cardiac, joint replacement etc.",
      { em: "Always add up every co-pay that could stack. A senior-citizen policy might apply 20% age + 20% non-network = 36% effective co-pay on a non-network bill." },
    ],
  },
  deductible: {
    title: 'Deductible',
    short:
      'A fixed rupee amount you pay up-front before the insurer pays anything.',
    body: [
      "Different from co-pay: the deductible is a FLAT amount (e.g. ₹50k per hospitalisation), the co-pay is a PERCENTAGE.",
      "If your bill is below the deductible, the insurer pays zero. Above it, the insurer pays (bill – deductible) × (1 – co-pay).",
    ],
  },
  zone_copay: {
    title: 'Zone-based co-pay',
    short:
      'If you\'re treated in a higher-cost city than your registered zone, you pay a penalty co-pay.',
    body: [
      'Insurers split India into 2-3 zones (A = Mumbai/Delhi/Bengaluru, B = other metros, C = tier-2/3). A policy "in Zone C" that uses a Zone A hospital triggers a 10-20% co-pay on top of everything else.',
      "Plan for this if you often travel for treatment — it's designed to keep premiums low in tier-2/3 cities, but bites hard when you actually hospitalise elsewhere.",
    ],
  },
  non_network_copay: {
    title: 'Non-network co-pay',
    short:
      'If you skip the insurer\'s network hospital list, expect a 20-30% co-pay on top.',
    body: [
      "Network hospitals have pre-negotiated rates and cashless processing. Going out of network means reimbursement (slower) AND usually a non-network co-pay penalty.",
      'Check the network density in your city before buying. "5,000 network hospitals" is marketing — what matters is how many are within 30 min of your home.',
    ],
  },
  exclusions: {
    title: 'Exclusions',
    short:
      "What the policy will NEVER cover, regardless of sum assured or waiting periods.",
    body: [
      "Every policy has 40-80 exclusions. They fall into 5 buckets:",
      "• Permanent — war, nuclear, suicide within 12 months, cosmetic surgery.\n• Treatments — AYUSH (unless specifically covered), experimental, unproven.\n• Conditions — dental & eye care unless accident-related.\n• Behavioural — alcohol/drug abuse, self-inflicted injury.\n• Administrative — fraud, misrepresentation, non-disclosure.",
    ],
  },
  super_topup: {
    title: 'Super top-up & deductible',
    short:
      'In a super top-up, the insurer pays only after your yearly medical bills cross a threshold. That threshold is the "deductible".',
    body: [
      "A 'base' health policy pays from ₹1 of your first admissible claim. A 'super top-up' policy sits on top: it kicks in ONLY after your annual medical bills cross a deductible (e.g. ₹5 lakh). Below that, it pays nothing.",
      "Why buy a super top-up? Large sum insured at low premium, designed to sit on top of a base plan or your employer cover. If your base handles the first ₹5L, the super top-up covers anything above that, up to its own SI.",
      { em: "The same word 'deductible' is also used in base plans that have an optional self-pay amount (e.g. first ₹25k annually). In both cases it means: how much you pay before the insurer pays." },
    ],
    example:
      "₹25L super top-up with ₹5L deductible. Hospital bill ₹7L. You (or your base plan) pay the first ₹5L; the super top-up pays the remaining ₹2L. If the bill had been ₹4L, the super top-up would pay nothing.",
  },
  ncb: {
    title: 'No Claim Bonus (NCB / Cumulative Bonus)',
    short:
      'Your sum insured grows every claim-free year — usually 10-50% per year, capped at 100-200% of the base SI.',
    body: [
      "IRDAI allows insurers to reward claim-free renewals with a bigger sum insured for the same premium. ₹5L policy → ₹6L next year → ₹7L the year after, etc.",
      "Two flavours: 'Cumulative Bonus' (accrued bonus stays, grows each year) vs 'Super NCB' (bigger jumps, but resets on claim). Read 'resets on claim' carefully — some plans keep the bonus even after a claim, some don't.",
    ],
    example:
      "Base SI ₹5L, NCB 20%/year, max 100%. After 5 claim-free years your cover is effectively ₹10L. Make a claim in year 3 and either (a) the bonus resets to 0 and rebuilds, or (b) only the current year's NCB is clipped, depending on the policy wording.",
  },
  restore: {
    title: 'Restore / Refill / Reinstatement',
    short:
      'If you exhaust your sum insured during the year, the insurer refills it — for the same illness or a different one, same member or any member, depending on the policy.',
    body: [
      "In a family floater, one major claim can wipe out the shared SI, leaving other members exposed. Restore fixes this — the insurer puts the SI back.",
      "Read the fine print on two axes:",
      "• Disease: does the restored SI work for the SAME illness that exhausted it, or only for a DIFFERENT illness? ('all' = works for both).\n• Person: can the SAME member use it again, or only OTHER family members? ('all' = any member).",
      { em: "A restore that reads 'different illness, different person' is much more restrictive than 'all illness, all members'. Always check both axes before relying on it." },
    ],
    example:
      "₹10L floater with Restore. Mother is hospitalised for cardiac, claim ₹10L exhausts SI. Later in the year father needs ₹3L for a different illness. If restore is 'different disease, all person' → covered. If restore is 'same disease, same person only' → not covered.",
  },
  inflation_protect: {
    title: 'Inflation Protect',
    short:
      "Your base sum insured grows by a fixed % every year to keep pace with medical inflation — free of cost.",
    body: [
      "Different from NCB: inflation protect grows the SI regardless of whether you claim. NCB grows it only on claim-free years.",
      "Typical: 10% per year, sometimes capped at 100% over the life of the policy. Less common than NCB, often bundled in premium plans.",
    ],
  },
  disease_sublimit: {
    title: 'Disease-level sub-limits',
    short:
      "A maximum total payout for a NAMED disease, across all procedures for that disease.",
    body: [
      "Different from a procedure cap (which limits ONE procedure like cataract). A disease sub-limit caps the TOTAL across every procedure for that disease.",
      "Common targets: cardiac (total ₹3-5L for all cardiac-related treatment), cancer (total ₹5-10L across chemo + surgery + radiation), organ-failure, joint-replacement clusters.",
    ],
    example:
      "Cardiac sub-limit ₹3L. You have angioplasty (₹1.2L) in year 1, then a bypass (₹3L) six months later. Insurer pays the first ₹3L total across BOTH procedures, not ₹3L per procedure.",
  },
  icu_cap: {
    title: 'ICU daily cap',
    short:
      "A separate daily cap for ICU stays, usually 2× the normal room-rent cap.",
    body: [
      "Many policies cap ICU at a different daily limit than regular rooms — often higher (2-3× room-rent cap) because ICUs genuinely cost more.",
      "Same proportionate-deduction rule can apply here too: exceed the ICU cap and the insurer scales ALL your other charges.",
    ],
  },
  health_checkup: {
    title: 'Annual health check-up',
    short:
      'A free yearly preventive check-up offered as a policy benefit — often per member, sometimes per family.',
    body: [
      "Most policies bundle this as a ₹1,500-5,000 cap per person per year. Scope varies — basic blood work + ECG + consultation is common; some plans include advanced screens (cardiac stress test, MRI) in premium tiers.",
      "Usually kicks in at year 2 — check the policy's 'continuation benefit' rules. Must be done at a network hospital/diagnostic centre.",
    ],
  },
  teleconsult: {
    title: 'Teleconsultation / Doctor on call',
    short:
      "Video or phone consultations with network doctors — usually unlimited and free.",
    body: [
      "24/7 access to GP-grade advice; some plans extend to specialists. Cannot be used for prescription-controlled drugs or in-person diagnoses, but handy for the 'is this an emergency?' calls.",
    ],
  },
  opd: {
    title: 'OPD (Outpatient) cover',
    short:
      "Coverage for doctor consultations, tests, and pharmacy bills OUTSIDE hospital admission — rare in base plans, common as an add-on.",
    body: [
      "OPD bucket typically has its own annual cap (₹5,000-50,000) separate from sum insured. Scope varies widely — some plans cover only consultations, some cover diagnostics, fewer still cover medicines.",
      "Cashless OPD at network clinics is the norm; reimbursement works for out-of-network providers.",
    ],
  },
  ayush: {
    title: 'AYUSH coverage',
    short:
      "Ayurveda, Yoga, Unani, Siddha, Homeopathy — many policies sub-limit this to 25% of SI for hospitalised AYUSH treatment.",
    body: [
      "IRDAI mandates at least some AYUSH coverage, but most insurers apply a sub-limit (commonly 25% of sum insured) and restrict to hospitalised in-patient AYUSH — outpatient Ayurveda visits usually aren't covered.",
    ],
  },
  daily_cash: {
    title: 'Daily hospital cash allowance',
    short:
      "A fixed ₹X/day paid to you for every day of hospitalisation, over and above your treatment claim.",
    body: [
      "Meant to cover incidental costs (attendant food, lost wages, local travel). Usually starts from day 2 or 3 of admission (not day 1), with a maximum number of days per year.",
      "Typical: ₹500-2000/day, max 7-15 days/year.",
    ],
  },
  additional_benefits: {
    title: 'Additional benefits',
    short:
      "Bundled benefits beyond hospitalisation — health check-ups, teleconsult, OPD, daily cash, etc.",
    body: [
      "These are concrete, claimable benefits the policy ships with. Different from riders (which are opt-in at extra premium) and different from the base coverage (which kicks in only on hospitalisation).",
    ],
  },
  maternity: {
    title: 'Maternity cover',
    short:
      "Delivery + newborn cover — usually has its own wait (9-36 months), delivery cap, and newborn-stay days.",
    body: [
      "Four dimensions matter: (1) wait period (how long after buying before maternity kicks in), (2) delivery cap (normal delivery ₹X, c-section usually higher), (3) newborn cover days (often first 90 days automatic), (4) well-baby check-up (preventive pediatric visits in year 1).",
      "Most base policies exclude maternity entirely; it's an add-on or a feature of premium tiers.",
    ],
  },
  ambulance: {
    title: 'Ambulance cover',
    short:
      'Road (and sometimes air) ambulance costs for transfer to hospital — usually capped per event or annually.',
    body: [
      "Road: typically ₹1,500-3,000 per hospitalisation. Air ambulance: rare, only in premium plans, caps up to ₹2-5L.",
      "Check 'per_event' vs 'annual' — some policies pay once per admission, some aggregate yearly.",
    ],
  },
  riders: {
    title: 'Riders (add-on covers)',
    short:
      'Optional benefits bolted onto your base policy for an extra premium — restore, health check-up, OPD, etc.',
    body: [
      'A rider is a "plug-in" to your base plan. You pay a small additional premium at purchase or renewal and it extends or enhances what the policy covers.',
      "Common health-insurance riders:",
      "• Restore / Refill — if you exhaust your sum insured during the year, the insurer refills it.\n• Inflation protect — your sum insured grows every year (often 10%) to keep pace with medical inflation.\n• Waiver of waiting period — shortens or removes the initial/specified-disease wait.\n• OPD / doctor-on-call — covers doctor consultations and tests outside hospitalisation.\n• Preventive health check-up — one free check-up per year.\n• Maternity / newborn rider — adds delivery and newborn cover to an otherwise non-maternity plan.",
      { em: 'A rider on paper doesn\'t always mean it\'s active on your policy. Check your schedule/COI for the rider name and its premium line — riders are opt-in.' },
    ],
    example:
      "You have a ₹5L policy with a Restore rider. You spend ₹5L on a cardiac admission in April. In October, a family member needs a ₹3L claim — Restore puts the ₹5L back, so the October claim is fully covered.",
  },
  room_rent_proportion: {
    title: 'Proportionate deduction',
    short:
      'Exceed your room-rent cap and the insurer proportionately cuts ALL other charges.',
    body: [
      "The insurer's logic: a higher room band usually means higher doctor, nursing, surgical fees. So they scale every line item down by (cap ÷ actual room rent).",
      'This single mechanism is responsible for most claim shortfalls Indian families face.',
    ],
    example:
      'Cap ₹4k/day. Actual ₹6k/day. Ratio 4/6 = 0.67. A ₹3L bill becomes ₹2L admissible BEFORE any other co-pay or deductible.',
  },
};
