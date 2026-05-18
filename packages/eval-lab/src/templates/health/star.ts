import type { PolicyTemplate } from '../types';
import { caseNameFor, generateHealthFields, lakhFmt, rupeeFmt } from './_shared';

/**
 * Star Health "Comprehensive Insurance Policy" look-alike. Distinctive shape:
 *   * Heavy on bullet-pointed exclusions
 *   * Co-pay applied for specific age bands (60+) — biased on
 *   * Pre-existing waiting tilts toward 48 months
 *   * Day-care procedures listed by name (we don't enumerate; flag presence)
 */
export const starComprehensiveTemplate: PolicyTemplate = {
  slug: 'health-star-comprehensive',
  insuranceLine: 'health',
  displayName: 'Star Comprehensive (look-alike)',

  render(ctx) {
    // Bias toward 10/20% co-pay for age 60+. The faker has the age, so
    // we can post-tweak: the helper takes a copayBias hint, but we want
    // _conditional_ bias. Cheap workaround: generate first, override.
    const fields = generateHealthFields(ctx.faker, {
      exclusionsExtra: [
        'Treatment for sleep apnoea, snoring, or related conditions',
        'Stem cell therapy, robotic surgery (other than as listed)',
      ],
    });
    if (fields.age >= 60 && fields.copayPercent === 0) {
      fields.copayPercent = ctx.faker.helpers.arrayElement([10, 20] as const);
    }

    const caseName = caseNameFor('Star Comprehensive', fields);
    const dayCarePresent = ctx.faker.datatype.boolean({ probability: 0.95 });

    const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>${caseName}</title>
<style>
  body { font-family: 'Times New Roman', Times, serif; font-size: 11px; color: #18181b; margin: 28px 36px; }
  h1 { font-size: 17px; color: #003a70; margin: 0 0 4px; letter-spacing: 0.4px; }
  h2 { font-size: 13px; color: #003a70; margin-top: 18px; border-top: 2px solid #003a70; padding-top: 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  td, th { padding: 4px 6px; border: 1px solid #c4c4c4; vertical-align: top; }
  th { background: #eef3f8; text-align: left; font-weight: 600; }
  ul { margin: 6px 0; padding-left: 18px; }
  .tagline { font-style: italic; color: #555; font-size: 10px; }
</style></head>
<body>
  <h1>STAR HEALTH — COMPREHENSIVE INSURANCE POLICY</h1>
  <p class="tagline">Schedule cum Certificate of Insurance</p>

  <h2>1. Schedule</h2>
  <table>
    <tr><th>Policy No.</th><td>${fields.policyNumber}</td>
        <th>Sum Insured</th><td>${lakhFmt(fields.sumInsuredLakhs)}</td></tr>
    <tr><th>Insured</th><td>${fields.policyholderName}, age ${fields.age}</td>
        <th>Cover</th><td>${fields.familySize === 1 ? 'Individual' : `Floater (${fields.familySize} lives)`}</td></tr>
    <tr><th>Period of Insurance</th><td>${fields.startDate} to ${fields.endDate} (Term ${fields.policyTermYears} year${fields.policyTermYears > 1 ? 's' : ''})</td>
        <th>Premium</th><td>${rupeeFmt(fields.premiumRupees)}</td></tr>
    <tr><th>Nominee</th><td>${fields.nominee.name} — ${fields.nominee.relation}</td>
        <th>Network Hospitals</th><td>${fields.hospitalNetworkSize.toLocaleString('en-IN')}</td></tr>
  </table>

  <h2>2. Waiting Periods (Section 3 of Terms)</h2>
  <ul>
    <li><strong>Initial:</strong> ${fields.initialWaitingDays} days from policy commencement (accidents excluded)</li>
    <li><strong>Pre-existing diseases:</strong> ${fields.preExistingWaitingMonths} months of continuous coverage</li>
    <li><strong>Specified surgeries / illnesses:</strong> ${fields.specificDiseaseWaitingMonths} months (cataract, hernia, joint replacement, varicose veins, etc.)</li>
  </ul>

  <h2>3. Sub-limits & Co-pay</h2>
  <table>
    <tr><th>Room rent / day</th><td>${
      fields.roomRentSubLimit
        ? fields.roomRentSubLimit.kind === 'percent'
          ? `${fields.roomRentSubLimit.value}% of Sum Insured per day; ICU at actuals`
          : `${rupeeFmt(fields.roomRentSubLimit.value)} per day`
        : 'No room rent capping'
    }</td></tr>
    <tr><th>Co-pay</th><td>${
      fields.copayPercent === 0
        ? 'NIL'
        : `${fields.copayPercent}% — applicable on every admissible claim${fields.age >= 60 ? ' (age 60 and above)' : ''}`
    }</td></tr>
    <tr><th>Day-care procedures</th><td>${dayCarePresent ? 'Listed procedures covered up to Sum Insured' : 'Not covered'}</td></tr>
  </table>

  <h2>4. Permanent Exclusions (Section 4)</h2>
  <ol>
    ${fields.exclusionsList.map((e) => `<li>${e}</li>`).join('\n    ')}
  </ol>

  <h2>5. Riders Opted</h2>
  <p>${fields.riders.length === 0 ? 'None' : fields.riders.join(', ')}</p>

  <p class="tagline">Sample document — synthetic. Not a real Star Health policy.</p>
</body></html>`;

    const expectedExtraction = {
      insurer: 'Star Health and Allied Insurance',
      product_name: 'Comprehensive Insurance Policy',
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
      day_care: { present: dayCarePresent },
      exclusions: fields.exclusionsList,
      riders: fields.riders,
    };

    const expectedCoverage = {
      hospitalization: { covered: true, scope: 'in_patient_24h' },
      day_care: { covered: dayCarePresent, count: dayCarePresent ? 'listed_procedures' : 'none' },
      pre_post_hospitalization: { pre_days: 30, post_days: 60 },
      ambulance: { covered: true, limit_paise: 150_000 },
      domiciliary: { covered: true, conditions: 'on_doctor_advice_3plus_days' },
      maternity: {
        covered: fields.riders.includes('maternity'),
        waiting_months: fields.riders.includes('maternity') ? 36 : null,
      },
      opd: { covered: fields.riders.includes('opd') },
    };

    const expectedChatQa = [
      {
        question: 'Are day-care procedures covered?',
        expected_answer: dayCarePresent
          ? 'Yes — listed day-care procedures are covered up to the sum insured.'
          : 'No — day-care procedures are not covered under this plan.',
      },
      {
        question: 'Why is there a co-pay on my policy?',
        expected_answer:
          fields.copayPercent === 0
            ? "There's no co-pay on your policy."
            : fields.age >= 60
              ? `A ${fields.copayPercent}% co-pay applies because the insured is age 60 or above.`
              : `A ${fields.copayPercent}% co-pay applies on every admissible claim.`,
      },
      {
        question: 'What is the waiting period for cataract surgery?',
        expected_answer: `${fields.specificDiseaseWaitingMonths} months — cataract is on the specified-illnesses list.`,
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
