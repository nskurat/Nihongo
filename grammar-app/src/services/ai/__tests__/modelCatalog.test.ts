import { describe, it, expect } from 'vitest';
import {
  MODEL_CATALOG,
  buildPickerOptions,
  formatModelLabel,
  getDefaultModelId,
  isOpenAiReasoningModel,
  toModelOptions,
} from '../modelCatalog';
import { anthropicProvider } from '../providers/anthropic';
import { geminiProvider } from '../providers/gemini';
import { openaiProvider } from '../providers/openai';
import { AiModelOption } from '../../../types/ai';

const entries = [
  { id: 'a', name: 'A', reasoning: true },
  { id: 'b', name: 'B', maxInputTokens: 10, deprecationDate: '2026-12-01' },
  { id: 'c', name: 'C' },
];

describe('toModelOptions', () => {
  it('marks the preferred id as the single default', () => {
    const options = toModelOptions(entries, 'c');
    expect(options.filter((o) => o.isDefault).map((o) => o.id)).toEqual(['c']);
  });

  it('falls back to the first match, then to the first entry', () => {
    expect(getDefaultModelId(toModelOptions(entries, 'missing', (e) => !e.reasoning))).toBe('b');
    expect(getDefaultModelId(toModelOptions(entries, 'missing'))).toBe('a');
    expect(getDefaultModelId(toModelOptions([]))).toBe('');
  });

  it('carries metadata', () => {
    expect(toModelOptions(entries)[1]).toEqual({ id: 'b', name: 'B', maxInputTokens: 10, deprecationDate: '2026-12-01' });
    expect(toModelOptions(entries)[0].reasoning).toBe(true);
  });
});

describe('provider defaults from the shipped catalog', () => {
  it('every provider has a non-empty list with exactly one default', () => {
    for (const provider of [anthropicProvider, geminiProvider, openaiProvider]) {
      expect(provider.models.length).toBeGreaterThan(0);
      expect(provider.models.filter((m) => m.isDefault)).toHaveLength(1);
    }
  });

  it('Anthropic defaults to Sonnet 5.5 when the catalog has it', () => {
    const hasSonnet = MODEL_CATALOG.providers.anthropic.some((m) => m.id === 'claude-sonnet-5-5');
    expect(getDefaultModelId(anthropicProvider.models)).toBe(
      hasSonnet ? 'claude-sonnet-5-5' : MODEL_CATALOG.providers.anthropic[0].id
    );
  });

  it('Gemini defaults to the floating Flash alias', () => {
    expect(getDefaultModelId(geminiProvider.models)).toBe('gemini-flash-latest');
  });

  it('OpenAI defaults to the first non-reasoning model', () => {
    const expected = MODEL_CATALOG.providers.openai.find((m) => !m.reasoning)?.id;
    expect(getDefaultModelId(openaiProvider.models)).toBe(expected);
    expect(isOpenAiReasoningModel(getDefaultModelId(openaiProvider.models), openaiProvider.models)).toBe(false);
  });
});

describe('isOpenAiReasoningModel', () => {
  const catalog: AiModelOption[] = [
    { id: 'gpt-4.1', name: 'GPT-4.1' },
    { id: 'gpt-5.5', name: 'GPT-5.5', reasoning: true },
  ];

  it('trusts the catalog flag', () => {
    expect(isOpenAiReasoningModel('gpt-5.5', catalog)).toBe(true);
    expect(isOpenAiReasoningModel('gpt-4.1', catalog)).toBe(false);
  });

  it('falls back to name patterns for unknown ids', () => {
    expect(isOpenAiReasoningModel('o1')).toBe(true);
    expect(isOpenAiReasoningModel('o4-mini')).toBe(true);
    expect(isOpenAiReasoningModel('gpt-5')).toBe(true);
    expect(isOpenAiReasoningModel('gpt-5.2-mini')).toBe(true);
    expect(isOpenAiReasoningModel('gpt-6.1-sol')).toBe(true);
    expect(isOpenAiReasoningModel('gpt-5-chat-latest')).toBe(false);
    expect(isOpenAiReasoningModel('gpt-4o-mini')).toBe(false);
    expect(isOpenAiReasoningModel('gpt-4.1')).toBe(false);
    expect(isOpenAiReasoningModel('gpt-3.5-turbo')).toBe(false);
  });
});

describe('buildPickerOptions', () => {
  const models: AiModelOption[] = [
    { id: 'x', name: 'X' },
    { id: 'y', name: 'Y', deprecationDate: '2026-12-11' },
  ];

  it('labels soon-retiring models', () => {
    expect(formatModelLabel(models[1])).toBe('Y (retiring 2026-12-11)');
  });

  it('lists the catalog as-is when the selection is in it', () => {
    const { options, selectedMissing } = buildPickerOptions(models, 'x');
    expect(selectedMissing).toBe(false);
    expect(options.map((o) => o.id)).toEqual(['x', 'y']);
  });

  it('keeps a saved model that is no longer listed, clearly labelled, instead of showing another', () => {
    const { options, selectedMissing } = buildPickerOptions(models, 'gpt-4o-mini');
    expect(selectedMissing).toBe(true);
    expect(options[0]).toEqual({ id: 'gpt-4o-mini', label: 'gpt-4o-mini (saved, not in list)', missing: true });
    expect(options).toHaveLength(3);
  });
});
