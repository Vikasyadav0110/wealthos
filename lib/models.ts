// Claude models the AI advisor can use. Ordered most-capable → cheapest.
// Adaptive thinking (set in the API route) lets each model spend reasoning
// tokens only when a question actually needs it — better answers, fewer credits.

export interface ClaudeModelOption {
  id: string;
  label: string;
  blurb: string;
}

export const CLAUDE_MODELS: ClaudeModelOption[] = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', blurb: 'Most capable — best for nuanced financial advice' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', blurb: 'Near-Opus quality at lower cost — great default' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', blurb: 'Fastest & cheapest — good for quick questions' },
];

// Cost-effective default: strong reasoning without Opus pricing.
export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-5';

const VALID_MODEL_IDS = new Set(CLAUDE_MODELS.map((m) => m.id));

export function resolveModel(model?: string): string {
  return model && VALID_MODEL_IDS.has(model) ? model : DEFAULT_CLAUDE_MODEL;
}
