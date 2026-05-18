import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, FileText } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import { requireAdminSession } from '@/lib/auth';
import { Badge } from '@suraksha/ui';
import { getAgent } from '@/server/agents/actions';
import { PromptEditor } from '@/components/prompt-editor';
import { RollbackButton } from '@/components/rollback-button';
import { AgentModelForm } from '@/components/agent-model-form';
import { resolveActiveModel } from '@/lib/active-model';

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

export default async function AgentEditorPage({ params }: Props) {
  const { slug } = await params;
  // View access open to every admin role; write actions (promote, rollback)
  // are gated inside the respective server actions to super_admin + content_editor.
  const session = await requireAdminSession(['super_admin', 'admin', 'content_editor', 'viewer']);
  const agent = await getAgent(slug);
  if (!agent) notFound();

  const defaultV = agent.versions.find((v) => v.isDefault) ?? agent.versions[0];
  if (!defaultV) notFound();
  const sorted = [...agent.versions].sort((a, b) => b.version - a.version);

  return (
    <AdminShell role={session.role} email={session.email}>
      <Link
        href="/agents"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to agents
      </Link>

      <nav className="mb-4 flex flex-wrap gap-2 text-xs">
        <Link
          href={`/agents/${slug}/rubric`}
          className="rounded-md border border-border bg-card px-3 py-1.5 font-medium text-ink hover:border-primary/40 hover:text-primary"
        >
          Eval rubric →
        </Link>
        <Link
          href={`/agents/${slug}/golden-cases`}
          className="rounded-md border border-border bg-card px-3 py-1.5 font-medium text-ink hover:border-primary/40 hover:text-primary"
        >
          Golden cases →
        </Link>
        <Link
          href={`/agents/${slug}/regressions`}
          className="rounded-md border border-border bg-card px-3 py-1.5 font-medium text-ink hover:border-primary/40 hover:text-primary"
        >
          Compare versions →
        </Link>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-xs text-ink-subtle">{agent.slug}</div>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">
            {defaultV.displayName}
          </h1>
          <p className="mt-2 max-w-prose text-sm text-ink-muted">{defaultV.purpose}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-ink-muted">
            {resolveActiveModel({
              provider: defaultV.provider as 'gemini' | 'anthropic' | null,
              modelTier: defaultV.modelTier as 'opus' | 'sonnet' | 'haiku',
              modelOverride: defaultV.modelOverride,
            })}
          </span>
          {!defaultV.enabled && <Badge tone="neutral">disabled</Badge>}
        </div>
      </div>

      {/* Provider + model override editor */}
      <section className="mt-6">
        <AgentModelForm
          slug={agent.slug}
          initialProvider={defaultV.provider as 'gemini' | 'anthropic' | null}
          initialModelOverride={defaultV.modelOverride}
          defaultModel={resolveActiveModel({
            provider: defaultV.provider as 'gemini' | 'anthropic' | null,
            modelTier: defaultV.modelTier as 'opus' | 'sonnet' | 'haiku',
            modelOverride: null,
          })}
        />
      </section>

      {/* Live editor + preview + promote */}
      <section className="mt-8">
        <PromptEditor
          slug={agent.slug}
          currentVersion={{
            version: defaultV.version,
            systemPrompt: defaultV.systemPrompt,
            modelTier: defaultV.modelTier,
            temperature: defaultV.temperature,
            maxTokens: defaultV.maxTokens,
            displayName: defaultV.displayName,
          }}
          editorEmail={session.email ?? 'admin'}
        />
      </section>

      {/* Version history */}
      <section className="mt-10">
        <h2 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Version history ({sorted.length})
        </h2>
        <ol className="space-y-3">
          {sorted.map((v) => (
            <li key={v.version} className="rounded-lg border border-border bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-ink-muted" aria-hidden />
                    <span className="font-display text-base font-semibold text-ink">
                      v{v.version}
                    </span>
                    {v.isDefault && (
                      <Badge tone="success">
                        <CheckCircle2 className="mr-1 size-3" aria-hidden />
                        default
                      </Badge>
                    )}
                    {!v.enabled && <Badge tone="neutral">disabled</Badge>}
                    <span className="font-mono text-[11px] text-ink-subtle">
                      {resolveActiveModel({
                        provider: v.provider as 'gemini' | 'anthropic' | null,
                        modelTier: v.modelTier as 'opus' | 'sonnet' | 'haiku',
                        modelOverride: v.modelOverride,
                      })}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-ink-subtle">
                    Created{' '}
                    {new Date(v.createdAt).toLocaleString('en-IN', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                    {' · '}
                    temp {v.temperature} · {v.maxTokens} maxTokens
                  </div>
                </div>
                {!v.isDefault && v.enabled && (
                  <RollbackButton slug={agent.slug} version={v.version} />
                )}
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer list-none text-xs font-medium text-primary hover:underline">
                  Show system prompt
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed text-ink">
                  {v.systemPrompt}
                </pre>
              </details>
            </li>
          ))}
        </ol>
      </section>
    </AdminShell>
  );
}
