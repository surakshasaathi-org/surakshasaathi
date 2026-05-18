'use server';

import { eq } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import { supabaseServer } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export async function setScoringProfile(cityTier: 'metro' | 'tier_2' | 'tier_3'): Promise<{ ok: boolean; error?: string }> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: 'not_authenticated' };

  const db = serviceDb();
  await db
    .update(schema.appUser)
    .set({ scoringProfileJson: { cityTier } })
    .where(eq(schema.appUser.id, data.user.id));

  // Refresh any policy-detail page — scores get recomputed lazily on next
  // analysis; for now the profile just drives future computes.
  revalidatePath('/[locale]/my/policies/[id]', 'page');
  return { ok: true };
}
