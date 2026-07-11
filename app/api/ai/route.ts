import { NextRequest, NextResponse } from 'next/server';
import { resolveAnthropicKey } from '@/lib/server/env';
import { streamAdvisorResponse } from '@/lib/server/anthropic';

export async function POST(req: NextRequest) {
  const { messages, systemPrompt, apiKey, model } = await req.json();

  // User-supplied key wins; fall back to the server's ANTHROPIC_API_KEY.
  const key = resolveAnthropicKey(apiKey);
  if (!key) {
    return NextResponse.json(
      { error: 'Claude API key not configured. Add it in Settings or set ANTHROPIC_API_KEY on the server.' },
      { status: 400 }
    );
  }

  const body = streamAdvisorResponse({ messages, systemPrompt, apiKey: key, model });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
