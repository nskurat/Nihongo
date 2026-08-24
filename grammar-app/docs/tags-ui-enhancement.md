# Grammar Tags UI Enhancement

Add short UI labels, facet-based color coding, and tag visibility to grammar cards and the detail modal. Make tags searchable and visually informative without cluttering the existing layout.

## Scope & Non-Goals

> [!IMPORTANT]
> **N5 integration is explicitly out of scope.** Adding N5 touches `LevelType`, routing, header navigation, and lesson-range guards across the entire app — that's a separate workstream. This plan only enhances tag display and filtering for the existing N3/N4 data.

## Open Questions

> [!NOTE]
> 1. **Tag filter bar**: For V1, tag search is integrated into the existing text search. A dedicated dropdown/facet filter bar can be added as a follow-up. Acceptable?
> 2. **Facet colors**: Proposing `indigo` for Function, `amber` for Register, `emerald` for Structure. These fit the existing indigo-dominant design language. Acceptable?

## Proposed Changes

### Data & Types

---

#### [MODIFY] [`tag-taxonomy.json`](file:///Users/nskurat/ai/japanese/Nihongo/grammar-app/src/data/tag-taxonomy.json)

Convert the flat `"tag-id": "description string"` format into structured objects with explicit UI labels:

**Before:**
```json
"cause-reason": "Marks the reason/cause behind a following statement or result."
```

**After:**
```json
"cause-reason": {
  "label": "Reason / Cause",
  "description": "Marks the reason/cause behind a following statement or result."
}
```

Also add a `color` field to each facet for UI theming:
```json
"function": {
  "label": "Function / Meaning",
  "color": "indigo",
  "tags": { ... }
}
```

All ~60 tags across the 3 facets get this treatment.

---

#### [MODIFY] [`japanese.ts`](file:///Users/nskurat/ai/japanese/Nihongo/grammar-app/src/types/japanese.ts)

Add fields the JSON data already has but the TypeScript interface is missing:

```diff
 export interface GrammarItem {
   id: string | number;
   title: string;
   meaning: string;
   structure: string;
   explanation: string;
+  summary?: string;
   details?: string;
+  tags?: string[];
+  level?: LevelType;
+  lesson?: number;
   examples?: Array<{
     jp: string;
     en: string;
   }>;
 }
```

Add new types for the taxonomy schema:

```ts
export interface TagDefinition {
  label: string;
  description: string;
}

export interface FacetDefinition {
  label: string;
  color: string;
  description: string;
  tags: Record<string, TagDefinition>;
}

export interface TagTaxonomy {
  facets: Record<string, FacetDefinition>;
}
```

---

#### [NEW] `src/utils/tags.ts`

Create a utility module that:
- Imports and parses `tag-taxonomy.json`
- Builds a flat lookup map at module load time (tag ID → `{ label, description, facet, color }`)
- Exports `getTagMeta(tagId: string): TagMeta | undefined`
- Exports `getAllTagsForFacet(facetId: string): TagMeta[]` (useful for future filter bar)

```ts
interface TagMeta {
  id: string;
  label: string;
  description: string;
  facet: string;
  facetLabel: string;
  color: string;  // 'indigo' | 'amber' | 'emerald'
}
```

---

### Logic & State

---

#### [MODIFY] [`useGrammar.ts`](file:///Users/nskurat/ai/japanese/Nihongo/grammar-app/src/features/grammar/useGrammar.ts)

1. **Inject `level` and `lesson`** into each `GrammarItem` when building the `grammarData` constant. This stamps every item with its provenance without touching the JSON files:

```ts
function stampItems(
  raw: Record<number, GrammarItem[]>,
  level: LevelType
): Record<number, GrammarItem[]> {
  const stamped: Record<number, GrammarItem[]> = {};
  for (const [lesson, items] of Object.entries(raw)) {
    stamped[Number(lesson)] = items.map(item => ({
      ...item,
      level,
      lesson: Number(lesson),
    }));
  }
  return stamped;
}
```

2. **Extend search filtering** to also match against tag IDs and tag labels (via `getTagMeta`). Explicitly **not** matching against full tag descriptions — those are too long and would produce noisy results:

```ts
const filteredContent = searchQuery.trim()
  ? currentContent.filter(item => {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.meaning.toLowerCase().includes(q) ||
        item.structure.toLowerCase().includes(q) ||
        (item.tags || []).some(tagId => {
          const meta = getTagMeta(tagId);
          return tagId.includes(q) || (meta?.label.toLowerCase().includes(q) ?? false);
        })
      );
    })
  : currentContent;
```

---

### UI Components

---

#### [NEW] `src/components/common/TagBadge.tsx`

A small, reusable component that renders a single tag as a colored pill with a CSS tooltip on hover:

- Takes `tagId: string` as prop
- Looks up metadata via `getTagMeta(tagId)`
- Renders a pill styled by facet color (indigo/amber/emerald variants)
- Shows the tag `label` as text
- On hover, displays a CSS-only tooltip with the full `description` (using `::after` pseudo-element and `data-tooltip` attribute — no external library needed)
- Compact sizing (`text-[11px]`, `px-2 py-0.5`) to fit unobtrusively in card headers

Color mapping:
| Facet     | Background        | Text             | Border            |
|-----------|-------------------|------------------|-------------------|
| indigo    | `bg-indigo-50`    | `text-indigo-700`| `border-indigo-200` |
| amber     | `bg-amber-50`     | `text-amber-800` | `border-amber-200`  |
| emerald   | `bg-emerald-50`   | `text-emerald-700`| `border-emerald-200`|

---

#### [MODIFY] [`GrammarSection.tsx`](file:///Users/nskurat/ai/japanese/Nihongo/grammar-app/src/features/grammar/GrammarSection.tsx)

Add tag pills to each grammar card, positioned below the title/meaning line in the card header (after line ~151, before the Deep Dive button):

```tsx
{/* Tag Badges */}
{item.tags && item.tags.length > 0 && (
  <div className="flex flex-wrap gap-1.5 mt-2">
    {item.tags.map(tagId => (
      <TagBadge key={tagId} tagId={tagId} />
    ))}
  </div>
)}
```

---

#### [MODIFY] [`GrammarDetailModal.tsx`](file:///Users/nskurat/ai/japanese/Nihongo/grammar-app/src/features/grammar/GrammarDetailModal.tsx)

Add a "Grammatical Profile" section at the top of the modal body (before the markdown explanation, around line ~88). This shows tags with their **full descriptions** expanded inline (not just as pills):

```tsx
{/* Grammatical Profile */}
{item.tags && item.tags.length > 0 && (
  <div className="space-y-2">
    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
      Grammatical Profile
    </h4>
    <div className="flex flex-wrap gap-2">
      {item.tags.map(tagId => {
        const meta = getTagMeta(tagId);
        if (!meta) return null;
        return (
          <div key={tagId} className="...">
            <span className="font-semibold">{meta.label}</span>
            <span className="text-slate-500">{meta.description}</span>
          </div>
        );
      })}
    </div>
  </div>
)}
```

---

#### [MODIFY] [`index.css`](file:///Users/nskurat/ai/japanese/Nihongo/grammar-app/src/index.css)

Add CSS for the tooltip used by `TagBadge`:

```css
/* Tag tooltip */
[data-tooltip] {
  position: relative;
}
[data-tooltip]:hover::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-slate-800);
  color: white;
  font-size: 0.7rem;
  line-height: 1.4;
  padding: 6px 10px;
  border-radius: 8px;
  white-space: normal;
  width: max-content;
  max-width: 260px;
  z-index: 50;
  pointer-events: none;
  animation: fadeIn 0.15s ease;
}
```

## Verification Plan

### Automated
- `npm run build` — confirms TypeScript compiles cleanly with the new types and imports.

### Manual
1. Start dev server (`npm run dev`), navigate to any N3 or N4 grammar lesson.
2. Confirm tag pills appear on grammar cards, color-coded by facet.
3. Hover over a tag pill — tooltip should display the full description.
4. Type a tag label fragment (e.g. "reason", "keigo") in the search bar — matching grammar points should appear.
5. Open the Deep Dive modal — confirm the "Grammatical Profile" section shows tags with expanded descriptions.

## Future Follow-Ups (Out of Scope)

- **N5 integration**: Expand `LevelType`, add N5 imports, update routing/header/lesson guards.
- **Dedicated tag filter bar**: Collapsible facet-based filter UI with checkboxes per tag.
- **Cross-level tag explorer**: "View all Reason/Cause patterns across N5–N3" drawer.
- **Click-to-filter**: Clicking a tag pill filters the list to matching items.
