/**
 * Seed the database with Day-1 data: reference tables, 8 product modules,
 * default agent definitions, feature flags, and the default `surakshasaathi` tenant.
 *
 * Run with: pnpm --filter @suraksha/db seed
 */
import { serviceDb } from '../client';
import * as schema from '../schema';
import { seedLocales } from './locales';
import { seedInsuranceLines } from './insurance-lines';
import { seedTenants } from './tenants';
import { seedProductModules } from './product-modules';
import { seedAgentDefinitions } from './agent-definitions';
import { seedSchemes } from './schemes';
import { seedFeatureFlags } from './feature-flags';
import { seedAffiliatePartners } from './affiliate-partners';
import { seedEvalRubrics } from './eval-rubrics';
import { seedEvalGoldenCases } from './eval-golden-cases';

async function main() {
  const db = serviceDb();
  console.log('[seed] starting');

  await seedLocales(db, schema);
  await seedInsuranceLines(db, schema);
  await seedTenants(db, schema);
  await seedProductModules(db, schema);
  await seedAgentDefinitions(db, schema);
  await seedEvalRubrics(db, schema);
  await seedEvalGoldenCases(db, schema);
  await seedSchemes(db, schema);
  await seedFeatureFlags(db, schema);
  await seedAffiliatePartners(db, schema);

  console.log('[seed] done');
}

main().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
