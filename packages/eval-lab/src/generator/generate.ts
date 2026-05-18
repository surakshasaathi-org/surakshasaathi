import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import type { PolicyTemplate, RenderedTemplate } from '../templates/types';
import { templatesForLine, getTemplate } from '../templates';
import { seededFaker, caseSeed } from './seed';

/**
 * Synthetic dataset generator. Driven entirely by the eval_dataset row:
 *   * insurance_line  → which template registry to draw from
 *   * template_mix    → relative weights per template slug (e.g. {hdfc-ergo: 0.4, star: 0.4, niva-bupa: 0.2})
 *   * seed            → master seed for the dataset; combined with case index per row
 *   * case_count      → how many golden cases to materialise
 *
 * For each case we:
 *   1. pick a template by weighted draw from the dataset's template_mix
 *   2. derive a per-case seed (stable across regenerations)
 *   3. build a seeded Faker, render the template to HTML + expected outputs
 *   4. hand HTML to the caller's `renderHtmlToPdf` (Playwright lives outside
 *      the package — Vercel functions don't have it; Trigger.dev tasks do)
 *   5. upload PDF bytes via the caller's `uploadPdf`
 *   6. persist eval_golden_case rows with synthetic=true, seed, template_slug
 *
 * No Anthropic / Gemini / any LLM is called — this is the WHOLE POINT of
 * synthetic generation: known-correct expected outputs come from the
 * generator itself, not a model. Determinism is the regression-eval
 * substrate; using an LLM here would defeat the eval's purpose.
 */

export interface PdfRenderer {
  /** Render an HTML string to PDF bytes (A4, default margins). The caller's
   *  responsibility — Playwright in Trigger.dev tasks, or a stub that throws
   *  in environments where headless browsers aren't available. */
  (html: string, opts: { caseName: string }): Promise<Uint8Array>;
}

export interface PdfUploader {
  /** Upload PDF bytes to whichever storage the caller manages (Supabase
   *  Storage in prod). Returns the document_id for the resulting policy_document
   *  row, OR null when the dataset is being generated in dry-run mode. */
  (pdf: Uint8Array, meta: { caseName: string; templateSlug: string }): Promise<string | null>;
}

export interface GenerateDatasetArgs {
  datasetId: string;
  /** Optional admin user id, written to created_by on the dataset and golden cases. */
  startedBy?: string | null;
  /** Tenant id all generated rows belong to. Defaults to 'surakshasaathi'. */
  tenantId?: string;
  /** Dry-run: generate cases + persist their seeds/HTML/expected outputs but
   *  skip PDF rendering + upload + policy_document linkage. Used by previews
   *  and unit tests. */
  dryRun?: boolean;
  /** Renders HTML to PDF bytes. Required unless dryRun=true. */
  renderHtmlToPdf?: PdfRenderer;
  /** Uploads PDF bytes and returns a policy_document id. Required unless dryRun=true. */
  uploadPdf?: PdfUploader;
}

export interface GenerateDatasetResult {
  datasetId: string;
  generated: number;
  caseIds: string[];
  /** When dryRun=true, the rendered HTML is returned in-memory for preview UI. */
  previews?: Array<{ caseSeed: number; templateSlug: string; rendered: RenderedTemplate }>;
}

/**
 * Run-and-persist the dataset. Idempotent over (dataset_id) — re-running
 * deletes any prior golden cases attached to this dataset and rewrites
 * them with the same seeds, so a regenerate produces identical content.
 */
export async function generateDataset(args: GenerateDatasetArgs): Promise<GenerateDatasetResult> {
  const tenantId = args.tenantId ?? 'surakshasaathi';
  const db = serviceDb();

  const [dataset] = await db
    .select()
    .from(schema.evalDataset)
    .where(eq(schema.evalDataset.id, args.datasetId))
    .limit(1);
  if (!dataset) throw new Error(`eval_dataset not found: ${args.datasetId}`);

  const templates = pickTemplatesForMix(dataset.insuranceLine, dataset.templateMix);
  if (templates.length === 0) {
    throw new Error(
      `no templates registered for insurance_line=${dataset.insuranceLine} (template_mix=${JSON.stringify(dataset.templateMix)})`,
    );
  }
  const weighted = normaliseWeights(dataset.templateMix, templates);

  // Wipe prior synthetic cases so regen is deterministic. Manually-curated
  // cases attached to this dataset (synthetic=false) are preserved — admins
  // shouldn't lose hand-uploaded golden cases on a regenerate click.
  await db
    .delete(schema.evalGoldenCase)
    .where(
      // dataset_id = X AND synthetic = true
      eq(schema.evalGoldenCase.datasetId, args.datasetId),
    );

  const caseIds: string[] = [];
  const previews: GenerateDatasetResult['previews'] = args.dryRun ? [] : undefined;

  for (let i = 0; i < dataset.caseCount; i += 1) {
    const cs = caseSeed(dataset.seed, i);
    const faker = seededFaker(cs);
    const template = pickByDeterministicWeight(weighted, cs);

    const rendered = template.render({ faker, seed: cs, locale: 'en' });

    let policyDocumentId: string | null = null;
    if (!args.dryRun) {
      if (!args.renderHtmlToPdf || !args.uploadPdf) {
        throw new Error('renderHtmlToPdf and uploadPdf are required when dryRun=false');
      }
      const pdf = await args.renderHtmlToPdf(rendered.html, { caseName: rendered.caseName });
      policyDocumentId = await args.uploadPdf(pdf, {
        caseName: rendered.caseName,
        templateSlug: template.slug,
      });
    } else {
      previews!.push({ caseSeed: cs, templateSlug: template.slug, rendered });
    }

    const id = randomUUID();
    // eval_golden_case is intentionally tenant-less — golden cases are
    // platform-wide reference data, not tenant-business rows. (`tenantId`
    // sits on eval_run + agent_run, not on the case.)
    await db.insert(schema.evalGoldenCase).values({
      id,
      name: rendered.caseName,
      description: `Synthetic — ${template.displayName}`,
      datasetId: args.datasetId,
      insuranceLineId: dataset.insuranceLine,
      synthetic: true,
      seed: cs,
      templateSlug: template.slug,
      stale: false,
      policyDocumentId,
      demographicsJson: rendered.expected.demographics,
      expectedExtraction: rendered.expected.expectedExtraction,
      expectedCoverage: rendered.expected.expectedCoverage,
      expectedChatQa: rendered.expected.expectedChatQa,
      annotator: 'eval-lab-generator',
      verifiedAt: new Date(),
      enabled: true,
      tags: ['synthetic', dataset.insuranceLine, template.slug],
    });
    caseIds.push(id);
  }
  // tenantId is accepted as an arg for forward-compat with future
  // tenant-scoped golden cases but currently unused by the schema.
  void tenantId;

  return {
    datasetId: args.datasetId,
    generated: caseIds.length,
    caseIds,
    previews,
  };
}

function pickTemplatesForMix(line: string, mix: Record<string, number>): PolicyTemplate[] {
  const lineTemplates = templatesForLine(line);
  if (Object.keys(mix).length === 0) {
    // No mix specified → use every template registered for the line, equal weight.
    return [...lineTemplates];
  }
  const out: PolicyTemplate[] = [];
  for (const slug of Object.keys(mix)) {
    const t = getTemplate(slug);
    if (t && t.insuranceLine === line) out.push(t);
  }
  return out;
}

function normaliseWeights(
  mix: Record<string, number>,
  templates: PolicyTemplate[],
): Array<{ template: PolicyTemplate; weight: number }> {
  const weights = templates.map((t) => ({
    template: t,
    weight: typeof mix[t.slug] === 'number' && mix[t.slug]! > 0 ? mix[t.slug]! : 1,
  }));
  const total = weights.reduce((a, b) => a + b.weight, 0) || 1;
  return weights.map((w) => ({ template: w.template, weight: w.weight / total }));
}

/**
 * Deterministic template pick — same case-seed always lands on the same
 * template even as the dataset is regenerated. Uses the per-case seed
 * itself (mod 1) as the draw value rather than calling the Faker PRNG,
 * so picks are stable across template-mix tweaks.
 */
function pickByDeterministicWeight(
  weighted: Array<{ template: PolicyTemplate; weight: number }>,
  cs: number,
): PolicyTemplate {
  const draw = (cs >>> 0) / 0xffffffff;
  let acc = 0;
  for (const w of weighted) {
    acc += w.weight;
    if (draw < acc) return w.template;
  }
  // Floating-point fallthrough — pick the last template.
  return weighted[weighted.length - 1]!.template;
}
