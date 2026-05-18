'use server';
import { desc, eq, and } from 'drizzle-orm';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { serviceDb, schema } from '@suraksha/db';
import { supabaseServer } from '@/lib/supabase-server';
import {
  CONSENT_PURPOSES,
  POLICY_VERSION,
  type ConsentPurposeDef,
  type ConsentState,
} from './consent-config';

/**
 * DPDP Act 2023 consent capture + withdrawal server actions. Config (purpose
 * list, policy version, types) lives in `consent-config.ts` — Next.js 15's
 * 'use server' directive only accepts async exports, so non-async values had
 * to move out.
 */

async function requireUserId(): Promise<string | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function listMyConsents(): Promise<ConsentState[]> {
  const userId = await requireUserId();
  if (!userId) return CONSENT_PURPOSES.map(toDefaultState);

  const db = serviceDb();
  const rows = await db
    .select()
    .from(schema.consent)
    .where(eq(schema.consent.userId, userId))
    .orderBy(desc(schema.consent.createdAt));

  // Latest row per purpose wins. History is preserved in the table for audit;
  // this API returns the current "effective" state.
  const latestByPurpose = new Map<string, typeof rows[number]>();
  for (const r of rows) {
    if (!latestByPurpose.has(r.purpose)) latestByPurpose.set(r.purpose, r);
  }

  return CONSENT_PURPOSES.map((p) => {
    const row = latestByPurpose.get(p.id);
    if (!row) return toDefaultState(p);
    return {
      purposeId: p.id,
      granted: row.granted,
      grantedAt: row.grantedAt.toISOString(),
      policyVersion: row.policyVersion,
    };
  });
}

function toDefaultState(p: ConsentPurposeDef): ConsentState {
  return { purposeId: p.id, granted: p.defaultGranted, grantedAt: null, policyVersion: null };
}

export interface SetConsentResult {
  ok: boolean;
  message?: string;
}

export async function setConsent(
  purposeId: string,
  granted: boolean,
): Promise<SetConsentResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: 'Please sign in.' };

  const purpose = CONSENT_PURPOSES.find((p) => p.id === purposeId);
  if (!purpose) return { ok: false, message: 'Unknown consent purpose.' };
  if (purpose.required && !granted) {
    return {
      ok: false,
      message: `${purpose.label} is required for the app to work. Delete your account from Settings if you no longer consent.`,
    };
  }

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    hdrs.get('x-real-ip')?.trim() ??
    null;
  const userAgent = hdrs.get('user-agent');

  const db = serviceDb();
  try {
    await db.insert(schema.consent).values({
      tenantId: 'surakshasaathi',
      userId,
      purpose: purposeId,
      granted,
      grantedAt: new Date(),
      sourceIp: ip,
      userAgent: userAgent?.slice(0, 500) ?? null,
      policyVersion: POLICY_VERSION,
      metadata: {},
    });

    try {
      await db.insert(schema.auditLog).values({
        tenantId: 'surakshasaathi',
        actorUserId: userId,
        actorKind: 'user',
        action: granted ? 'consent.granted' : 'consent.withdrawn',
        subjectType: 'consent',
        subjectId: `${userId}:${purposeId}`,
        payload: { purpose: purposeId, policy_version: POLICY_VERSION },
        ipAddress: ip,
        userAgent: userAgent?.slice(0, 500) ?? null,
      });
    } catch {
      /* non-fatal */
    }

    revalidatePath('/my/settings', 'page');
    return { ok: true };
  } catch (err) {
    return { ok: false, message: (err as Error).message.slice(0, 200) };
  }
}

export async function bulkGrantDefaultConsents(): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false };

  const db = serviceDb();
  for (const p of CONSENT_PURPOSES.filter((x) => x.required)) {
    const [existing] = await db
      .select({ id: schema.consent.id })
      .from(schema.consent)
      .where(and(eq(schema.consent.userId, userId), eq(schema.consent.purpose, p.id)))
      .limit(1);
    if (existing) continue;
    await db.insert(schema.consent).values({
      tenantId: 'surakshasaathi',
      userId,
      purpose: p.id,
      granted: true,
      grantedAt: new Date(),
      policyVersion: POLICY_VERSION,
      metadata: { source: 'signup_implicit' },
    });
  }
  return { ok: true };
}
