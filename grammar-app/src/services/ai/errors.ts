/**
 * Typed AI failures. Every provider call and every parse of a model reply fails with an
 * AiError, so the UI can say what went wrong (and whether trying again could help)
 * without parsing messages.
 */

export type AiErrorKind =
  /** No API key stored for the provider: open AI settings. */
  | 'missing-key'
  /** 401/403: the key was rejected. */
  | 'auth'
  /** 429: too many requests. Retryable. */
  | 'rate-limit'
  /** fetch itself failed (offline, DNS, CORS). Retryable. */
  | 'network'
  /** The model answered but the reply can't be used (bad JSON, missing fields, nothing usable). */
  | 'bad-response'
  /** Any other non-2xx from the provider; 5xx is retryable. */
  | 'provider';

export class AiError extends Error {
  readonly kind: AiErrorKind;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(kind: AiErrorKind, message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'AiError';
    this.kind = kind;
    this.status = options.status;
    this.retryable =
      kind === 'rate-limit' || kind === 'network' || (kind === 'provider' && (options.status ?? 0) >= 500);
  }
}

/** The missing-key error keeps the message older code and tests match on. */
export const missingKeyError = () => new AiError('missing-key', 'MISSING_KEY');

export function isMissingKey(err: unknown): boolean {
  return err instanceof AiError ? err.kind === 'missing-key' : err instanceof Error && err.message === 'MISSING_KEY';
}

/** Maps a non-2xx provider response to an AiError. */
export function aiErrorFromStatus(provider: string, status: number, detail?: string): AiError {
  const message = detail || `${provider} API returned status ${status}`;
  if (status === 401 || status === 403) return new AiError('auth', message, { status });
  if (status === 429) return new AiError('rate-limit', message, { status });
  return new AiError('provider', message, { status });
}

/** Normalises anything thrown during an AI call into an AiError. */
export function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  if (isMissingKey(err)) return missingKeyError();
  const message = err instanceof Error ? err.message : String(err);
  return new AiError('provider', message, { cause: err });
}

/**
 * POSTs to a provider and returns its JSON body. `fetch(url, init)` is called exactly as
 * given (request shapes are the provider's business); only failures are translated.
 */
export async function requestJson(provider: string, url: string, init: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new AiError('network', `Couldn't reach ${provider}: ${err instanceof Error ? err.message : String(err)}`, {
      cause: err,
    });
  }
  if (!res.ok) {
    const errData = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw aiErrorFromStatus(provider, res.status, errData.error?.message);
  }
  return res.json();
}

/** Runs `parse` over a model reply; any failure becomes a 'bad-response' AiError. */
export function parseReply<T>(parse: () => T): T {
  try {
    return parse();
  } catch (err) {
    if (err instanceof AiError) throw err;
    throw new AiError('bad-response', err instanceof Error ? err.message : String(err), { cause: err });
  }
}

/** One line for the UI, saying what happened and what to do. */
export function aiErrorMessage(err: unknown): string {
  const e = toAiError(err);
  switch (e.kind) {
    case 'missing-key':
      return 'Add an API key in AI settings to use this.';
    case 'auth':
      return 'The API key was rejected. Check it in AI settings.';
    case 'rate-limit':
      return 'The AI provider is limiting requests right now. Wait a moment and try again.';
    case 'network':
      return "Couldn't reach the AI provider. Check your connection and try again.";
    case 'bad-response':
      return "The AI's reply couldn't be used. Try again.";
    case 'provider':
      return `The AI provider returned an error${e.status ? ` (${e.status})` : ''}. Try again later.`;
  }
}
