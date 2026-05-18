import 'server-only';

/**
 * Admin-side mirror of how a module's agents wire together at runtime.
 *
 * This is display-only — the authoritative pipeline lives in the runtime code
 * (e.g. apps/web-customer/src/server/analyse/pipeline.ts). Keep in sync by hand
 * until the flow graph moves into the DB. A mismatch only mis-paints the
 * admin Product hub; it cannot affect customer behaviour.
 *
 * Adding a new module: append a ProductFlow with one lane per trigger surface
 * (pipeline / on_demand / scheduled). Within a lane, steps render left-to-right
 * joined by arrows.
 */

export type FlowLaneKind = 'pipeline' | 'on_demand' | 'scheduled' | 'manual';

export interface FlowStep {
  /** Matches an agent_definition.slug in the registry. */
  agentSlug: string;
  /** Short note rendered under the card. */
  note?: string;
  /** Edge label drawn before this step — e.g. "if health policy". */
  edgeLabel?: string;
  /** Dotted card outline + "(optional)" suffix. */
  optional?: boolean;
}

export interface FlowLane {
  kind: FlowLaneKind;
  title: string;
  description?: string;
  steps: FlowStep[];
}

export interface ProductFlow {
  moduleId: string;
  lanes: FlowLane[];
}

const FLOWS: ProductFlow[] = [
  {
    moduleId: 'policy-health-score',
    lanes: [
      {
        kind: 'pipeline',
        title: 'Analyse-My-Policy pipeline',
        description: 'Trigger.dev workflow on PDF/photo upload. ~60–120s end-to-end.',
        steps: [
          { agentSlug: 'policy-digitizer', note: 'vision pass · markdown + page index · cached' },
          { agentSlug: 'policy-intake-classifier', edgeLabel: 'on digitized markdown', note: 'gate · is health policy?' },
          { agentSlug: 'policy-extractor', edgeLabel: 'if health', note: '25+ structured fields · text-only' },
          { agentSlug: 'policy-coverage', note: 'qualitative member cards + red flags' },
          { agentSlug: 'policy-scorer', edgeLabel: 'on extractor JSON', note: 'deterministic · 13-section weighted score · /scoring/rules' },
        ],
      },
      {
        kind: 'on_demand',
        title: 'Follow-up chat',
        description: 'Streams on each user question on the report page.',
        steps: [
          { agentSlug: 'customer-explainer', note: 'policy-bounded · streamed' },
        ],
      },
    ],
  },
  {
    moduleId: 'govt-scheme-navigator',
    lanes: [
      {
        kind: 'pipeline',
        title: 'Eligibility check',
        description: 'Anonymous, free. Runs on profile form submit.',
        steps: [
          { agentSlug: 'scheme-matcher', note: 'central + state schemes' },
        ],
      },
    ],
  },
];

export function getProductFlow(moduleId: string): ProductFlow | null {
  return FLOWS.find((f) => f.moduleId === moduleId) ?? null;
}
