import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, FileText, Gauge } from 'lucide-react';
import { Badge } from '@suraksha/ui';
import { AdminShell } from '@/components/admin/admin-shell';
import { RubricEditor } from '@/components/admin/rubric-editor';
import { requireAdminSession } from '@/lib/admin/auth';
import { getAgent } from '@/server/admin/agents/actions';
import {
  getDefaultRubric,
  listRubricVersions,
  setDefaultRubricVersion,
} from '@/server/admin/evals/rubric-actions';

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

export default async function AgentRubricPage({ params }: Props) {
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

  const [current, versions] = await Promise.all([
    getDefaultRubric(slug),
    listRubricVersions(slug),
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

      <header className="mb-6">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Gauge className="size-3.5" />
          Eval rubric
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
          {displayName} — judge prompt
        </h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          The judge LLM compares this agent's live output against the expected output from a
          golden case. Edit the prompt to tune what counts as a pass; saving creates a new
          version row and flips it to default for the next eval run.
        </p>
      </header>

      {current ? (
        <section className="mb-10">
          <RubricEditor
            agentSlug={slug}
            current={{
              version: current.version,
              judgePrompt: current.judgePrompt,
              judgeModelTier: current.judgeModelTier,
            }}
          />
        </section>
      ) : (
        <section className="mb-10 rounded-xl border border-warn/30 bg-warn/5 p-5 text-sm text-ink-muted">
          <div className="font-semibold text-ink">No rubric yet for this agent.</div>
          <p className="mt-1">
            Seed one via{' '}
            <code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">
              packages/db/src/seed/eval-rubrics.ts
            </code>{' '}
            (then re-seed). Inline create-from-blank is intentionally not exposed here — the
            output schema needs a code change to evolve.
          </p>
        </section>
      )}

      {versions.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
            Version history ({versions.length})
          </h2>
          <ol className="space-y-3">
            {versions.map((v) => (
              <li
                key={v.id}
                className="rounded-lg border border-border bg-card p-4 shadow-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-ink-muted" />
                      <span className="font-display text-base font-semibold text-ink">
                        v{v.version}
                      </span>
                      {v.isDefault && (
                        <Badge tone="success">
                          <CheckCircle2 className="mr-1 size-3" />
                          default
                        </Badge>
                      )}
                      {!v.enabled && <Badge tone="neutral">disabled</Badge>}
                      <span className="text-xs uppercase tracking-wider text-ink-subtle">
                        judge: {v.judgeModelTier}
                      </span>
                    </div>
                    {v.changeNote && (
                      <p className="mt-1.5 text-sm text-ink-muted">{v.changeNote}</p>
                    )}
                    <div className="mt-1 text-xs text-ink-subtle">
                      {new Date(v.createdAt).toLocaleString('en-IN', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                      {v.createdBy && ` · ${v.createdBy}`}
                    </div>
                  </div>
                  {!v.isDefault && (
                    <RollbackForm agentSlug={slug} version={v.version} />
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </AdminShell>
  );
}

function RollbackForm({ agentSlug, version }: { agentSlug: string; version: number }) {
  return (
    <form
      action={async () => {
        'use server';
        await setDefaultRubricVersion({ agentSlug, version });
      }}
    >
      <button
        type="submit"
        className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-ink hover:border-primary/40 hover:text-primary"
      >
        Make default
      </button>
    </form>
  );
}
