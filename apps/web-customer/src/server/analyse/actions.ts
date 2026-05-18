'use server';
import { randomUUID, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getAnalysisStore } from './store';
import { runAnalysisPipeline, NotAHealthPolicyError, UpstreamUnavailableError } from './pipeline';
import { uploadPolicyDocument, STORAGE_PATH_PREFIX } from './storage';
import { supabaseServer } from '@/lib/supabase-server';
import { headers } from 'next/headers';
import {
  assertUploadRateLimit,
  assertDailyCostCap,
  humanLimitMessage,
  recordUploadEvent,
} from '@/server/safety/rate-limit';
import { issueAnalysisTokenCookie } from '@/server/safety/analysis-access';

const ACCEPTED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
]);

const MAX_BYTES = 20 * 1024 * 1024;

export interface StartAnalysisInput {
  locale: string;
  file: File;
  /**
   * Optional demographics form — when omitted, the pipeline synthesises one
   * entry per member the extractor finds in the policy itself.
   */
  demographics?: Record<string, unknown> | null;
}

export type StartAnalysisResult =
  | { ok: true; analysisId: string }
  | {
      ok: false;
      code:
        | 'file_missing'
        | 'file_too_large'
        | 'unsupported_type'
        | 'upload_failed'
        | 'rate_limit_uploads_hour'
        | 'rate_limit_uploads_day'
        | 'cost_cap_daily';
      message: string;
    };

export async function startAnalysis(input: StartAnalysisInput): Promise<StartAnalysisResult> {
  const { file, locale } = input;

  if (!file || !(file instanceof File) || file.size === 0) {
    return { ok: false, code: 'file_missing', message: 'No file received.' };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      code: 'file_too_large',
      message: 'File is over 20 MB. Please compress or upload a smaller version.',
    };
  }
  if (!ACCEPTED_MIMES.has(file.type)) {
    return {
      ok: false,
      code: 'unsupported_type',
      message: 'File type not supported. Please upload a PDF or a photo (JPG / PNG / HEIC).',
    };
  }

  let buf: ArrayBuffer;
  try {
    buf = await file.arrayBuffer();
  } catch {
    return { ok: false, code: 'upload_failed', message: 'Could not read the file.' };
  }

  const bytes = Buffer.from(buf);
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  const analysisId = randomUUID();
  const sessionToken = randomUUID();

  const storagePath = `${STORAGE_PATH_PREFIX}${analysisId}/${sanitise(file.name)}`;
  try {
    await uploadPolicyDocument(storagePath, bytes, file.type);
  } catch (err) {
    return {
      ok: false,
      code: 'upload_failed',
      message: 'Storage write failed: ' + (err as Error).message,
    };
  }

  const pageCount = guessPageCount(file);

  // Signed-in? Claim the analysis to their account immediately.
  const supabase = await supabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  const userId: string | null = authData.user?.id ?? null;

  // Extract the caller's IP and User-Agent so we can enforce anonymous limits.
  // `x-forwarded-for` is set by Vercel + most proxies; fall back to `x-real-ip`.
  // In dev there's often no proxy, so we tolerate null IP with a log warning
  // in rate-limit.ts.
  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    hdrs.get('x-real-ip')?.trim() ??
    null;
  const userAgent = hdrs.get('user-agent');

  const identity = { userId, ip, tenantId: 'surakshasaathi' };
  const rateCheck = await assertUploadRateLimit(identity);
  if (rateCheck) return { ok: false, code: rateCheck, message: humanLimitMessage(rateCheck) };
  const costCheck = await assertDailyCostCap(identity);
  if (costCheck) return { ok: false, code: costCheck, message: humanLimitMessage(costCheck) };

  const store = getAnalysisStore();
  await store.create({
    id: analysisId,
    sessionToken,
    tenantId: 'surakshasaathi',
    userId,
    locale: normaliseLocale(locale),
    status: 'queued',
    progressStep: 'Queued — starting in a moment',
    startedAt: null,
    readyAt: null,
    report: null,
    errorCode: null,
    errorMessage: null,
    costPaise: 0,
    readinessScore: null,
    redFlagsCount: null,
    confidenceOverall: null,
    demographics: input.demographics ?? null,
    agentRunIds: [],
    fileMeta: {
      name: file.name,
      mime: file.type,
      size: file.size,
      pageCount,
      storagePath,
      sha256,
    },
  });

  // Issue the per-analysis access-token cookie (HttpOnly) — this is what proves
  // the browser is authorised to read/write chat + feedback. Separate from
  // ss_analyses (UI-only list for claim-on-signin).
  await issueAnalysisTokenCookie(analysisId, sessionToken);

  // Record the upload event so anonymous IP-based rate-limit can count it on
  // the next request. Non-fatal: even if this fails, we shouldn't reject a
  // user's already-accepted upload.
  try {
    await recordUploadEvent({
      tenantId: 'surakshasaathi',
      userId,
      analysisId,
      ip,
      userAgent,
    });
  } catch (err) {
    console.warn('[actions] recordUploadEvent failed', analysisId, (err as Error).message);
  }

  // Anonymous users: remember this id in a cookie so we can claim on signup.
  if (!userId) {
    await rememberAnonymousAnalysisId(analysisId);
  }

  void runAnalysisPipeline(analysisId).catch(async (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[pipeline] analysis failed', { analysisId, err: msg });
    // Idempotency guard: only transition to 'failed' if the pipeline hasn't
    // already reached a terminal state. Otherwise a late-thrown error (e.g.
    // in a cleanup step) would clobber a successful 'ready' row.
    const current = await getAnalysisStore().get(analysisId);
    if (!current) return;
    if (current.status === 'ready' || current.status === 'failed') return;

    // Intake-gate rejection gets a distinct error code so the UI can show a
    // targeted "this isn't a health policy" message instead of a generic
    // pipeline failure. Users who think we got it wrong can retry or contact us.
    if (err instanceof NotAHealthPolicyError) {
      await getAnalysisStore().update(analysisId, {
        status: 'failed',
        progressStep: null,
        errorCode: 'not_a_policy',
        errorMessage: `${err.detectedType}: ${err.reason}`.slice(0, 500),
      });
      return;
    }

    // Upstream LLM provider failure (Gemini 429/5xx etc.) — the document is
    // probably fine, we just couldn't reach the model. Show a retry-friendly
    // banner rather than implying the user did something wrong.
    if (err instanceof UpstreamUnavailableError) {
      await getAnalysisStore().update(analysisId, {
        status: 'failed',
        progressStep: null,
        errorCode: 'upstream_unavailable',
        errorMessage: `Stage ${err.stage} failed: ${msg}`.slice(0, 500),
      });
      return;
    }

    await getAnalysisStore().update(analysisId, {
      status: 'failed',
      progressStep: null,
      errorCode: 'pipeline_error',
      errorMessage: msg.slice(0, 500),
    });
  });

  return { ok: true, analysisId };
}

export async function deleteAnalysisAction(analysisId: string): Promise<{ ok: boolean }> {
  const ok = await getAnalysisStore().delete(analysisId);
  if (ok) revalidatePath(`/policy-health-score/analysis/${analysisId}`);
  return { ok };
}

function normaliseLocale(locale: string): string {
  if (['en', 'hi', 'kn'].includes(locale)) return locale;
  return 'en';
}

function guessPageCount(file: File): number | null {
  if (file.type === 'application/pdf') return 30;
  return 1;
}

function sanitise(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 200);
}

async function rememberAnonymousAnalysisId(id: string) {
  const cookieStore = await cookies();
  const raw = cookieStore.get('ss_analyses')?.value ?? '[]';
  let ids: string[] = [];
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (Array.isArray(parsed)) ids = parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    ids = [];
  }
  if (ids.includes(id)) return;
  ids.unshift(id);
  ids = ids.slice(0, 20);
  cookieStore.set({
    name: 'ss_analyses',
    value: encodeURIComponent(JSON.stringify(ids)),
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
    httpOnly: false,
    sameSite: 'lax',
  });
}
