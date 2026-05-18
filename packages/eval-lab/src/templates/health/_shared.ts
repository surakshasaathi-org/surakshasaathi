import type { Faker } from '@faker-js/faker';

/**
 * Shared health-template helpers. Anything used by more than one of the three
 * health insurers lives here; insurer-specific quirks (sub-limit shapes,
 * specific exclusion wording, NCB tables) stay in the per-insurer file.
 */

export interface HealthCaseFields {
  policyNumber: string;
  policyholderName: string;
  age: number;
  familySize: number;          // 1 = individual; 2..6 = family floater
  sumInsuredLakhs: 5 | 10 | 15 | 25 | 50 | 100;
  premiumRupees: number;
  policyTermYears: 1 | 2 | 3;
  startDate: string;            // YYYY-MM-DD
  endDate: string;              // YYYY-MM-DD
  nominee: { name: string; relation: string };
  hospitalNetworkSize: number;
  preExistingWaitingMonths: 24 | 36 | 48;
  specificDiseaseWaitingMonths: 24 | 36;
  initialWaitingDays: 30 | 60 | 90;
  roomRentSubLimit: { kind: 'percent' | 'absolute'; value: number } | null;
  copayPercent: 0 | 10 | 20;
  exclusionsList: string[];
  riders: string[];             // 'critical_illness' | 'opd' | 'maternity' | 'restoration'
}

const SUM_INSURED_OPTIONS: HealthCaseFields['sumInsuredLakhs'][] = [5, 10, 15, 25, 50, 100];
const PRE_EXISTING_WAITING_OPTIONS: HealthCaseFields['preExistingWaitingMonths'][] = [24, 36, 48];
const SPECIFIC_DISEASE_WAITING: HealthCaseFields['specificDiseaseWaitingMonths'][] = [24, 36];
const INITIAL_WAITING_OPTIONS: HealthCaseFields['initialWaitingDays'][] = [30, 60, 90];
const COPAY_OPTIONS: HealthCaseFields['copayPercent'][] = [0, 10, 20];

const COMMON_EXCLUSIONS = [
  'War, civil war, invasion, or terrorism-related injuries',
  'Self-inflicted injury, suicide, or attempted suicide',
  'Treatment for alcohol or drug abuse',
  'Cosmetic or aesthetic surgery (other than reconstructive)',
  'Experimental or unproven medical treatments',
  'Treatment outside India unless specifically covered',
  'Hazardous sports — bungee jumping, paragliding, mountaineering',
  'Dental treatment unless arising from accident',
  'Routine eye exams and refractive correction',
  'External durable medical equipment (CPAP, walker, glucometer)',
];

const RIDER_POOL = ['critical_illness', 'opd', 'maternity', 'restoration', 'no_claim_bonus_super'];

/**
 * Generate a deterministic set of policy fields. Faker is already seeded by
 * the caller — no additional randomness here.
 */
export function generateHealthFields(
  faker: Faker,
  insurerHint: { exclusionsExtra?: string[]; copayBias?: 0 | 10 | 20 } = {},
): HealthCaseFields {
  const familySize = faker.helpers.arrayElement([1, 1, 1, 2, 2, 3, 4, 5] as number[]) as 1 | 2 | 3 | 4 | 5;
  const policyholderName = faker.person.fullName();
  const age = faker.number.int({ min: 18, max: 72 });
  const sumInsuredLakhs = faker.helpers.arrayElement(SUM_INSURED_OPTIONS);
  const policyTermYears = faker.helpers.arrayElement([1, 1, 1, 2, 3] as const);
  const startMs = faker.date.recent({ days: 365 }).getTime();
  const startDate = new Date(startMs).toISOString().slice(0, 10);
  const endDate = new Date(startMs + policyTermYears * 365 * 86_400_000).toISOString().slice(0, 10);
  const premiumRupees = Math.round(
    sumInsuredLakhs * 1000 + age * 80 + (familySize - 1) * 4500 + faker.number.int({ min: -500, max: 1500 }),
  );
  const nominee = {
    name: faker.person.fullName(),
    relation: faker.helpers.arrayElement(['Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Sibling']),
  };
  const exclusionCount = faker.number.int({ min: 6, max: 9 });
  const exclusionsList = [
    ...faker.helpers.arrayElements(COMMON_EXCLUSIONS, exclusionCount),
    ...(insurerHint.exclusionsExtra ?? []),
  ];
  const ridersCount = faker.number.int({ min: 0, max: 3 });
  const riders = faker.helpers.arrayElements(RIDER_POOL, ridersCount);

  return {
    policyNumber: faker.string.alphanumeric({ length: 12, casing: 'upper' }),
    policyholderName,
    age,
    familySize,
    sumInsuredLakhs,
    premiumRupees,
    policyTermYears,
    startDate,
    endDate,
    nominee,
    hospitalNetworkSize: faker.number.int({ min: 5000, max: 14000 }),
    preExistingWaitingMonths: faker.helpers.arrayElement(PRE_EXISTING_WAITING_OPTIONS),
    specificDiseaseWaitingMonths: faker.helpers.arrayElement(SPECIFIC_DISEASE_WAITING),
    initialWaitingDays: faker.helpers.arrayElement(INITIAL_WAITING_OPTIONS),
    roomRentSubLimit: faker.helpers.weightedArrayElement([
      { value: { kind: 'percent', value: 1 } as const, weight: 4 },
      { value: { kind: 'percent', value: 2 } as const, weight: 3 },
      { value: { kind: 'absolute', value: 5000 } as const, weight: 2 },
      { value: null, weight: 3 },
    ]),
    copayPercent: insurerHint.copayBias ?? faker.helpers.arrayElement(COPAY_OPTIONS),
    exclusionsList,
    riders,
  };
}

/** Deterministic slug for the case name shown in admin UI. */
export function caseNameFor(insurerLabel: string, fields: HealthCaseFields): string {
  const familyTag = fields.familySize === 1 ? 'Indiv' : `Fam${fields.familySize}`;
  return `${insurerLabel} ${familyTag} ₹${fields.sumInsuredLakhs}L #${fields.policyNumber.slice(-6)}`;
}

export function rupeeFmt(n: number): string {
  return '₹' + n.toLocaleString('en-IN');
}

export function lakhFmt(lakhs: number): string {
  return '₹' + lakhs + ' Lakh';
}
