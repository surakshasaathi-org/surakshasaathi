'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/admin/auth';

/**
 * Triggers the customer-side pipeline to re-run all agents against an
 * existing analysis using the latest seeded prompts. Skips the digitizer
 * cache by default (digitizer prompt rarely changes); pass forceDigitize=true
 * to also re-run the vision pass.
 *
 * Cross-app call: admin (port 3001) → web-customer (port 3000) over an
 * internal token. The customer-side endpoint at /api/admin/rerun/[id]
 * resets policy_analysis state and fires runAnalysisPipeline async.
 */

function customerBaseUrl(): string {
  return (
    process.env.WEB_CUSTOMER_INTERNAL_URL?.trim() ||
    process.env.NEXT_PUBLIC_WEB_CUSTOMER_URL?.trim() ||
    'http://localhost:3000'
  );
}

function adminToken(): string | null {
  return (
    process.env.ADMIN_INTERNAL_TOKEN?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    null
  );
}

export async function rerunAnalysisAction(
  analysisId: string,
  opts?: { forceDigitize?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdminSession(['super_admin', 'admin']);
  const token = adminToken();
  if (!token) {
    return { ok: false, error: 'ADMIN_INTERNAL_TOKEN / SUPABASE_SERVICE_ROLE_KEY not configured' };
  }

  const force = opts?.forceDigitize ? '?force_digitize=1' : '';
  const url = `${customerBaseUrl()}/api/admin/rerun/${analysisId}${force}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-admin-token': token,
        'content-type': 'application/json',
      },
      cache: 'no-store',
    });
  } catch (err) {
    return { ok: false, error: `customer endpoint unreachable: ${(err as Error).message}` };
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => '');
    }
    return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(body).slice(0, 240)}` };
  }

  // Bust the cached snapshot of this analysis page + the timeline so the
  // refresh-on-button-press shows status='queued' immediately.
  revalidatePath(`/analyses/${analysisId}`);
  revalidatePath(`/analyses/${analysisId}/trace`);
  revalidatePath('/analyses');
  return { ok: true };
}
