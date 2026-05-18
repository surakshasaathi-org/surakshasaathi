'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, FlaskConical, Rocket, XCircle } from 'lucide-react';
import {
  previewPromptAgainstGoldenSet,
  promoteNewAgentVersion,
  type PreviewCaseResult,
} from '@/server/admin/agents/actions';

interface Props {
  slug: string;
  currentVersion: {
    version: number;
    systemPrompt: string;
    modelTier: string;
    temperature: number;
    maxTokens: number;
    displayName: string;
  };
  editorEmail: string;
}

export function PromptEditor({ slug, currentVersion, editorEmail }: Props) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(currentVersion.systemPrompt);
  const [modelTier, setModelTier] = useState<'opus' | 'sonnet' | 'haiku'>(
    currentVersion.modelTier as 'opus' | 'sonnet' | 'haiku',
  );
  const [temperature, setTemperature] = useState(currentVersion.temperature);
  const [maxTokens, setMaxTokens] = useState(currentVersion.maxTokens);
  const [changeNote, setChangeNote] = useState('');
  const [preview, setPreview] = useState<PreviewCaseResult[] | null>(null);
  const [previewSummary, setPreviewSummary] = useState<string | null>(null);
  const [pendingPreview, startPreview] = useTransition();
  const [pendingPromote, startPromote] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [promoted, setPromoted] = useState<number | null>(null);

  const dirty =
    prompt !== currentVersion.systemPrompt ||
    modelTier !== currentVersion.modelTier ||
    temperature !== currentVersion.temperature ||
    maxTokens !== currentVersion.maxTokens;

  function runPreview() {
    startPreview(async () => {
      setError(null);
      const res = await previewPromptAgainstGoldenSet({
        slug,
        draftSystemPrompt: prompt,
        draftModelTier: modelTier,
        draftTemperature: temperature,
        draftMaxTokens: maxTokens,
      });
      setPreview(res.results);
      setPreviewSummary(res.summary);
    });
  }

  function onPromote(e: FormEvent) {
    e.preventDefault();
    if (!dirty) {
      setError('Nothing to promote — edit the prompt first.');
      return;
    }
    startPromote(async () => {
      setError(null);
      const res = await promoteNewAgentVersion({
        slug,
        newSystemPrompt: prompt,
        newModelTier: modelTier,
        newTemperature: temperature,
        newMaxTokens: maxTokens,
        changeNote,
        createdBy: editorEmail,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setPromoted(res.version);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Draft editor */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-card">
        <header className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
              Draft (editing against v{currentVersion.version})
            </h2>
            <p className="mt-0.5 text-xs text-ink-subtle">
              Promotion mints a new version. Nothing is overwritten.
            </p>
          </div>
          {dirty && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warn-subtle px-2.5 py-1 text-xs text-warn">
              Unsaved changes
            </span>
          )}
        </header>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
          System prompt ({prompt.length.toLocaleString('en-IN')} chars)
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={30}
          className="w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-[13px] leading-relaxed outline-none focus:border-primary"
          style={{ minHeight: 600 }}
        />

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Model tier
            </span>
            <select
              value={modelTier}
              onChange={(e) => setModelTier(e.target.value as 'opus' | 'sonnet' | 'haiku')}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            >
              <option value="opus">Opus (Gemini 2.5 Pro)</option>
              <option value="sonnet">Sonnet (Gemini 2.5 Flash)</option>
              <option value="haiku">Haiku (Gemini 2.0 Flash Lite)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Temperature
            </span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Max tokens
            </span>
            <input
              type="number"
              min={256}
              max={65000}
              step={256}
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>
      </section>

      {/* Preview */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-card">
        <header className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
              <FlaskConical className="size-3.5 text-primary" />
              Golden-set preview
            </h2>
            <p className="mt-0.5 text-xs text-ink-subtle">
              Structural check only — cheap. Full LLM judging runs on the nightly cron.
            </p>
          </div>
          <button
            type="button"
            onClick={runPreview}
            disabled={pendingPreview}
            className="rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            {pendingPreview ? 'Checking…' : 'Run preview'}
          </button>
        </header>

        {!preview && (
          <p className="text-sm text-ink-muted">
            Click <strong className="font-semibold text-ink">Run preview</strong> to structurally
            check the draft against every enabled golden case.
          </p>
        )}

        {preview && (
          <>
            {previewSummary && (
              <div className="mb-3 rounded-md bg-background/60 p-3 text-sm text-ink-muted">
                {previewSummary}
              </div>
            )}
            <ul className="space-y-2">
              {preview.map((r) => (
                <li
                  key={r.goldenCaseId}
                  className="flex items-start gap-3 rounded-lg border border-border bg-background/50 p-3"
                >
                  {r.success ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink">{r.goldenCaseName}</span>
                      {r.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-background px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-subtle"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <p
                      className={`mt-1 text-xs ${
                        r.success ? 'text-ink-muted' : 'text-danger'
                      }`}
                    >
                      {r.errorMessage ?? r.diagnostic}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Promote */}
      <section className="rounded-xl border border-primary/30 bg-primary/5 p-5 shadow-card">
        <form onSubmit={onPromote} className="space-y-3">
          <header className="flex items-center gap-2">
            <Rocket className="size-4 text-primary" />
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
              Promote draft to a new version
            </h2>
          </header>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Change note (visible in audit log)
            </span>
            <input
              type="text"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="e.g. tightened citation-ref instructions; cs_N literal required"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger">
              <AlertCircle className="mt-0.5 size-4 flex-none" />
              <span>{error}</span>
            </div>
          )}

          {promoted && (
            <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success-subtle px-3 py-2 text-sm text-success">
              <CheckCircle2 className="mt-0.5 size-4 flex-none" />
              <span>
                Promoted to v{promoted}. New analyses will use this prompt immediately.
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pendingPromote || !dirty}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {pendingPromote ? 'Promoting…' : `Promote to v${currentVersion.version + 1}`}
            </button>
            {!dirty && (
              <span className="text-xs text-ink-subtle">No changes to promote.</span>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
