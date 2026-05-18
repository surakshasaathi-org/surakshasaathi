'use client';

import { useState, useTransition } from 'react';
import { RotateCcw } from 'lucide-react';
import { rollbackAgentToVersion } from '@/server/admin/agents/actions';

interface Props {
  slug: string;
  version: number;
}

export function RollbackButton({ slug, version }: Props) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onClick() {
    if (!window.confirm(`Roll back ${slug} to v${version}? The current default will be demoted immediately.`)) {
      return;
    }
    setErr(null);
    startTransition(async () => {
      const res = await rollbackAgentToVersion({ slug, version });
      if (!res.ok) setErr(res.message);
      // revalidatePath inside the action refreshes the page.
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-warn/40 hover:text-warn disabled:opacity-50"
      >
        <RotateCcw className="size-3.5" />
        Set as default
      </button>
      {err && <span className="text-[11px] text-danger">{err}</span>}
    </div>
  );
}
