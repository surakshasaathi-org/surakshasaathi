import { SupportShell } from '@/components/support-shell';
import { CopilotPanel } from '@/components/copilot-panel';

export default function InboxPage() {
  return (
    <SupportShell email={null}>
      <div className="grid h-screen grid-cols-[280px_1fr_360px]">
        {/* Conversation list */}
        <div className="overflow-auto border-r border-border">
          <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3 text-xs uppercase tracking-wide text-ink-subtle">
            Inbox — all channels
          </div>
          <ul className="divide-y divide-border text-sm">
            {/* Placeholder conversations — real data lands with the WATI integration in Week-2 */}
            {[1, 2, 3, 4, 5].map((i) => (
              <li key={i} className="cursor-pointer p-4 hover:bg-primary-subtle/40">
                <div className="flex items-center justify-between">
                  <span className="truncate font-medium">Customer #{i}</span>
                  <span className="text-xs text-ink-subtle">2m</span>
                </div>
                <div className="mt-1 truncate text-xs text-ink-muted">
                  "My claim was rejected, what do I do next…"
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Conversation thread */}
        <div className="flex flex-col">
          <div className="flex h-14 items-center border-b border-border px-5">
            <div className="text-sm font-semibold">Conversation</div>
          </div>
          <div className="flex-1 overflow-auto bg-primary-subtle/20 p-6 text-sm text-ink-muted">
            Select a conversation from the inbox.
          </div>
          <form className="flex gap-2 border-t border-border bg-card p-3">
            <textarea
              rows={3}
              placeholder="Type a reply… or insert the co-pilot's draft."
              className="flex-1 resize-none rounded-md border border-input bg-card px-3 py-2 text-sm outline-none ring-offset-2 focus-visible:ring-2"
            />
            <button
              type="button"
              disabled
              className="self-end rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>

        {/* Co-pilot */}
        <CopilotPanel />
      </div>
    </SupportShell>
  );
}
