import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import { Badge } from '@suraksha/ui';
import { AdminShell } from '@/components/admin-shell';
import { GoldenCaseEditor } from '@/components/golden-case-editor';
import { requireAdminSession } from '@/lib/auth';
import { getAgent } from '@/server/agents/actions';
import { getGoldenCase } from '@/server/evals/golden-actions';

interface Props {
  params: Promise<{ slug: string; caseId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function AgentGoldenCaseEditPage({ params }: Props) {
  const { slug, caseId } = await params;
  const session = await requireAdminSession([
    'super_admin',
    'admin',
    'content_editor',
    'viewer',
  ]);
  const agent = await getAgent(slug);
  if (!agent) notFound();
  const c = await getGoldenCase(caseId);
  if (!c) notFound();
  const defaultV = agent.versions.find((v) => v.isDefault) ?? agent.versions[0];

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
          Golden case
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">{c.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
          {c.verifiedAt ? <Badge tone="success">verified</Badge> : <Badge tone="warn">unverified</Badge>}
          {!c.enabled && <Badge tone="neutral">paused</Badge>}
          <span>·</span>
          <span>updated {new Date(c.updatedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
          {c.annotator && <span>· by {c.annotator}</span>}
        </div>
      </header>

      <GoldenCaseEditor
        agentSlug={slug}
        mode={{ kind: 'edit', caseId: c.id }}
        initial={{
          name: c.name,
          description: c.description ?? '',
          tagsCsv: c.tags.join(', '),
          enabled: c.enabled,
          expectedExtractionJson: stringifyOrNull(c.expectedExtraction),
          expectedCoverageJson: stringifyOrNull(c.expectedCoverage),
          expectedChatQaJson: stringifyOrNull(c.expectedChatQa),
          demographicsJson: stringifyOrNull(c.demographicsJson),
          policyDocumentId: c.policyDocumentId,
          attachmentMeta: c.attachment
            ? {
                mime: c.attachment.mime,
                sizeBytes: c.attachment.sizeBytes,
                contentSha256: c.attachment.contentSha256,
              }
            : null,
        }}
      />
    </AdminShell>
  );
}

function stringifyOrNull(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  return JSON.stringify(v, null, 2);
}
