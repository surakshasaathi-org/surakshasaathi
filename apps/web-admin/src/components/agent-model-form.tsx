'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { buttonVariants } from '@suraksha/ui';
import { updateAgentModelConfig } from '@/server/agents/actions';

interface Props {
  slug: string;
  initialProvider: 'gemini' | 'anthropic' | null;
  initialModelOverride: string | null;
  /** Resolved model that's actually used today, for display when override is null. */
  defaultModel: string;
}

const MODEL_OPTIONS: Record<'gemini' | 'anthropic', Array<{ id: string; label: string }>> = {
  gemini: [
    { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro (most capable)' },
    { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash (fast vision)' },
    { id: 'gemini-2.0-flash', label: 'gemini-2.0-flash (stable cousin)' },
    { id: 'gemini-2.5-flash-lite', label: 'gemini-2.5-flash-lite (cheapest)' },
    { id: 'gemini-2.0-flash-lite', label: 'gemini-2.0-flash-lite (cheapest stable)' },
  ],
  anthropic: [
    { id: 'claude-opus-4-7', label: 'claude-opus-4-7 (most capable)' },
    { id: 'claude-opus-4-6', label: 'claude-opus-4-6' },
    { id: 'claude-sonnet-4-6', label: 'claude-sonnet-4-6 (best speed/intelligence)' },
    { id: 'claude-haiku-4-5', label: 'claude-haiku-4-5 (fastest)' },
  ],
};

export function AgentModelForm({ slug, initialProvider, initialModelOverride, defaultModel }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [provider, setProvider] = useState<'gemini' | 'anthropic'>(initialProvider ?? 'gemini');
  const [providerSet, setProviderSet] = useState<boolean>(initialProvider !== null);
  const [modelOverride, setModelOverride] = useState<string>(initialModelOverride ?? '');
  const [feedback, setFeedback] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await updateAgentModelConfig({
        slug,
        provider: providerSet ? provider : null,
        modelOverride: modelOverride.trim() || null,
      });
      if (res.ok) {
        setFeedback('Saved. Next agent run will use the new config.');
        router.refresh();
      } else {
        setFeedback(`Failed: ${res.error}`);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
        Provider & model
      </h3>
      <p className="mt-1 text-xs text-ink-muted">
        Active model: <code className="font-mono">{initialModelOverride ?? defaultModel}</code>
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Provider
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <select
              value={providerSet ? provider : ''}
              onChange={(e) => {
                if (e.target.value === '') {
                  setProviderSet(false);
                } else {
                  setProviderSet(true);
                  setProvider(e.target.value as 'gemini' | 'anthropic');
                  setModelOverride('');
                }
              }}
              disabled={pending}
              className="block w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-ink"
            >
              <option value="">— default (gemini) —</option>
              <option value="gemini">gemini</option>
              <option value="anthropic">anthropic (Claude)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Model
          </label>
          <select
            value={modelOverride}
            onChange={(e) => setModelOverride(e.target.value)}
            disabled={pending}
            className="mt-1.5 block w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-xs text-ink"
          >
            <option value="">— use default for provider —</option>
            {MODEL_OPTIONS[providerSet ? provider : 'gemini'].map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-ink-subtle">
            Pick from the list, or leave blank to use the provider default. The active model id is
            persisted on every agent_run for audit.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonVariants({ variant: 'primary', size: 'sm' })}>
          <Save className="mr-1.5 size-3.5" aria-hidden />
          {pending ? 'Saving…' : 'Save'}
        </button>
        {feedback && (
          <span className="text-xs text-ink-muted" role="status">
            {feedback}
          </span>
        )}
      </div>
    </form>
  );
}
