import 'server-only';
import type { ProductModule } from '@suraksha/types';
import { STATIC_MODULES } from './modules-static';

/**
 * Module loader with graceful DB-free fallback.
 *
 * When DATABASE_URL is set, we read `product_module` rows from Postgres (and
 * scope by `tenant.enabledModules`). When it isn't, we return the static
 * fallback defined in `modules-static.ts` so the landing page renders during
 * local dev + Vercel preview deploys without Supabase credentials.
 *
 * The DB path is lazily imported so this file doesn't crash in dev without
 * @suraksha/db env.
 */

const HAS_DB = !!(process.env.DATABASE_URL ?? process.env.DIRECT_DATABASE_URL);

export async function loadActiveModulesForTenant(tenantId: string): Promise<ProductModule[]> {
  if (!HAS_DB) {
    return STATIC_MODULES.filter(isEnabledForStaticTenant(tenantId));
  }

  const { serviceDb, schema } = await import('@suraksha/db');
  const { asc, eq } = await import('drizzle-orm');

  const db = serviceDb();
  const rows = await db
    .select()
    .from(schema.productModule)
    .orderBy(asc(schema.productModule.orderIndex));

  const tenant = await db
    .select({ enabledModules: schema.tenant.enabledModules })
    .from(schema.tenant)
    .where(eq(schema.tenant.id, tenantId))
    .limit(1);

  const allow = new Set(tenant[0]?.enabledModules ?? []);
  if (allow.size === 0) return [];

  return rows
    .filter((r) => allow.has(r.id))
    .map(mapDbRow);
}

export async function loadModuleBySlug(slug: string): Promise<ProductModule | null> {
  if (!HAS_DB) {
    return STATIC_MODULES.find((m) => m.id === slug) ?? null;
  }

  const { serviceDb, schema } = await import('@suraksha/db');
  const { eq } = await import('drizzle-orm');

  const db = serviceDb();
  const [row] = await db
    .select()
    .from(schema.productModule)
    .where(eq(schema.productModule.id, slug))
    .limit(1);
  if (!row) return null;
  return mapDbRow(row);
}

function isEnabledForStaticTenant(_tenantId: string) {
  // Static fallback doesn't model per-tenant filtering — all 8 modules ship
  // on the public B2C surface.
  return () => true;
}

// Lazy-typed row mapper — avoids importing DB schema types when DB path isn't loaded.
function mapDbRow(r: Record<string, unknown>): ProductModule {
  return {
    id: r.id as ProductModule['id'],
    cluster: r.cluster as ProductModule['cluster'],
    nameI18n: r.nameI18n as ProductModule['nameI18n'],
    taglineI18n: r.taglineI18n as ProductModule['taglineI18n'],
    heroHeadlineI18n: r.heroHeadlineI18n as ProductModule['heroHeadlineI18n'],
    heroSubheadI18n: r.heroSubheadI18n as ProductModule['heroSubheadI18n'],
    landingRoute: r.landingRoute as string,
    pricingModel: r.pricingModel as ProductModule['pricingModel'],
    authRequired: r.authRequired as ProductModule['authRequired'],
    launchLocales: r.launchLocales as ProductModule['launchLocales'],
    status: r.status as ProductModule['status'],
    intakeFlowId: r.intakeFlowId as string | null,
    agentDefinitionIds: r.agentDefinitionIds as string[],
    orderIndex: r.orderIndex as number,
    iconSlug: r.iconSlug as string | null,
  };
}
