import { sql } from 'drizzle-orm';
import {
  Activity as ActivityIcon,
  FileSearch,
  ShieldCheck,
  MessageCircle,
  Bell,
  ThumbsUp,
} from 'lucide-react';
import { serviceDb } from '@suraksha/db';
import { supabaseServer } from '@/lib/supabase-server';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ before?: string }>;
}

const PAGE_SIZE = 50;

/**
 * Full audit-style timeline for the signed-in user. Sourced from the
 * v_user_activity view — union over analyses, policies, chat, notifications,
 * feedback. Cursor-paginated by `before=<iso>` for keyset-style scrolling.
 */
export const dynamic = 'force-dynamic';

export default async function ActivityPage({ searchParams }: Props) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const userId = auth.user.id;

  const before = sp.before ? new Date(sp.before) : null;
  const db = serviceDb();
  // Raw db.execute() returns timestamp columns as ISO strings (not Date). Typed
  // accordingly — the typed .select() path would return Date, but the view
  // means we need raw SQL here.
  const rows = (await db.execute<{
    kind: string;
    subject: string;
    detail: string | null;
    occurred_at: string | Date;
    ref_id: string;
  }>(
    before
      ? sql`
          select kind, subject, detail, occurred_at, ref_id
          from v_user_activity
          where user_id = ${userId} and occurred_at < ${before.toISOString()}
          order by occurred_at desc
          limit ${PAGE_SIZE + 1}
        `
      : sql`
          select kind, subject, detail, occurred_at, ref_id
          from v_user_activity
          where user_id = ${userId}
          order by occurred_at desc
          limit ${PAGE_SIZE + 1}
        `,
  )) as Array<{
    kind: string;
    subject: string;
    detail: string | null;
    occurred_at: string | Date;
    ref_id: string;
  }>;

  const items = rows.slice(0, PAGE_SIZE);
  const hasMore = rows.length > PAGE_SIZE;
  const nextCursor = hasMore ? toIso(items[items.length - 1]!.occurred_at) : null;

  return (
    <div>
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <ActivityIcon className="size-3.5" />
          Activity
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Everything that's happened
        </h1>
        <p className="mt-2 max-w-prose text-ink-muted">
          Chronological record of your analyses, chats, policy updates, notifications, and
          feedback. Useful when you're asking "when did I…?" or requesting your data on file.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-ink-muted">
          Nothing here yet. Upload a policy or edit your family to start building your trail.
        </div>
      ) : (
        <ol className="relative space-y-0 border-l border-border pl-6">
          {items.map((row, i) => {
            const Icon = iconFor(row.kind);
            return (
              <li key={`${row.ref_id}-${i}`} className="relative pb-5">
                <span className="absolute -left-[1.7rem] top-1 flex size-6 items-center justify-center rounded-full bg-card shadow-card ring-1 ring-border">
                  <Icon className="size-3.5 text-primary" />
                </span>
                <div className="text-sm font-medium text-ink">{row.subject}</div>
                {row.detail && (
                  <div className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{row.detail}</div>
                )}
                <time className="mt-1 block text-[11px] uppercase tracking-wider text-ink-subtle">
                  {formatWhen(toIso(row.occurred_at))}
                </time>
              </li>
            );
          })}
        </ol>
      )}

      {nextCursor && (
        <div className="mt-6 text-center">
          <a
            href={`?before=${encodeURIComponent(nextCursor)}`}
            className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm text-ink-muted hover:border-primary/40 hover:text-ink"
          >
            Load older events
          </a>
        </div>
      )}
    </div>
  );
}

function iconFor(kind: string) {
  switch (kind) {
    case 'analysis_created':
      return FileSearch;
    case 'policy_linked':
      return ShieldCheck;
    case 'chat_message':
      return MessageCircle;
    case 'notification_sent':
      return Bell;
    case 'feedback_given':
      return ThumbsUp;
    default:
      return ActivityIcon;
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toIso(v: string | Date): string {
  if (v instanceof Date) return v.toISOString();
  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? String(v) : parsed.toISOString();
}
