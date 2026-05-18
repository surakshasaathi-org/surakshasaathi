import { NextResponse, type NextRequest } from 'next/server';
import { startChatStream, listChatMessages } from '@/server/analyse/chat';
import { assertAnalysisAccess } from '@/server/safety/analysis-access';

/**
 * Streaming chat endpoint for the customer-explainer agent.
 *
 *   GET  /api/analyse/:id/chat   → returns history as JSON
 *   POST /api/analyse/:id/chat   → streams assistant response as SSE
 *
 * Access: caller must either be the signed-in owner OR present the
 * HttpOnly `ss_token_<id>` cookie issued at upload time. The cookie value
 * is compared against `analysis.session_token` in constant time.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function denyResponse(id: string) {
  const access = await assertAnalysisAccess(id);
  if (access.ok) return null;
  const status = access.code === 'not_found' ? 404 : access.code === 'expired' ? 410 : 403;
  return NextResponse.json({ error: access.message }, { status });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denial = await denyResponse(id);
  if (denial) return denial;
  const messages = await listChatMessages(id);
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denial = await denyResponse(id);
  if (denial) return denial;

  let body: { message?: string };
  try {
    body = (await req.json()) as { message?: string };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const message = (body.message ?? '').toString();

  let stream: AsyncIterable<string>;
  let finalize: () => Promise<void>;
  let streamErrorRef: { error: Error | null };
  try {
    const res = await startChatStream({ analysisId: id, userMessage: message });
    stream = res.stream;
    finalize = res.finalize;
    streamErrorRef = res.streamError;
  } catch (err) {
    const code = (err as Error).message;
    const status =
      code === 'rate_limited'
        ? 429
        : code === 'cost_cap_reached' || code === 'cost_cap_daily'
          ? 402
          : code === 'empty_message' || code === 'message_too_long'
            ? 400
            : code === 'analysis_not_ready'
              ? 409
              : 500;
    return NextResponse.json({ error: code }, { status });
  }

  const encoder = new TextEncoder();
  const sse = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: string) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      };
      try {
        for await (const chunk of stream) {
          send('chunk', JSON.stringify({ text: chunk }));
        }
        // After the stream drains, check if the underlying provider errored.
        // If so, surface a real SSE error event instead of silently closing.
        if (streamErrorRef.error) {
          send('error', JSON.stringify({ message: streamErrorRef.error.message }));
        } else {
          await finalize();
          send('done', '{}');
        }
      } catch (err) {
        send('error', JSON.stringify({ message: (err as Error).message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(sse, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
