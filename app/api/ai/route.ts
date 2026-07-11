import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { resolveModel } from '@/lib/models';

export async function POST(req: NextRequest) {
  const { messages, systemPrompt, apiKey, model } = await req.json();

  if (!apiKey) {
    return NextResponse.json({ error: 'Claude API key not configured. Please add it in Settings.' }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  // Stream text deltas to the browser as they arrive. Adaptive thinking lets
  // Claude spend reasoning tokens only when a question needs them, so simple
  // answers stay cheap; streaming keeps the UI responsive during the slow ones.
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: resolveModel(model),
          max_tokens: 4096,
          thinking: { type: 'adaptive' },
          system: systemPrompt,
          messages: messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        });

        stream.on('text', (delta) => {
          controller.enqueue(encoder.encode(delta));
        });

        await stream.finalMessage();
        controller.close();
      } catch (err: unknown) {
        // The stream has already started (200 headers sent), so surface the
        // error as an inline marker the client can detect and render.
        const msg = err instanceof Error ? err.message : 'Unknown error';
        controller.enqueue(encoder.encode(`\n\n[[WEALTHOS_ERROR]] ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
