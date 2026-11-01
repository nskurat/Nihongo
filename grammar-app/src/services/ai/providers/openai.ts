import { AiProvider, AiPromptOptions } from '../../../types/ai';
import { missingKeyError, requestJson } from '../errors';
import { MODEL_CATALOG, getDefaultModelId, isOpenAiReasoningModel, toModelOptions } from '../modelCatalog';

/** The part of a chat-completions reply this app reads. */
type ProviderReply = { choices?: { message?: { content?: string } }[] };

// Default to the newest non-reasoning model: it accepts every parameter this provider sends.
const models = toModelOptions(MODEL_CATALOG.providers.openai, undefined, (m) => !m.reasoning);
const DEFAULT_MODEL = getDefaultModelId(models);

export const openaiProvider: AiProvider = {
  id: 'openai',
  name: 'OpenAI (ChatGPT)',
  description: 'Industry-standard language models with structured JSON and nuanced Japanese output.',
  website: 'https://platform.openai.com/api-keys',
  requiresKey: true,
  models,

  async executePrompt(prompt: string, options: AiPromptOptions = {}): Promise<string> {
    const { apiKey, model = DEFAULT_MODEL, temperature = 0.7 } = options;

    if (!apiKey) {
      throw missingKeyError();
    }

    const payload: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: 'You are an expert Japanese educator.' },
        { role: 'user', content: prompt },
      ],
    };

    // Reasoning models (o-series, GPT-5+) reject any temperature but the default.
    if (!isOpenAiReasoningModel(model, models)) {
      payload.temperature = temperature;
    }

    if (options.responseFormat === 'json') {
      payload.response_format = { type: 'json_object' };
    }

    const data = (await requestJson('OpenAI', 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })) as ProviderReply;
    return data.choices?.[0]?.message?.content || '';
  },
};
