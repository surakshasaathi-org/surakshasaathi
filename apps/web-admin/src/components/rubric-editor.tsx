'use client';

import { useState, useTransition } from 'react';
import { Save } from 'lucide-react';
import { saveNewRubricVersion } from '@/server/evals/rubric-actions';

interface Props {
  agentSlug: string;
  current: {
    version: number;
    judgePrompt: string;
    judgeModelTier: 'opus' | 'sonnet' | 'haiku';
  };
}

export function RubricEditor({ agentSlug, current }: Props) {
  const [prompt, setPrompt] = useState(current.judgePrompt);
  const [tier, setTier] = useState(current.judgeModelTier);
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const dirty = prompt !== current.judgePrompt || tier !== current.judgeModelTier;

  function onSave() {
    setFeedback(null);
    startTransition(async () => {
      const res = await saveNewRubricVersion({
        agentSlug,
        judgePrompt: prompt,
        judgeModelTier: tier,
        changeNote: note,
      });
      if (res.ok) {
        setFeedback({ kind: 'ok', msg: `Published v${res.version} as default.` });
        setNote('');
      } else {
        setFeedback({ kind: 'err', msg: res.error ?? 'Save failed.' });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold uppercase tracking-wider text-ink-subtle">Judge tier</span>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as Props['current']['judgeModelTier'])}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-ink"
            disabled={pending}
          >
            <option value="opus">opus</option>
            <option value="sonnet">sonnet</option>
            <option value="haiku">haiku</option>
          </select>
        </label>
        <div className="text-xs text-ink-subtle">
          Editing on top of <strong className="font-semibold">v{current.version}</strong>. Saving creates v{current.version + 1} and flips it to default.
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        spellCheck={false}
        className="min-h-[420px] w-full rounded-lg border border-border bg-card p-3 font-mono text-xs text-ink focus:border-primary/40 focus:outline-none"
        disabled={pending}
      />

      <label className="flex flex-col gap-1 text-xs">
        <span className="font-semibold uppercase tracking-wider text-ink-subtle">
          Change note (shown in version history)
        </span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. tightened citation strictness"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-ink"
          disabled={pending}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-card transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="size-3.5" />
          {pending ? 'Saving…' : `Publish v${current.version + 1}`}
        </button>
        {feedback && (
          <span
            className={`text-xs ${feedback.kind === 'ok' ? 'text-success' : 'text-danger'}`}
          >
            {feedback.msg}
          </span>
        )}
      </div>
    </div>
  );
}
