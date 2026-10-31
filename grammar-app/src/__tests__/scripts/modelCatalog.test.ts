import { describe, it, expect } from 'vitest';
import {
  anthropicDisplayName,
  buildAnthropicModels,
  buildGeminiModels,
  buildModelCatalog,
  buildOpenAiModels,
  compareVersionsDesc,
  deprecationStatus,
  geminiDisplayName,
  isLegacyOpenAiId,
  openAiDisplayName,
  parseGeminiId,
  parseOpenAiId,
} from '../../../../scripts/lib/modelCatalog';

const NOW = new Date('2026-10-31T12:00:00Z');

const chat = (provider: string, extra: Record<string, unknown> = {}) => ({
  litellm_provider: provider,
  mode: 'chat',
  max_input_tokens: 1000000,
  max_output_tokens: 128000,
  ...extra,
});

describe('shared helpers', () => {
  it('orders versions newest first', () => {
    expect(compareVersionsDesc([5, 5], [5])).toBeLessThan(0);
    expect(compareVersionsDesc([4, 5], [5])).toBeGreaterThan(0);
    expect(compareVersionsDesc([3], [3, 0])).toBe(0);
  });

  it('classifies deprecation dates relative to the run date', () => {
    expect(deprecationStatus(undefined, NOW)).toBeNull();
    expect(deprecationStatus('2026-10-23', NOW)).toBe('past');
    expect(deprecationStatus('2026-12-11', NOW)).toBe('soon');
    expect(deprecationStatus('2027-05-07', NOW)).toBeNull();
    expect(deprecationStatus('not a date', NOW)).toBeNull();
  });
});

describe('Anthropic', () => {
  const raw = {
    'claude-opus-5-5': chat('anthropic'),
    'claude-sonnet-5-5': chat('anthropic'),
    'claude-haiku-5-5': chat('anthropic'),
    'claude-fable-5-1': chat('anthropic'),
    'claude-sonnet-5': chat('anthropic'),
    'claude-sonnet-4-6': chat('anthropic'),
    'claude-sonnet-4-5': chat('anthropic', { deprecation_date: '2026-11-30' }),
    'claude-haiku-4-5': chat('anthropic', { max_input_tokens: 200000, max_output_tokens: 64000 }),
    'claude-haiku-4-5-20251001': chat('anthropic'),
    'claude-mythos-5-1': chat('anthropic'),
    'claude-mythos-preview': chat('anthropic', { deprecation_date: '2026-06-09' }),
    'claude-3-old': chat('anthropic', { deprecation_date: '2025-01-01' }),
    'claude-embed': { litellm_provider: 'anthropic', mode: 'embedding' },
  };

  it('names models from their ids', () => {
    expect(anthropicDisplayName('claude-sonnet-5-5')).toBe('Claude Sonnet 5.5');
    expect(anthropicDisplayName('claude-fable-5-1')).toBe('Claude Fable 5.1');
    expect(anthropicDisplayName('claude-opus-5')).toBe('Claude Opus 5');
  });

  it('keeps the newest two per line, newest first, most capable first within a version', () => {
    const models = buildAnthropicModels(raw, NOW);
    expect(models.map((m) => m.id)).toEqual([
      'claude-opus-5-5',
      'claude-sonnet-5-5',
      'claude-haiku-5-5',
      'claude-fable-5-1',
      'claude-sonnet-5',
      'claude-haiku-4-5',
    ]);
  });

  it('drops dated snapshots, previews, past-deprecated and invitation-only models', () => {
    const ids = buildAnthropicModels(raw, NOW).map((m) => m.id);
    expect(ids).not.toContain('claude-haiku-4-5-20251001');
    expect(ids).not.toContain('claude-mythos-5-1');
    expect(ids).not.toContain('claude-mythos-preview');
    expect(ids).not.toContain('claude-3-old');
  });

  it('carries token limits', () => {
    const haiku = buildAnthropicModels(raw, NOW).find((m) => m.id === 'claude-haiku-4-5');
    expect(haiku).toMatchObject({ maxInputTokens: 200000, maxOutputTokens: 64000 });
    expect(haiku?.deprecationDate).toBeUndefined();
  });

  it('marks a model deprecating within 90 days', () => {
    const models = buildAnthropicModels({ 'claude-sonnet-4-5': chat('anthropic', { deprecation_date: '2026-11-30' }) }, NOW);
    expect(models).toEqual([expect.objectContaining({ id: 'claude-sonnet-4-5', deprecationDate: '2026-11-30' })]);
  });
});

describe('Gemini', () => {
  const raw = {
    'gemini-flash-latest': chat('gemini'),
    'gemini/gemini-flash-latest': chat('gemini'),
    'gemini/gemini-pro-latest': chat('gemini'),
    'gemini/gemini-3.8-flash': chat('gemini'),
    'gemini/gemini-3.7-flash': chat('gemini'),
    'gemini/gemini-3.6-flash': chat('gemini'),
    'gemini/gemini-3-flash-preview': chat('gemini'),
    'gemini/gemini-3.1-pro-preview': chat('gemini'),
    'gemini/gemini-2.5-pro': chat('gemini'),
    'gemini/gemini-3.1-flash-lite-preview': chat('gemini', { deprecation_date: '2026-05-25' }),
    'gemini/gemini-3.1-flash-lite': chat('gemini', { deprecation_date: '2027-05-07' }),
    'gemini/gemma-4-31b-it': chat('gemini'),
    'gemini/lyria-3.5': chat('gemini'),
    'gemini/gemini-2.5-pro-preview-tts': chat('gemini'),
    'gemini/gemini-robotics-er-2-preview': chat('gemini'),
    'gemini/gemini-omni-1.1-flash': chat('gemini', { supported_output_modalities: ['text', 'video'] }),
    'gemini/gemini-4-argon': chat('gemini'),
    'gemini-exp-1206': chat('gemini'),
    'gemini/text-embedding-004': { litellm_provider: 'gemini', mode: 'embedding' },
  };

  it('parses tiers, versions and aliases', () => {
    expect(parseGeminiId('gemini-flash-lite-latest')).toEqual({ tier: 'flash-lite', version: null, preview: false });
    expect(parseGeminiId('gemini-3.5-flash-lite')).toEqual({ tier: 'flash-lite', version: [3, 5], preview: false });
    expect(parseGeminiId('gemini-3.1-pro-preview')).toEqual({ tier: 'pro', version: [3, 1], preview: true });
    expect(parseGeminiId('gemma-4-31b-it')).toBeNull();
    expect(parseGeminiId('gemini-4-argon')).toBeNull();
  });

  it('names models', () => {
    expect(geminiDisplayName('gemini-flash-latest')).toBe('Gemini Flash (latest)');
    expect(geminiDisplayName('gemini-3.8-flash')).toBe('Gemini 3.8 Flash');
    expect(geminiDisplayName('gemini-3.1-pro-preview')).toBe('Gemini 3.1 Pro (preview)');
    expect(geminiDisplayName('gemini-3.5-flash-lite')).toBe('Gemini 3.5 Flash-Lite');
  });

  it('strips the prefix, puts floating aliases first and keeps two versions per tier', () => {
    expect(buildGeminiModels(raw, NOW).map((m) => m.id)).toEqual([
      'gemini-flash-latest',
      'gemini-pro-latest',
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.1-pro-preview',
      'gemini-3.1-flash-lite',
      'gemini-2.5-pro',
    ]);
  });

  it('keeps a preview only when no stable model of that tier is as new', () => {
    const ids = buildGeminiModels(raw, NOW).map((m) => m.id);
    expect(ids).toContain('gemini-3.1-pro-preview'); // newest stable Pro is 2.5
    expect(ids).not.toContain('gemini-3-flash-preview'); // stable 3.8 Flash exists
  });
});

describe('OpenAI', () => {
  const reasoning = { supports_reasoning: true };
  const raw = {
    'gpt-6.1-sol': chat('openai', reasoning),
    'gpt-6-sol': chat('openai', reasoning),
    'gpt-5.6-sol': chat('openai', reasoning),
    'gpt-5.6': chat('openai', reasoning),
    'gpt-5.5': chat('openai', reasoning),
    'gpt-5.5-2026-04-23': chat('openai', reasoning),
    'gpt-5.4': chat('openai', reasoning),
    'gpt-5.4-mini': chat('openai', reasoning),
    'gpt-5-mini': chat('openai', { ...reasoning, deprecation_date: '2026-12-11' }),
    'gpt-4.1': chat('openai'),
    'gpt-4.1-mini': chat('openai'),
    'gpt-4.1-nano': chat('openai', { deprecation_date: '2026-10-23' }),
    'gpt-4o': chat('openai'),
    'gpt-4o-mini': chat('openai'),
    'gpt-3.5-turbo': chat('openai', { deprecation_date: '2026-10-23' }),
    'gpt-4-turbo': chat('openai'),
    o3: chat('openai', { ...reasoning, deprecation_date: '2026-12-11' }),
    'o4-mini': chat('openai', { ...reasoning, deprecation_date: '2026-10-23' }),
    'gpt-audio-1.5': chat('openai'),
    'gpt-5-search-api': chat('openai', reasoning),
    'gpt-4o-mini-search-preview': chat('openai'),
    'gpt-6-astra-law': chat('openai', reasoning),
    'gpt-5.5-cyber': chat('openai'),
    'chat-latest': chat('openai', reasoning),
    'gpt-5.1-chat-latest': chat('openai'),
    'ft:gpt-4.1-2025-04-14': chat('openai'),
    'gpt-realtime': { litellm_provider: 'openai', mode: 'realtime' },
  };

  it('recognises legacy families', () => {
    expect(isLegacyOpenAiId('gpt-4o-mini')).toBe(true);
    expect(isLegacyOpenAiId('gpt-4-turbo')).toBe(true);
    expect(isLegacyOpenAiId('gpt-3.5-turbo')).toBe(true);
    expect(isLegacyOpenAiId('gpt-4.1-mini')).toBe(false);
    expect(isLegacyOpenAiId('gpt-5.5')).toBe(false);
  });

  it('parses and names general-purpose ids only', () => {
    expect(parseOpenAiId('gpt-5.4-mini')).toEqual({ family: 'gpt', version: [5, 4], variant: 'mini' });
    expect(parseOpenAiId('o3')).toEqual({ family: 'o', version: [3], variant: '' });
    expect(parseOpenAiId('gpt-5.5-2026-04-23')).toBeNull();
    expect(parseOpenAiId('gpt-6-astra-law')).toBeNull();
    expect(openAiDisplayName('gpt-5.4-mini')).toBe('GPT-5.4 Mini');
    expect(openAiDisplayName('gpt-6.1-sol')).toBe('GPT-6.1 Sol');
    expect(openAiDisplayName('o3')).toBe('o3');
  });

  it('filters, trims to two per line and orders newest first', () => {
    expect(buildOpenAiModels(raw, NOW).map((m) => m.id)).toEqual([
      'gpt-6.1-sol',
      'gpt-6-sol',
      'gpt-5.6',
      'gpt-5.5',
      'gpt-5.4-mini',
      'gpt-5-mini',
      'gpt-4.1',
      'gpt-4.1-mini',
      'o3',
    ]);
  });

  it('flags reasoning models and soon-deprecated ones', () => {
    const models = buildOpenAiModels(raw, NOW);
    expect(models.find((m) => m.id === 'gpt-5.5')?.reasoning).toBe(true);
    expect(models.find((m) => m.id === 'o3')).toMatchObject({ reasoning: true, deprecationDate: '2026-12-11' });
    expect(models.find((m) => m.id === 'gpt-4.1')?.reasoning).toBeUndefined();
  });
});

describe('buildModelCatalog', () => {
  it('stamps the run date and source and fills every provider', () => {
    const catalog = buildModelCatalog(
      {
        'claude-sonnet-5-5': chat('anthropic'),
        'gemini/gemini-flash-latest': chat('gemini'),
        'gpt-4.1': chat('openai'),
      },
      NOW,
      'fixture'
    );
    expect(catalog.generatedAt).toBe(NOW.toISOString());
    expect(catalog.source).toBe('fixture');
    expect(catalog.providers.anthropic.map((m) => m.id)).toEqual(['claude-sonnet-5-5']);
    expect(catalog.providers.gemini.map((m) => m.id)).toEqual(['gemini-flash-latest']);
    expect(catalog.providers.openai.map((m) => m.id)).toEqual(['gpt-4.1']);
  });
});
