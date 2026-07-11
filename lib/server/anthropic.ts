import './guard';
import Anthropic from '@anthropic-ai/sdk';
import { resolveModel } from '@/lib/models';

export interface AdvisorRequest {
  messages: { role: string; content: string }[];
  systemPrompt: string;
  apiKey: string;
  model?: string;
}

// Marker the client watches for to render a mid-stream error as an error bubble.
export const STREAM_ERROR_MARKER = '[[WEALTHOS_ERROR]]';

// Stream Claude's response as raw text deltas. Adaptive thinking lets Claude
// spend reasoning tokens only when a question needs them; streaming keeps the
// UI responsive during the slow ones. Errors after the stream opens are emitted
// inline (headers are already sent) via STREAM_ERROR_MARKER.
export function streamAdvisorResponse({ messages, systemPrompt, apiKey, model }: AdvisorRequest): ReadableStream<Uint8Array> {
  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: resolveModel(model),
          max_tokens: 4096,
          thinking: { type: 'adaptive' },
          system: systemPrompt,
          messages: messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        });

        stream.on('text', (delta) => controller.enqueue(encoder.encode(delta)));

        await stream.finalMessage();
        controller.close();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        controller.enqueue(encoder.encode(`\n\n${STREAM_ERROR_MARKER} ${msg}`));
        controller.close();
      }
    },
  });
}
