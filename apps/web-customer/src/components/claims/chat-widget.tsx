'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageCircle, Send, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@suraksha/ui';
import { cn } from '@/lib/cn';

/**
 * Streaming chat against the customer-explainer agent, grounded in THIS policy.
 *
 * - Loads history on mount (GET /api/analyse/:id/chat)
 * - POST a new message → consumes SSE, appends tokens into a tentative
 *   "assistant" bubble, finalises it into the list on `done`
 * - Shows inline errors (rate_limited, cost_cap_reached, analysis_not_ready)
 *   rather than toasting, so the user sees the cause next to the send button.
 */

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: string;
  pending?: boolean;
}

interface Props {
  analysisId: string;
  /** One-line welcome copy shown above the input when history is empty. */
  welcome?: string;
  /** Optional PII reminder under the header. */
  piiWarning?: string;
  /** 2–4 starter questions shown as chips when the thread is empty.
   *  Callers (ReportViewV2) derive these from the actual analysis so the
   *  chips reference real red flags / waiting periods / clarifications,
   *  never a generic question. Pass [] to suppress chips entirely.
   *  Default fallbacks are intentionally generic and policy-shape-agnostic. */
  suggestions?: string[];
}

const DEFAULT_SUGGESTIONS: string[] = [
  'What does this policy actually cover?',
  'When does my coverage start?',
  'How do I make a cashless claim?',
];

export function ChatWidget({
  analysisId,
  welcome = "Ask me anything about this policy — I'll answer from what's in your uploaded document.",
  piiWarning,
  suggestions,
}: Props) {
  // Caller-provided suggestions always win; only fall back when the prop
  // was omitted entirely. Passing [] suppresses the strip altogether.
  const effectiveSuggestions = suggestions ?? DEFAULT_SUGGESTIONS;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Last successfully-sent user text, retained so the "Try again" affordance
  // on the error banner can replay it without the user having to retype.
  const [lastUserText, setLastUserText] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Load history on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/analyse/${analysisId}/chat`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`history_${res.status}`);
        const data = (await res.json()) as { messages: ChatMessage[] };
        if (!cancelled) setMessages(data.messages ?? []);
      } catch {
        // Non-fatal: empty thread.
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  // Auto-scroll to the latest turn.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  async function send(text: string, opts: { isRetry?: boolean } = {}) {
    if (!text.trim() || streaming) return;
    setError(null);
    setInput('');
    setLastUserText(text);

    const userTurnId = cryptoRandomId();
    const assistantTurnId = cryptoRandomId();
    // On retry, we don't append a duplicate user bubble — the previous one
    // is already in the thread. We only add a fresh assistant placeholder.
    setMessages((prev) =>
      opts.isRetry
        ? [...prev, { id: assistantTurnId, role: 'assistant', content: '', pending: true }]
        : [
            ...prev,
            { id: userTurnId, role: 'user', content: text, pending: false },
            { id: assistantTurnId, role: 'assistant', content: '', pending: true },
          ],
    );
    setStreaming(true);

    try {
      const res = await fetch(`/api/analyse/${analysisId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({ error: 'unknown' }));
        throw new Error(body.error ?? `http_${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const evt of events) {
          const { event, data } = parseSseEvent(evt);
          if (event === 'chunk') {
            try {
              const { text: chunk } = JSON.parse(data) as { text: string };
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantTurnId ? { ...m, content: m.content + chunk } : m)),
              );
            } catch {
              // ignore malformed chunk
            }
          } else if (event === 'done') {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantTurnId ? { ...m, pending: false } : m)),
            );
          } else if (event === 'error') {
            let msg = 'stream_error';
            try {
              msg = (JSON.parse(data) as { message?: string }).message ?? msg;
            } catch {
              /* noop */
            }
            throw new Error(msg);
          }
        }
      }
    } catch (e) {
      const code = (e as Error).message;
      setError(humanError(code));
      // Drop the tentative assistant bubble on failure — but keep the user turn
      // visible so they see what they asked.
      setMessages((prev) => prev.filter((m) => !(m.id === assistantTurnId && m.pending)));
    } finally {
      setStreaming(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void send(input);
  }

  return (
    <div className="mt-8 rounded-xl border border-border bg-card shadow-card">
      <header className="flex items-center gap-2 border-b border-border px-5 py-3">
        <MessageCircle className="size-4 text-primary" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Ask about this policy
        </h2>
      </header>

      {piiWarning && (
        <div className="border-b border-border bg-background/60 px-5 py-2 text-xs text-ink-subtle">
          {piiWarning}
        </div>
      )}

      <div
        ref={scrollRef}
        className="max-h-[420px] space-y-3 overflow-y-auto px-5 py-4"
        aria-live="polite"
      >
        {loadingHistory ? (
          <div className="flex items-center gap-2 text-xs text-ink-subtle">
            <Loader2 className="size-3.5 animate-spin" /> Loading your thread…
          </div>
        ) : messages.length === 0 ? (
          <div>
            <p className="text-sm text-ink-muted">{welcome}</p>
            {effectiveSuggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {effectiveSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    disabled={streaming || loadingHistory}
                    className="rounded-full border border-border px-3 py-1.5 text-xs text-ink-muted transition hover:border-primary/50 hover:text-ink disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((m) => <Bubble key={m.id} msg={m} />)
        )}
      </div>

      {error && (
        <div className="flex flex-wrap items-start gap-2 border-t border-danger/30 bg-danger-subtle/40 px-5 py-2 text-xs text-danger">
          <AlertTriangle className="mt-0.5 size-3.5 flex-none" />
          <span className="min-w-0 flex-1">{error}</span>
          {lastUserText && !streaming && (
            <button
              type="button"
              onClick={() => void send(lastUserText, { isRetry: true })}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-danger/40 px-2.5 py-1 text-[11px] font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50"
            >
              Try again
            </button>
          )}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-border px-3 py-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={loadingHistory ? 'Loading thread…' : 'Ask a question about your policy…'}
          disabled={streaming || loadingHistory}
          maxLength={2000}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-ink-subtle focus:border-primary disabled:opacity-50"
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={streaming || loadingHistory || !input.trim()}
        >
          {streaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  );
}

function Bubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === 'system') return null;
  const isUser = msg.role === 'user';
  const body = msg.content || (msg.pending ? '…' : '');
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm',
          isUser ? 'bg-primary/10 text-ink' : 'bg-background text-ink',
          msg.pending && 'text-ink-muted',
        )}
      >
        {isUser ? body : renderLightMarkdown(body)}
      </div>
    </div>
  );
}

/**
 * Tiny inline markdown renderer for assistant replies. Handles **bold**,
 * *italic*, `code`, and line breaks — the only tokens the customer-explainer
 * agent produces. Deliberately NOT a full markdown parser (no lists, tables,
 * or links) because the agent's prompt constrains it to plain prose; handling
 * more would invite XSS risk without a real sanitiser.
 */
function renderLightMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Tokenise into alternating plain / **bold** / *italic* / `code` runs.
  // The regex captures the delimiter so we can switch on it per match.
  const pattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={`b${key++}`} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('*')) {
      nodes.push(
        <em key={`i${key++}`} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    } else {
      nodes.push(
        <code
          key={`c${key++}`}
          className="rounded bg-primary/10 px-1 py-0.5 font-mono text-[0.85em] text-ink"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function parseSseEvent(raw: string): { event: string; data: string } {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('event: ')) event = line.slice(7).trim();
    else if (line.startsWith('data: ')) dataLines.push(line.slice(6));
  }
  return { event, data: dataLines.join('\n') };
}

/**
 * Map an upstream / pipeline error code (or a raw provider error blob) to
 * a friendly, customer-safe message.
 *
 * The default branch USED to interpolate the raw `code` back into the UI,
 * which leaked provider names + endpoint URLs (e.g. the GoogleGenerativeAI
 * 503 message that escaped to a screenshot on 2026-05-04). It now does
 * pattern matching on the raw text and falls back to a generic message
 * with no provider details.
 */
function humanError(code: string): string {
  switch (code) {
    case 'rate_limited':
      return 'Too many questions in a short window. Wait a minute and try again.';
    case 'cost_cap_reached':
      return 'This analysis has hit its chat budget. Create a new analysis to continue.';
    case 'cost_cap_daily':
      return "You've used your daily free budget. Come back tomorrow or upgrade to continue.";
    case 'message_too_long':
      return 'Keep your question under 2,000 characters.';
    case 'empty_message':
      return 'Type a question first.';
    case 'analysis_not_ready':
      return 'Give the analysis a moment to finish before asking questions.';
    default: {
      const lower = code.toLowerCase();
      // Upstream model overloaded / transient — the most common case in
      // the Gemini Spike windows. Keep the copy hopeful + actionable.
      if (
        /503|service unavailable|overloaded|high demand|model is currently/i.test(code) ||
        lower.includes('upstream_unavailable') ||
        lower.includes('upstream_transient') ||
        lower.includes('resource exhausted')
      ) {
        return 'Our AI is busy right now. Give it a few seconds and try again.';
      }
      // Network / connectivity.
      if (lower.includes('fetch failed') || lower.includes('econnreset') || lower.includes('etimedout') || lower.includes('network')) {
        return "Couldn't reach the network. Check your connection and try again.";
      }
      // 5xx on our own API surface.
      if (/^http_5\d\d$/.test(lower) || lower.startsWith('500') || lower.startsWith('502') || lower.startsWith('504')) {
        return 'Our server hit a snag. Please try again — if it keeps happening, refresh the page.';
      }
      // Anything else — never echo the raw blob.
      return "Something went wrong on our side. Please try again.";
    }
  }
}

function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
