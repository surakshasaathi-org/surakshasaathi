/**
 * Template registry. Lookup is line-keyed (insurance_line) → template-keyed
 * (template slug). Adding a new line or insurer is dropping a folder + a
 * row here; nothing else in the Eval Lab knows insurer names.
 *
 * The PolicyTemplate interface (see ./types) is the only contract the
 * generator depends on — registry membership is the only thing the dataset
 * UI depends on. Per the cross-product scalability decision (PRD §5b),
 * Claims Advocacy / Govt Scheme Navigator / etc. plug in by adding a new
 * line folder under `./<line>/` and a row in REGISTRY_BY_LINE.
 */

import type { PolicyTemplate } from './types';
import { hdfcErgoOptimaTemplate } from './health/hdfc-ergo';
import { starComprehensiveTemplate } from './health/star';
import { nivaBupaReassureTemplate } from './health/niva-bupa';

export type { PolicyTemplate, TemplateContext, RenderedTemplate, ExpectedOutputs } from './types';

const HEALTH_TEMPLATES: PolicyTemplate[] = [
  hdfcErgoOptimaTemplate,
  starComprehensiveTemplate,
  nivaBupaReassureTemplate,
];

/**
 * Public registry — keyed by insurance_line (matches insurance_line.id in
 * the catalog table). Day-1 keys are limited to 'health' per the launch
 * decision; term-life / motor / etc. arrive when their agents do.
 */
export const REGISTRY_BY_LINE: Record<string, readonly PolicyTemplate[]> = {
  health: HEALTH_TEMPLATES,
};

/** All registered templates as a flat list, regardless of line. */
export function listAllTemplates(): readonly PolicyTemplate[] {
  return Object.values(REGISTRY_BY_LINE).flat();
}

/** Templates available for a specific insurance line. Returns [] for unknown lines. */
export function templatesForLine(line: string): readonly PolicyTemplate[] {
  return REGISTRY_BY_LINE[line] ?? [];
}

/** Lookup a single template by slug. */
export function getTemplate(slug: string): PolicyTemplate | undefined {
  return listAllTemplates().find((t) => t.slug === slug);
}
