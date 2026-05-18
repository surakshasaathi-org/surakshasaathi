import type { PolicyTemplate } from '../types';
import { caseNameFor, generateHealthFields, lakhFmt, rupeeFmt } from './_shared';

/**
 * HDFC ERGO Optima Secure look-alike. Distinctive shape:
 *   * "Restore Benefit" (100% reinstatement) called out on cover page
 *   * No room-rent capping (selling point — exclusion bias is "absent")
 *   * Pre-existing waiting tilts toward 36 months
 */
export const hdfcErgoOptimaTemplate: PolicyTemplate = {
  slug: 'health-hdfc-ergo-optima',
  insuranceLine: 'health',
  displayName: 'HDFC ERGO Optima Secure (look-alike)',

  render(ctx) {
    const fields = generateHealthFields(ctx.faker, {
      copayBias: 0,
      exclusionsExtra: ['Maternity expenses unless specifically opted under Maternity Cover rider'],
    });

    const caseName = caseNameFor('HDFC ERGO Optima', fields);

    const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>${caseName}</title>
<style>
  body { font-family: 'Helvetica', Arial, sans-serif; font-size: 11px; color: #1a1a1a; margin: 28px 36px; }
  h1 { font-size: 18px; color: #d22128; margin: 0 0 4px; }
  h2 { font-size: 14px; color: #d22128; border-bottom: 1px solid #d22128; padding-bottom: 2px; margin-top: 18px; }
  h3 { font-size: 12px; margin-top: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  td, th { padding: 4px 6px; border: 1px solid #ccc; vertical-align: top; }
  th { background: #f4f4f4; text-align: left; }
  .small { font-size: 9px; color: #555; }
  .badge { display: inline-block; background: #d22128; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; }
</style></head>
<body>
  <h1>HDFC ERGO Optima Secure</h1>
  <div class="small">Health Insurance Policy — Schedule Document</div>
  <span class="badge">100% Restore Benefit Included</span>

  <h2>Policy Schedule</h2>
  <table>
    <tr><th>Policy Number</th><td>${fields.policyNumber}</td>
        <th>Sum Insured</th><td>${lakhFmt(fields.sumInsuredLakhs)}</td></tr>
    <tr><th>Policyholder</th><td>${fields.policyholderName} (Age ${fields.age})</td>
        <th>Plan Type</th><td>${fields.familySize === 1 ? 'Individual' : `Family Floater — ${fields.familySize} members`}</td></tr>
    <tr><th>Policy Period</th><td>${fields.startDate} to ${fields.endDate}</td>
        <th>Annual Premium</th><td>${rupeeFmt(fields.premiumRupees)} (incl. GST)</td></tr>
    <tr><th>Nominee</th><td>${fields.nominee.name} (${fields.nominee.relation})</td>
        <th>Network Hospitals</th><td>${fields.hospitalNetworkSize.toLocaleString('en-IN')} cashless</td></tr>
  </table>

  <h2>Waiting Periods</h2>
  <table>
    <tr><th>Initial Waiting</th><td>${fields.initialWaitingDays} days from policy inception (accidents excluded)</td></tr>
    <tr><th>Pre-existing Diseases</th><td>${fields.preExistingWaitingMonths} months continuous coverage</td></tr>
    <tr><th>Specific Diseases (cataract, hernia, joint replacement)</th><td>${fields.specificDiseaseWaitingMonths} months</td></tr>
  </table>

  <h2>Sub-limits & Co-pay</h2>
  <table>
    <tr><th>Room Rent</th><td>${
      fields.roomRentSubLimit
        ? fields.roomRentSubLimit.kind === 'percent'
          ? `${fields.roomRentSubLimit.value}% of Sum Insured per day`
          : `${rupeeFmt(fields.roomRentSubLimit.value)} per day`
        : 'No capping (any room category)'
    }</td></tr>
    <tr><th>Co-pay</th><td>${fields.copayPercent === 0 ? 'NIL' : `${fields.copayPercent}% on every admissible claim`}</td></tr>
    <tr><th>Restore Benefit</th><td>100% Sum Insured reinstated upon partial / complete exhaustion (unrelated illness, same year)</td></tr>
  </table>

  <h2>Permanent Exclusions</h2>
  <ol>
    ${fields.exclusionsList.map((e) => `<li>${e}</li>`).join('\n    ')}
  </ol>

  <h2>Riders Opted</h2>
  <p>${fields.riders.length === 0 ? 'None' : fields.riders.join(', ')}</p>

  <p class="small">For grievance, contact grievance@hdfcergo.com (sample document — synthetic).</p>
</body></html>`;

    const expectedExtraction = {
      insurer: 'HDFC ERGO General Insurance',
      product_name: 'Optima Secure',
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
      restoration_benefit: { percent: 100, scope: 'unrelated_illness_same_year' },
      exclusions: fields.exclusionsList,
      riders: fields.riders,
    };

    const expectedCoverage = {
      coverage_score: undefined,
      hospitalization: { covered: true, scope: 'in_patient_24h' },
      day_care: { covered: true, count: 'any_listed_procedure' },
      pre_post_hospitalization: { pre_days: 60, post_days: 180 },
      ambulance: { covered: true, limit_paise: 200_000 },
      domiciliary: { covered: true, conditions: 'on_treating_doctor_advice_3plus_days' },
      maternity: {
        covered: fields.riders.includes('maternity'),
        waiting_months: fields.riders.includes('maternity') ? 24 : null,
      },
      opd: { covered: fields.riders.includes('opd') },
    };

    const expectedChatQa = [
      {
        question: 'Is maternity covered under this policy?',
        expected_answer: fields.riders.includes('maternity')
          ? 'Yes, maternity is covered after a 24-month waiting period (rider opted).'
          : 'No, maternity is not covered under your current rider selection.',
      },
      {
        question: 'What is the waiting period for pre-existing diseases?',
        expected_answer: `${fields.preExistingWaitingMonths} months of continuous coverage.`,
      },
      {
        question: 'What is the co-pay on this policy?',
        expected_answer:
          fields.copayPercent === 0
            ? 'No co-pay — the insurer pays 100% of admissible claims.'
            : `You pay ${fields.copayPercent}% of every admissible claim; the insurer pays the rest.`,
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
