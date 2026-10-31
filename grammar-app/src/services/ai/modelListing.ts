/**
 * Pure helpers for the free "Check key" action: build each provider's list-models request
 * and interpret the response. Listing models costs no tokens. No fetch happens here; the
 * adapter in keyChecker.ts does the I/O.
 */
import { AiProviderId } from '../../types/ai';

export interface ListModelsRequest {
  url: string;
  headers: Record<string, string>;
}

export type KeyCheckResult =
  | { status: 'ok'; modelIds: string[] }
  | { status: 'invalid-key'; message: string }
  | { status: 'network'; message: string }
  | { status: 'error'; message: string };

export function buildListModelsRequest(providerId: AiProviderId, apiKey: string): ListModelsRequest {
  const key = apiKey.trim();
  switch (providerId) {
    case 'anthropic':
      return {
        url: 'https://api.anthropic.com/v1/models?limit=1000',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      };
    case 'gemini':
      // Header, never `?key=`: the Gemini preflight rejects an Authorization header, and a
      // query-string key leaks into URLs and logs.
      return {
        url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
        headers: { 'x-goog-api-key': key },
      };
    case 'openai':
      return {
        url: 'https://api.openai.com/v1/models',
        headers: { Authorization: `Bearer ${key}` },
      };
  }
}

/** Model ids from a successful list response (Gemini's `models/` prefix stripped). */
export function extractModelIds(providerId: AiProviderId, body: unknown): string[] {
  if (!body || typeof body !== 'object') return [];
  const record = body as Record<string, unknown>;
  const list = providerId === 'gemini' ? record.models : record.data;
  if (!Array.isArray(list)) return [];
  const ids: string[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const raw = providerId === 'gemini' ? (item as { name?: unknown }).name : (item as { id?: unknown }).id;
    if (typeof raw === 'string' && raw) ids.push(raw.replace(/^models\//, ''));
  }
  return ids;
}

function errorMessage(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const error = (body as { error?: unknown }).error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}

/** Gemini answers a bad key with 400 INVALID_ARGUMENT / API_KEY_INVALID rather than 401. */
function isGeminiBadKey(body: unknown, message: string): boolean {
  return /api key/i.test(message) || JSON.stringify(body ?? '').includes('API_KEY_INVALID');
}

export function interpretListModelsResponse(providerId: AiProviderId, status: number, body: unknown): KeyCheckResult {
  if (status >= 200 && status < 300) {
    return { status: 'ok', modelIds: extractModelIds(providerId, body) };
  }
  const message = errorMessage(body);
  if (status === 401 || status === 403 || (providerId === 'gemini' && status === 400 && isGeminiBadKey(body, message))) {
    return { status: 'invalid-key', message: message || `Key rejected (HTTP ${status}).` };
  }
  if (status === 429) {
    return { status: 'error', message: message || 'Rate limited (HTTP 429). Try again in a minute.' };
  }
  return { status: 'error', message: message || `Provider returned HTTP ${status}.` };
}

/** A fetch that rejects (rather than resolving with a status) is a network or CORS failure. */
export function interpretFetchFailure(err: unknown): KeyCheckResult {
  const detail = err instanceof Error ? err.message : String(err);
  return {
    status: 'network',
    message: `Could not reach the provider (network error or blocked by the browser/CORS)${detail ? `: ${detail}` : ''}.`,
  };
}
