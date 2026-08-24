import taxonomy from '../data/tag-taxonomy.json';
import { TagTaxonomy } from '../types/japanese';

export interface TagMeta {
  id: string;
  label: string;
  description: string;
  facet: string;
  facetLabel: string;
  color: string;
}

const typedTaxonomy = taxonomy as unknown as TagTaxonomy;

const tagMetaById = new Map<string, TagMeta>();
const tagsByFacet = new Map<string, TagMeta[]>();

for (const [facetId, facet] of Object.entries(typedTaxonomy.facets)) {
  const facetTags: TagMeta[] = [];
  for (const [tagId, tag] of Object.entries(facet.tags)) {
    const meta: TagMeta = {
      id: tagId,
      label: tag.label,
      description: tag.description,
      facet: facetId,
      facetLabel: facet.label,
      color: facet.color,
    };
    tagMetaById.set(tagId, meta);
    facetTags.push(meta);
  }
  tagsByFacet.set(facetId, facetTags);
}

export function getTagMeta(tagId: string): TagMeta | undefined {
  return tagMetaById.get(tagId);
}

export function getAllTagsForFacet(facetId: string): TagMeta[] {
  return tagsByFacet.get(facetId) || [];
}
