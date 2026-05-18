/**
 * Template registry contract. Every synthetic-policy template implements this
 * interface so the generator iterates the registry uniformly. Adding a new
 * insurer template (or a new insurance line) is dropping a folder + an index
 * entry — zero changes to the generator, dataset UI, or runner.
 */

import type { Faker } from '@faker-js/faker';

export interface TemplateContext {
  /** Deterministic Faker bound to this case's seed. */
  faker: Faker;
  /** Per-case integer seed (also stored on eval_golden_case.seed). */
  seed: number;
  /** Locale for any text rendered into the PDF (Day 1: 'en'). */
  locale: 'en' | 'hi' | 'kn';
}

/** What the generator stamps into eval_golden_case for each agent's expected output. */
export interface ExpectedOutputs {
  /** Matches policy-extractor's output_schema. */
  expectedExtraction: Record<string, unknown>;
  /** Matches policy-coverage's output_schema. */
  expectedCoverage: Record<string, unknown>;
  /** Question/expected-answer pairs for customer-explainer / chat eval. */
  expectedChatQa: Array<{ question: string; expected_answer: string }>;
  /** Demographics that gate eligibility logic (age, family size, sum-insured choice). */
  demographics: Record<string, unknown>;
}

export interface RenderedTemplate {
  /** Deterministic, human-readable name for this case (e.g. "HDFC Optima Family ₹10L #4823"). */
  caseName: string;
  /** HTML to be rendered to PDF by the generator runner. Self-contained — inline CSS only. */
  html: string;
  /** Expected outputs for every agent that will run on this case. */
  expected: ExpectedOutputs;
}

export interface PolicyTemplate {
  /** Unique stable slug — stored on eval_golden_case.template_slug. */
  slug: string;
  /** Insurance line this template applies to. References insurance_line.id. */
  insuranceLine: string;
  /** Display name for the admin UI ("HDFC ERGO Optima Secure (look-alike)"). */
  displayName: string;
  /** Render a single case from the template + a deterministic context. */
  render(ctx: TemplateContext): RenderedTemplate;
}
