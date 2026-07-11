import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { resolveModel } from '@/lib/models';

export async function POST(req: NextRequest) {
  try {
    const { messages, systemPrompt, apiKey, model } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'Claude API key not configured. Please add it in Settings.' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });

    // Stream so large-output models don't hit HTTP timeouts; adaptive thinking
    // lets Claude spend reasoning tokens only when the question needs them,
    // keeping simple answers cheap.
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

    const response = await stream.finalMessage();

    const textBlock = response.content.find((b) => b.type === 'text');
    const text = textBlock && textBlock.type === 'text' ? textBlock.text : '';
    return NextResponse.json({ text });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
