'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Copy } from 'lucide-react';

interface Props {
  label: string;
  value: unknown;
  defaultOpen?: boolean;
}

export function JsonViewer({ label, value, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const text = stringify(value);
  const empty = value === null || value === undefined;

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="rounded-md border border-border bg-background">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[11px] font-medium text-ink-muted hover:text-ink"
      >
        <span className="inline-flex items-center gap-1">
          {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          {label}
          {empty && <span className="text-ink-subtle">· (none)</span>}
        </span>
        {open && !empty && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              copy();
            }}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-ink-subtle hover:bg-card hover:text-ink"
          >
            <Copy className="size-3" /> {copied ? 'copied' : 'copy'}
          </span>
        )}
      </button>
      {open && !empty && (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words border-t border-border bg-card px-2.5 py-2 font-mono text-[10px] leading-snug text-ink">
          {text}
        </pre>
      )}
    </div>
  );
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
