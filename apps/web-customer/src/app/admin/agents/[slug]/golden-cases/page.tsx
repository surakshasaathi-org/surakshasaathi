import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ClipboardCheck, FlaskConical, Plus } from 'lucide-react';
import { Badge } from '@suraksha/ui';
import { AdminShell } from '@/components/admin/admin-shell';
import { GoldenCaseToggle } from '@/components/admin/golden-case-toggle';
import { EvalRunControls } from '@/components/admin/eval-run-controls';
import { RunSingleCase } from '@/components/admin/run-single-case';
import { LastRunPill } from '@/components/admin/last-run-pill';
import { requireAdminSession } from '@/lib/admin/auth';
import { getAgent } from '@/server/admin/agents/actions';
import {
  getLastEvalRunsByCase,
  listAgentVersions,
  listGoldenCasesForAgent,
} from '@/server/admin/evals/golden-actions';

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

export default async function AgentGoldenCasesPage({ params }: Props) {
  const { slug } = await params;
  const session = await requireAdminSession([
    'super_admin',
    'admin',
    'content_editor',
    'viewer',
  ]);
  const agent = await getAgent(slug);
  if (!agent) notFound();
  const defaultV = agent.versions.find((v) => v.isDefault) ?? agent.versions[0];
  const displayName = defaultV?.displayName ?? agent.slug;

  const cases = await listGoldenCasesForAgent(slug);
  const enabledCount = cases.filter((c) => c.enabled).length;
  const [lastRuns, versions] = await Promise.all([
    getLastEvalRunsByCase(slug, cases.map((c) => c.id)),
    listAgentVersions(slug),
  ]);

  return (
    <AdminShell role={session.role} email={session.email}>
      <Link
        href={`/agents/${slug}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Back to agent
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <ClipboardCheck className="size-3.5" />
            Golden cases
          </div>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
            {displayName} — regression set
          </h1>
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            A golden case is "for" this agent when its tags include{' '}
            <code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">{slug}</code>.
            Click a case to view or edit its expected JSON. Pause a case to drop it from the
            nightly run without deleting the row.
          </p>
          <div className="mt-3 flex items-center gap-3 text-xs text-ink-muted">
            <span>{enabledCount} active</span>
            <span>·</span>
            <span>{cases.length} total tagged</span>
          </div>
        </div>
        <Link
          href={`/agents/${slug}/golden-cases/new`}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-card hover:bg-primary/90"
        >
          <Plus className="size-3.5" />
          New case
        </Link>
      </header>

      {cases.length > 0 && (
        <EvalRunControls
          agentSlug={slug}
          enabledCount={enabledCount}
          totalCount={cases.length}
          versions={versions}
        />
      )}

      {cases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-ink-muted">
          <FlaskConical className="mx-auto mb-2 size-5 text-ink-subtle" />
          <p>
            No golden cases tagged with{' '}
            <code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">{slug}</code>{' '}
            yet.
          </p>
          <Link
            href={`/agents/${slug}/golden-cases/new`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-card hover:bg-primary/90"
          >
            <Plus className="size-3.5" />
            Add the first one
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {cases.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-border bg-card p-4 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link
                  href={`/agents/${slug}/golden-cases/${c.id}`}
                  className="block min-w-0 flex-1 rounded-md hover:bg-primary-subtle/30"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-semibold text-ink hover:text-primary">
                      {c.name}
                    </h3>
                    {c.verifiedAt ? (
                      <Badge tone="success">verified</Badge>
                    ) : (
                      <Badge tone="warn">unverified</Badge>
                    )}
                  </div>
                  {c.description && (
                    <p className="mt-1.5 text-sm text-ink-muted">{c.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {c.tags.map((t) => (
                      <span
                        key={t}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          t === slug
                            ? 'bg-primary/15 text-primary'
                            : 'bg-background text-ink-muted'
                        }`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 text-[10px] text-ink-subtle">
                    Added{' '}
                    {new Date(c.createdAt).toLocaleDateString('en-IN', {
                      dateStyle: 'medium',
                    })}
                    {c.annotator && ` · ${c.annotator}`}
                  </div>
                </Link>
                <div className="flex flex-col items-end gap-2">
                  <RunSingleCase agentSlug={slug} caseId={c.id} />
                  <LastRunPill lastRun={lastRuns.get(c.id) ?? null} />
                  <GoldenCaseToggle caseId={c.id} agentSlug={slug} enabled={c.enabled} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
