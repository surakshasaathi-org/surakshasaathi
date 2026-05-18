import { Sparkles } from 'lucide-react';
import { Button } from '@suraksha/ui';

/**
 * AI co-pilot sidebar — drafts replies grounded in the currently-open conversation
 * and the customer's case + policy + prior interactions. CX agent approves/edits/sends.
 *
 * Draft generation is a Server Action in Week-2 that calls `invokeAgent` on a
 * support-drafter agent (new agent_definition row, slug "support-drafter").
 */
export function CopilotPanel() {
  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Sparkles className="size-4 text-accent" aria-hidden />
        <div className="text-sm font-semibold">Co-pilot</div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="rounded-md border border-dashed border-border bg-primary-subtle/30 p-4 text-sm text-ink-muted">
          Select a conversation and the co-pilot will draft a reply here — grounded in the customer's case and
          policy context, in the customer's locale.
        </div>
      </div>
      <div className="flex gap-2 border-t border-border p-3">
        <Button variant="outline" size="sm" disabled>
          Regenerate
        </Button>
        <Button size="sm" disabled className="ml-auto">
          Insert into reply
        </Button>
      </div>
    </div>
  );
}
