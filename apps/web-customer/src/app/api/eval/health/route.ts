import { NextResponse } from 'next/server';
import { getEvalSamplerCounters } from '@/server/eval/prod-sampling';

/**
 * Read-only ops endpoint exposing the in-process eval sampler counters.
 * Mount behind your admin dashboard or scrape with a simple cron that pages
 * when `failed / sampled > 0.2` over the last 24h.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const counters = getEvalSamplerCounters();
  const healthy = counters.sampled === 0 || counters.failed / counters.sampled < 0.2;
  return NextResponse.json(
    {
      healthy,
      ...counters,
      last_failure_age_seconds:
        counters.lastFailureAt > 0 ? Math.floor((Date.now() - counters.lastFailureAt) / 1000) : null,
    },
    { status: healthy ? 200 : 500 },
  );
}
