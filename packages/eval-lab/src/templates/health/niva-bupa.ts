import type { PolicyTemplate } from '../types';
import { caseNameFor, generateHealthFields, lakhFmt, rupeeFmt } from './_shared';

/**
 * Niva Bupa "ReAssure / Health ReAssure" look-alike. Distinctive shape:
 *   * No co-pay (selling point), no room-rent cap on higher SI variants
 *   * Carries an "Unlimited Reset" benefit — sum insured restored multiple
 *     times in the policy year, even for the same illness
 *   * Pre-existing waiting tilts toward 24 months
 *   * Maternity rider unusually common
 */
export const nivaBupaReassureTemplate: PolicyTemplate = {
  slug: 'health-niva-bupa-reassure',
  insuranceLine: 'health',
  displayName: 'Niva Bupa ReAssure (look-alike)',

  render(ctx) {
    const fields = generateHealthFields(ctx.faker, {
      copayBias: 0,
      exclusionsExtra: ['Treatment for psychiatric disorders unless hospitalised >24h'],
    });
    // Niva pushes SI ≥10L floaters; if a 5L slipped in for a family, bump.
    if (fields.familySize > 1 && fields.sumInsuredLakhs === 5) {
      fields.sumInsuredLakhs = 10;
    }
    fields.preExistingWaitingMonths = 24;

    // Maternity rider more common (40% of cases vs ~25% baseline).
    if (!fields.riders.includes('maternity') && ctx.faker.datatype.boolean({ probability: 0.4 })) {
      fields.riders = [...fields.riders, 'maternity'];
    }

    const caseName = caseNameFor('Niva ReAssure', fields);
    const unlimitedResetActive = ctx.faker.datatype.boolean({ probability: 0.85 });

    const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>${caseName}</title>
<style>
  body { font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1f2937; margin: 28px 36px; }
  h1 { font-size: 18px; color: #006c69; margin: 0 0 4px; font-weight: 700; }
  h2 { font-size: 13px; color: #006c69; margin-top: 18px; padding-bottom: 4px; border-bottom: 1px solid #006c69; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  td, th { padding: 5px 7px; border: 1px solid #d1d5db; vertical-align: top; }
  th { background: #ecfdf5; text-align: left; font-weight: 600; }
  .pill { display: inline-block; background: #006c69; color: #fff; padding: 3px 9px; border-radius: 999px; font-size: 10px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase; }
  .small { font-size: 9.5px; color: #4b5563; }
</style></head>
<body>
  <h1>Niva Bupa ReAssure — Schedule</h1>
  ${unlimitedResetActive ? '<span class="pill">Unlimited Reset</span>' : ''}

  <h2>Policy &amp; Insured</h2>
  <table>
    <tr><th>Policy Number</th><td>${fields.policyNumber}</td>
        <th>Sum Insured</th><td>${lakhFmt(fields.sumInsuredLakhs)}</td></tr>
    <tr><th>Insured</th><td>${fields.policyholderName}, ${fields.age} years</td>
        <th>Plan Type</th><td>${fields.familySize === 1 ? 'Individual' : `Family Floater (${fields.familySize} members)`}</td></tr>
    <tr><th>Period</th><td>${fields.startDate} to ${fields.endDate}</td>
        <th>Premium</th><td>${rupeeFmt(fields.premiumRupees)} (incl. GST)</td></tr>
    <tr><th>Nominee</th><td>${fields.nominee.name} (${fields.nominee.relation})</td>
        <th>Cashless Network</th><td>${fields.hospitalNetworkSize.toLocaleString('en-IN')} hospitals</td></tr>
  </table>

  <h2>Waiting Periods</h2>
  <table>
    <tr><th>Initial</th><td>${fields.initialWaitingDays} days</td></tr>
    <tr><th>Pre-existing diseases</th><td>${fields.preExistingWaitingMonths} months</td></tr>
    <tr><th>Specific illnesses</th><td>${fields.specificDiseaseWaitingMonths} months</td></tr>
    ${
      fields.riders.includes('maternity')
        ? '<tr><th>Maternity</th><td>24 months waiting (rider opted)</td></tr>'
        : ''
    }
  </table>

  <h2>Sub-limits, Co-pay &amp; Boosters</h2>
  <table>
    <tr><th>Room rent</th><td>${
      fields.roomRentSubLimit
        ? fields.roomRentSubLimit.kind === 'percent'
          ? `${fields.roomRentSubLimit.value}% of Sum Insured per day`
          : `${rupeeFmt(fields.roomRentSubLimit.value)} per day`
        : 'Single private AC room — no capping'
    }</td></tr>
    <tr><th>Co-pay</th><td>${fields.copayPercent === 0 ? 'NIL — no deductions on admissible claims' : `${fields.copayPercent}%`}</td></tr>
    ${
      unlimitedResetActive
        ? '<tr><th>Unlimited Reset</th><td>Sum Insured restored unlimited times in the policy year, including for the same illness</td></tr>'
        : '<tr><th>Restoration</th><td>100% Sum Insured restored once per year for unrelated illness</td></tr>'
    }
  </table>

  <h2>Permanent Exclusions</h2>
  <ol>
    ${fields.exclusionsList.map((e) => `<li>${e}</li>`).join('\n    ')}
  </ol>

  <h2>Riders</h2>
  <p>${fields.riders.length === 0 ? 'No riders opted' : fields.riders.join(', ')}</p>

  <p class="small">Synthetic specimen. Not a real Niva Bupa policy document.</p>
</body></html>`;

    const expectedExtraction = {
      insurer: 'Niva Bupa Health Insurance',
      product_name: 'ReAssure',
      policy_number: fields.policyNumber,
      sum_insured: fields.sumInsuredLakhs * 100_000,
      premium: fields.premiumRupees,
      policy_period: { start: fields.startDate, end: fields.endDate },
      family_size: fields.familySize,
      policyholder: { name: fields.policyholderName, age: fields.age },
      nominee: fields.nominee,
      waiting_periods: {
        initial_days: fields.initialWaitingDays,
        pre_existing_months: fields.preExistingWaitingMonths,
        specific_disease_months: fields.specificDiseaseWaitingMonths,
      },
      sub_limits: {
        room_rent: fields.roomRentSubLimit,
        copay_percent: fields.copayPercent,
      },
      restoration_benefit: unlimitedResetActive
        ? { kind: 'unlimited_reset', scope: 'including_same_illness' }
        : { kind: 'standard_restoration', percent: 100, scope: 'unrelated_illness_same_year' },
      exclusions: fields.exclusionsList,
      riders: fields.riders,
    };

    const expectedCoverage = {
      hospitalization: { covered: true, scope: 'in_patient_24h' },
      day_care: { covered: true, count: 'any_listed_procedure' },
      pre_post_hospitalization: { pre_days: 60, post_days: 180 },
      ambulance: { covered: true, limit_paise: 200_000 },
      domiciliary: { covered: true, conditions: 'on_doctor_advice_3plus_days' },
      maternity: {
        covered: fields.riders.includes('maternity'),
        waiting_months: fields.riders.includes('maternity') ? 24 : null,
      },
      opd: { covered: fields.riders.includes('opd') },
      reset_benefit: unlimitedResetActive ? 'unlimited_same_illness_allowed' : 'standard',
    };

    const expectedChatQa = [
      {
        question: 'How many times can my sum insured be restored in a year?',
        expected_answer: unlimitedResetActive
          ? 'Unlimited times — including for the same illness, across the policy year.'
          : 'Once per year, and only for an unrelated illness.',
      },
      {
        question: 'Is there any co-pay deduction?',
        expected_answer:
          fields.copayPercent === 0
            ? 'No — Niva pays 100% of admissible claims under this plan.'
            : `${fields.copayPercent}% co-pay applies on every admissible claim.`,
      },
      {
        question: 'What is the waiting period for pre-existing diseases?',
        expected_answer: `${fields.preExistingWaitingMonths} months of continuous coverage.`,
      },
    ];

    return {
      caseName,
      html,
      expected: {
        expectedExtraction,
        expectedCoverage,
        expectedChatQa,
        demographics: {
          age: fields.age,
          family_size: fields.familySize,
          sum_insured_lakhs: fields.sumInsuredLakhs,
          locale: ctx.locale,
        },
      },
    };
  },
};
