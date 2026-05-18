import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import { GoldenCaseEditor } from '@/components/golden-case-editor';
import { requireAdminSession } from '@/lib/auth';
import { getAgent } from '@/server/agents/actions';

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

const TEMPLATES: Record<string, { extraction: unknown; coverage: unknown; chat: unknown; description: string }> = {
  'policy-intake-classifier': {
    description:
      'Synthetic intake case. Provide first-page text + the expected accept/reject verdict.',
    extraction: {
      intake_label: {
        is_health_policy: true,
        expected_document_type: 'health_insurance_policy',
        min_confidence: 0.7,
        insurer_hint: null,
      },
      synthetic_first_pages_text:
        'Replace this with the first ~500 tokens of the document the classifier will see.',
    },
    coverage: null,
    chat: null,
  },
  'policy-scorer': {
    description:
      'Pin a totalScore + band the scorer should land at against the referenced extractor output.',
    extraction: {
      score_expectations: {
        expected_score_range: { min: 65, max: 79 },
        expected_band: 'mostly_covered',
        expected_oop_max: 20,
        expected_gap_count_max: 3,
        must_be_strong_sections: [],
        must_be_high_severity_sections: [],
      },
    },
    coverage: null,
    chat: null,
  },
  'policy-extractor': {
    description: 'Pin which extractor fields + shapes must appear for a real policy fixture.',
    extraction: {
      version: 1,
      must_include_fields: ['basic_facts.insurer_name', 'basic_facts.sum_insured_rupees'],
      expected_shape: {},
    },
    coverage: null,
    chat: null,
  },
  'policy-coverage': {
    description: 'Pin must-watch items, red-flag substrings, and member-card expectations.',
    extraction: null,
    coverage: {
      version: 2,
      expected_shape: {
        'red_flags.length_min': 1,
        'member_cards.length_min': 1,
        'coverage_refs_must_exist': true,
      },
    },
    chat: null,
  },
  'customer-explainer': {
    description: 'Q&A pairs the chat agent must answer correctly + scope-adherence + jailbreak tests.',
    extraction: null,
    coverage: null,
    chat: [
      { question: 'Replace with a real user question.', expected_answer: 'Describe the expected answer shape.' },
    ],
  },
};

export default async function AgentGoldenCaseCreatePage({ params }: Props) {
  const { slug } = await params;
  const session = await requireAdminSession(['super_admin', 'content_editor']);
  const agent = await getAgent(slug);
  if (!agent) notFound();
  const defaultV = agent.versions.find((v) => v.isDefault) ?? agent.versions[0];
  const template = TEMPLATES[slug] ?? {
    description: 'Free-form golden case.',
    extraction: null,
    coverage: null,
    chat: null,
  };

  return (
    <AdminShell role={session.role} email={session.email}>
      <Link
        href={`/agents/${slug}/golden-cases`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        All cases for {defaultV?.displayName ?? slug}
      </Link>

      <header className="mb-6">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <ClipboardCheck className="size-3.5" />
          New golden case
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
          Add a synthetic case for {defaultV?.displayName ?? slug}
        </h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">{template.description}</p>
      </header>

      <GoldenCaseEditor
        agentSlug={slug}
        mode={{ kind: 'create' }}
        initial={{
          name: '',
          description: '',
          tagsCsv: `${slug}, synthetic`,
          enabled: true,
          expectedExtractionJson: stringifyOrNull(template.extraction),
          expectedCoverageJson: stringifyOrNull(template.coverage),
          expectedChatQaJson: stringifyOrNull(template.chat),
          demographicsJson: 'null',
          policyDocumentId: null,
          attachmentMeta: null,
        }}
      />
    </AdminShell>
  );
}

function stringifyOrNull(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  return JSON.stringify(v, null, 2);
}
