/**
 * Pure, side-effect-free helpers for scripts/update-model-catalog.ts. No fetch or node:fs here:
 * the script does all I/O, so this module can be unit-tested from
 * grammar-app/src/__tests__/scripts/modelCatalog.test.ts (vitest's root is grammar-app/).
 *
 * Input: LiteLLM's model_prices_and_context_window.json (a map of model id -> metadata).
 * Output: a short, curated, human-named model list per provider the app supports.
 */

export const LITELLM_SOURCE_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

export type CatalogProviderId = 'anthropic' | 'gemini' | 'openai';

/** The subset of a LiteLLM entry this module reads. Every field is optional in the source. */
export interface LiteLlmEntry {
  litellm_provider?: string;
  mode?: string;
  max_input_tokens?: number | null;
  max_output_tokens?: number | null;
  deprecation_date?: string;
  supports_reasoning?: boolean;
  supported_output_modalities?: string[];
}

export interface CatalogModel {
  id: string;
  name: string;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  /** Only set when the model is deprecated within DEPRECATION_WARNING_DAYS of the run date. */
  deprecationDate?: string;
  /** Reasoning-class model (OpenAI: rejects a non-default temperature). */
  reasoning?: boolean;
}

export interface ModelCatalog {
  generatedAt: string;
  source: string;
  providers: Record<CatalogProviderId, CatalogModel[]>;
}

export const DEPRECATION_WARNING_DAYS = 90;

/** How many versions to keep per model line (e.g. Sonnet, Gemini Flash, GPT mini). */
export const VERSIONS_PER_LINE = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A candidate after provider-specific parsing, before trimming and ordering. */
interface Candidate {
  model: CatalogModel;
  /** Grouping key: VERSIONS_PER_LINE are kept per line. */
  line: string;
  /** Numeric version parts, compared lexicographically (newest first). */
  version: number[];
  /** Tie-break inside one version: lower sorts first. */
  rank: number;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function parseVersion(text: string): number[] {
  return text.split(/[.-]/).map((part) => Number(part)).filter((n) => Number.isFinite(n));
}

export function compareVersionsDesc(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = (b[i] ?? 0) - (a[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * 'past' when the deprecation date is on or before `now`, 'soon' when it falls within
 * DEPRECATION_WARNING_DAYS, otherwise null. Unparseable dates count as null.
 */
export function deprecationStatus(date: string | undefined, now: Date): 'past' | 'soon' | null {
  if (!date) return null;
  const at = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(at)) return null;
  if (at <= now.getTime()) return 'past';
  if (at - now.getTime() <= DEPRECATION_WARNING_DAYS * DAY_MS) return 'soon';
  return null;
}

function baseModel(id: string, entry: LiteLlmEntry, name: string, now: Date): CatalogModel {
  const model: CatalogModel = { id, name };
  if (typeof entry.max_input_tokens === 'number') model.maxInputTokens = entry.max_input_tokens;
  if (typeof entry.max_output_tokens === 'number') model.maxOutputTokens = entry.max_output_tokens;
  if (deprecationStatus(entry.deprecation_date, now) === 'soon') model.deprecationDate = entry.deprecation_date;
  return model;
}

/** Text-only chat entries of one provider that are not already past their deprecation date. */
function chatEntries(raw: Record<string, unknown>, provider: string, now: Date): [string, LiteLlmEntry][] {
  const out: [string, LiteLlmEntry][] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue;
    const entry = value as LiteLlmEntry;
    if (entry.litellm_provider !== provider || entry.mode !== 'chat') continue;
    if (deprecationStatus(entry.deprecation_date, now) === 'past') continue;
    const outputs = entry.supported_output_modalities;
    if (outputs && outputs.some((m) => m !== 'text')) continue;
    out.push([key, entry]);
  }
  return out;
}

/** Keeps the newest VERSIONS_PER_LINE per line, then orders newest first, `rank` breaking ties. */
function trimAndOrder(candidates: Candidate[], perLine = VERSIONS_PER_LINE): CatalogModel[] {
  const sorted = [...candidates].sort(
    (a, b) => compareVersionsDesc(a.version, b.version) || a.rank - b.rank || a.model.id.localeCompare(b.model.id)
  );
  const seen = new Map<string, number>();
  const ids = new Set<string>();
  const kept: CatalogModel[] = [];
  for (const c of sorted) {
    if (ids.has(c.model.id)) continue;
    const count = seen.get(c.line) ?? 0;
    if (count >= perLine) continue;
    seen.set(c.line, count + 1);
    ids.add(c.model.id);
    kept.push(c.model);
  }
  return kept;
}

const DATED_SUFFIX = /-(\d{8}|\d{4}-\d{2}-\d{2})$/;

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

/** Line order inside one version number: most capable first. */
const ANTHROPIC_LINES = ['opus', 'sonnet', 'haiku', 'fable'] as const;

/** claude-sonnet-5-5 -> { line: 'sonnet', version: [5, 5] }; dated snapshots and previews -> null. */
export function parseAnthropicId(id: string): { line: (typeof ANTHROPIC_LINES)[number]; version: number[] } | null {
  const match = /^claude-([a-z]+)-(\d+(?:-\d{1,2})?)$/.exec(id);
  if (!match) return null;
  const line = match[1] as (typeof ANTHROPIC_LINES)[number];
  // Mythos is an invitation-only line; it would only produce errors for ordinary keys.
  if (!ANTHROPIC_LINES.includes(line)) return null;
  return { line, version: parseVersion(match[2]) };
}

export function anthropicDisplayName(id: string): string {
  const parsed = parseAnthropicId(id);
  if (!parsed) return id;
  const line = parsed.line[0].toUpperCase() + parsed.line.slice(1);
  return `Claude ${line} ${parsed.version.join('.')}`;
}

export function buildAnthropicModels(raw: Record<string, unknown>, now: Date): CatalogModel[] {
  const candidates: Candidate[] = [];
  for (const [id, entry] of chatEntries(raw, 'anthropic', now)) {
    if (DATED_SUFFIX.test(id)) continue;
    const parsed = parseAnthropicId(id);
    if (!parsed) continue;
    candidates.push({
      model: baseModel(id, entry, anthropicDisplayName(id), now),
      line: parsed.line,
      version: parsed.version,
      rank: ANTHROPIC_LINES.indexOf(parsed.line),
    });
  }
  return trimAndOrder(candidates);
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

const GEMINI_TIERS = ['flash', 'pro', 'flash-lite'] as const;
type GeminiTier = (typeof GEMINI_TIERS)[number];

const GEMINI_DENY = /gemma|lyria|tts|image|live|embed|audio|robotics|computer-use|deep-research|learnlm|customtools|omni/;

export interface ParsedGeminiId {
  tier: GeminiTier;
  /** null for the floating `gemini-<tier>-latest` aliases. */
  version: number[] | null;
  preview: boolean;
}

/** Allowlist parse: gemini-3.8-flash, gemini-3.1-pro-preview, gemini-flash-latest. Anything else -> null. */
export function parseGeminiId(id: string): ParsedGeminiId | null {
  if (GEMINI_DENY.test(id)) return null;
  const alias = /^gemini-(flash|pro|flash-lite)-latest$/.exec(id);
  if (alias) return { tier: alias[1] as GeminiTier, version: null, preview: false };
  const match = /^gemini-(\d+(?:\.\d+)?)-(flash-lite|flash|pro)(-preview)?$/.exec(id);
  if (!match) return null;
  return { tier: match[2] as GeminiTier, version: parseVersion(match[1]), preview: Boolean(match[3]) };
}

const GEMINI_TIER_LABEL: Record<GeminiTier, string> = { flash: 'Flash', pro: 'Pro', 'flash-lite': 'Flash-Lite' };

export function geminiDisplayName(id: string): string {
  const parsed = parseGeminiId(id);
  if (!parsed) return id;
  const tier = GEMINI_TIER_LABEL[parsed.tier];
  if (!parsed.version) return `Gemini ${tier} (latest)`;
  return `Gemini ${parsed.version.join('.')} ${tier}${parsed.preview ? ' (preview)' : ''}`;
}

export function buildGeminiModels(raw: Record<string, unknown>, now: Date): CatalogModel[] {
  // LiteLLM lists most Gemini models as `gemini/<id>`, a few also without the prefix.
  const byId = new Map<string, LiteLlmEntry>();
  for (const [key, entry] of chatEntries(raw, 'gemini', now)) {
    const id = key.replace(/^gemini\//, '');
    if (!byId.has(id) || key.startsWith('gemini/')) byId.set(id, entry);
  }

  const parsed = [...byId.entries()]
    .map(([id, entry]) => ({ id, entry, info: parseGeminiId(id) }))
    .filter((x): x is { id: string; entry: LiteLlmEntry; info: ParsedGeminiId } => x.info !== null);

  // Newest stable version per tier: a preview is only kept when it is newer than that.
  const newestStable = new Map<GeminiTier, number[]>();
  for (const { info } of parsed) {
    if (!info.version || info.preview) continue;
    const current = newestStable.get(info.tier);
    if (!current || compareVersionsDesc(info.version, current) < 0) newestStable.set(info.tier, info.version);
  }

  const aliases: CatalogModel[] = [];
  const candidates: Candidate[] = [];
  for (const { id, entry, info } of parsed) {
    const model = baseModel(id, entry, geminiDisplayName(id), now);
    if (!info.version) {
      aliases.push(model);
      continue;
    }
    if (info.preview) {
      const stable = newestStable.get(info.tier);
      if (stable && compareVersionsDesc(info.version, stable) >= 0) continue;
    }
    candidates.push({ model, line: info.tier, version: info.version, rank: GEMINI_TIERS.indexOf(info.tier) });
  }

  // Floating aliases first (they never go stale), in tier order.
  aliases.sort(
    (a, b) => GEMINI_TIERS.indexOf(parseGeminiId(a.id)!.tier) - GEMINI_TIERS.indexOf(parseGeminiId(b.id)!.tier)
  );
  return [...aliases, ...trimAndOrder(candidates)];
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

/**
 * General-purpose GPT/o-series ids only: gpt-5.5, gpt-5.4-mini, gpt-6.1-sol, o3. This allowlist
 * already excludes audio/realtime/search/transcribe/image/embedding/moderation/instruct models,
 * `*-chat-latest`, specialised variants (law, cyber, rosalind) and fine-tunes.
 */
const OPENAI_ID = /^(?:gpt-(\d+(?:\.\d+)?)(?:-(mini|nano|sol|terra|luna|astra))?|o(\d+)(?:-(mini))?)$/;

/** Inside one version: flagship first, then the named tiers, then the small models. */
const OPENAI_VARIANT_RANK = ['', 'sol', 'terra', 'luna', 'astra', 'mini', 'nano'];

/** Legacy families we never offer, even when LiteLLM has no deprecation date for them. */
export function isLegacyOpenAiId(id: string): boolean {
  // gpt-3.5*, gpt-4, gpt-4-turbo, gpt-4o*; gpt-4.1 is still current.
  return /^gpt-(?:3\.5|4)(?!\d)/.test(id) && !/^gpt-4\.1(?:$|-)/.test(id);
}

export function parseOpenAiId(id: string): { family: 'gpt' | 'o'; version: number[]; variant: string } | null {
  if (isLegacyOpenAiId(id)) return null;
  const match = OPENAI_ID.exec(id);
  if (!match) return null;
  if (match[1]) return { family: 'gpt', version: parseVersion(match[1]), variant: match[2] ?? '' };
  return { family: 'o', version: parseVersion(match[3]), variant: match[4] ?? '' };
}

export function openAiDisplayName(id: string): string {
  const parsed = parseOpenAiId(id);
  if (!parsed) return id;
  const variant = parsed.variant ? ` ${parsed.variant[0].toUpperCase()}${parsed.variant.slice(1)}` : '';
  if (parsed.family === 'o') return `o${parsed.version.join('.')}${variant}`;
  return `GPT-${parsed.version.join('.')}${variant}`;
}

export function buildOpenAiModels(raw: Record<string, unknown>, now: Date): CatalogModel[] {
  const candidates: Candidate[] = [];
  for (const [id, entry] of chatEntries(raw, 'openai', now)) {
    // Dated snapshots (gpt-5.5-2026-04-23) never match the allowlist; the alias is kept instead.
    const parsed = parseOpenAiId(id);
    if (!parsed) continue;
    const model = baseModel(id, entry, openAiDisplayName(id), now);
    const reasoning = parsed.family === 'o' || entry.supports_reasoning === true;
    if (reasoning) model.reasoning = true;
    candidates.push({
      model,
      // Non-reasoning models form their own lines, so at least one always survives the trim.
      line: `${parsed.family}:${parsed.variant}:${reasoning ? 'r' : 'plain'}`,
      version: parsed.version,
      rank: OPENAI_VARIANT_RANK.indexOf(parsed.variant) + (parsed.family === 'o' ? 100 : 0),
    });
  }
  return trimAndOrder(candidates);
}

// ---------------------------------------------------------------------------

export function buildModelCatalog(raw: Record<string, unknown>, now: Date, source = LITELLM_SOURCE_URL): ModelCatalog {
  return {
    generatedAt: now.toISOString(),
    source,
    providers: {
      anthropic: buildAnthropicModels(raw, now),
      gemini: buildGeminiModels(raw, now),
      openai: buildOpenAiModels(raw, now),
    },
  };
}
