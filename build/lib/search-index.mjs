/**
 * Build an inverted index from entries.
 * Returns { token: [entryId, ...] } where entryId is the entry's path.
 * Tokens are lowercased, deduped, and extracted from: title, desc, tags,
 * pinyin, char, and category.
 */
export function buildSearchIndex(entries) {
  const index = {};

  for (const entry of entries) {
    if (entry.status !== 'complete') continue;

    const id = entry.path;
    const fields = [
      entry.title,
      entry.desc,
      entry.category,
      entry.type,
      entry.pinyin,
      entry.char,
      ...(entry.tags || []),
    ].filter(Boolean);

    const tokens = new Set(
      fields
        .join(' ')
        .toLowerCase()
        .replace(/[·—·\-·/\\.,;:!?()[\]{}'"]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 1)
    );

    for (const token of tokens) {
      if (!index[token]) index[token] = [];
      index[token].push(id);
    }
  }

  return index;
}
