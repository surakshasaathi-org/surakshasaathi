'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Cpu, Wrench } from 'lucide-react';

/**
 * One row of an agent_run_step trace. Collapsed by default — admins
 * scan latencies + token counts at a glance, then expand the prompt /
 * completion bodies when they need to debug a specific step. Bodies
 * are pre-redacted (PII-scrubbed) by the recorder; rendered as-is in
 * monospace inside a scrollable container.
 */

interface Step {
  id: string;
  stepIndex: number;
  kind: string; // 'llm_call' | 'tool_call'
  modelId: string | null;
  toolName: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreationInputTokens: number | null;
  cacheReadInputTokens: number | null;
  costPaise: number;
  latencyMs: number | null;
  promptRedacted: string | null;
  completionRedacted: string | null;
  toolArgsJson: unknown;
  toolResultJson: unknown;
  errorMessage: string | null;
  startedAt: Date;
  endedAt: Date | null;
}

export function TraceStepCard({ step }: { step: Step }) {
  const [open, setOpen] = useState(false);
  const isLlm = step.kind === 'llm_call';
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-background/40"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
            {isLlm ? <Cpu className="size-3.5" /> : <Wrench className="size-3.5" />}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <span className="font-mono text-xs text-ink-subtle">#{step.stepIndex}</span>
              <span>{isLlm ? step.modelId ?? 'llm' : step.toolName ?? 'tool'}</span>
              {step.errorMessage && (
                <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-[10px] font-medium text-danger">
                  error
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-subtle">
              <span>{step.latencyMs?.toLocaleString() ?? '—'}ms</span>
              <span>₹{(step.costPaise / 100).toFixed(3)}</span>
              {isLlm && (
                <>
                  <span>{step.inputTokens ?? '—'} in</span>
                  <span>{step.outputTokens ?? '—'} out</span>
                  {step.cacheReadInputTokens ? (
                    <span className="text-success">{step.cacheReadInputTokens} cached</span>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
        {open ? <ChevronUp className="size-4 text-ink-subtle" /> : <ChevronDown className="size-4 text-ink-subtle" />}
      </button>

      {open && (
        <div className="space-y-3 border-t border-border bg-background/30 px-4 py-3">
          {step.errorMessage && (
            <Block label="Error" body={step.errorMessage} mono />
          )}
          {isLlm ? (
            <>
              {step.promptRedacted && (
                <Block label="Prompt (redacted)" body={step.promptRedacted} mono collapsibleAfter={2000} />
              )}
              {step.completionRedacted && (
                <Block label="Completion (redacted)" body={step.completionRedacted} mono collapsibleAfter={2000} />
              )}
            </>
          ) : (
            <>
              {step.toolArgsJson != null && (
                <Block label="Tool args" body={JSON.stringify(step.toolArgsJson, null, 2)} mono />
              )}
              {step.toolResultJson != null && (
                <Block label="Tool result" body={JSON.stringify(step.toolResultJson, null, 2)} mono />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Block({
  label,
  body,
  mono,
  collapsibleAfter,
}: {
  label: string;
  body: string;
  mono?: boolean;
  collapsibleAfter?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const truncated =
    collapsibleAfter && body.length > collapsibleAfter && !showAll ? body.slice(0, collapsibleAfter) : body;
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
        {label}
      </div>
      <pre
        className={`max-h-[480px] overflow-auto rounded-md border border-border bg-background p-3 text-xs ${
          mono ? 'font-mono' : ''
        } whitespace-pre-wrap break-words text-ink-muted`}
      >
        {truncated}
        {collapsibleAfter && body.length > collapsibleAfter && !showAll && (
          <>
            {'\n…'}
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="ml-2 text-primary underline hover:text-primary"
            >
              show {(body.length - collapsibleAfter).toLocaleString()} more chars
            </button>
          </>
        )}
      </pre>
    </div>
  );
}
