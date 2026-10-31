/**
 * Adapter for the free "Check key" action (pattern: readingStorage.ts). It calls the
 * provider's list-models endpoint, which costs no tokens, and never goes through
 * executeAiPrompt. Tests swap the fetch implementation or the whole adapter.
 */
import { AiProviderId } from '../../types/ai';
import {
  KeyCheckResult,
  buildListModelsRequest,
  interpretFetchFailure,
  interpretListModelsResponse,
} from './modelListing';

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string> }) => Promise<{
  status: number;
  json(): Promise<unknown>;
}>;

export abstract class BaseKeyChecker {
  abstract check(providerId: AiProviderId, apiKey: string): Promise<KeyCheckResult>;
}

export class FetchKeyChecker extends BaseKeyChecker {
  private fetchImpl: FetchLike;

  constructor(fetchImpl?: FetchLike) {
    super();
    this.fetchImpl = fetchImpl ?? ((url, init) => fetch(url, init));
  }

  async check(providerId: AiProviderId, apiKey: string): Promise<KeyCheckResult> {
    if (!apiKey.trim()) return { status: 'invalid-key', message: 'Please enter an API key first.' };
    const { url, headers } = buildListModelsRequest(providerId, apiKey);
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.fetchImpl(url, { method: 'GET', headers });
    } catch (err) {
      return interpretFetchFailure(err);
    }
    const body = await res.json().catch(() => null);
    return interpretListModelsResponse(providerId, res.status, body);
  }
}

let currentChecker: BaseKeyChecker = new FetchKeyChecker();

export function getKeyChecker(): BaseKeyChecker {
  return currentChecker;
}

export function setKeyChecker(checker: BaseKeyChecker): void {
  if (!(checker instanceof BaseKeyChecker)) {
    throw new Error('Checker must inherit from BaseKeyChecker');
  }
  currentChecker = checker;
}
