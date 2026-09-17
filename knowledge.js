const stopWords = new Set(["the", "and", "for", "with", "that", "this", "from", "what", "when", "where", "your", "about", "into", "have"]);

export function retrieveKnowledge(records, query, limit = 5) {
  const terms = tokenize(query);
  return records
    .filter((record) => ["policy", "document"].includes(record.type) && !record.deletedAt)
    .map((record) => {
      const haystack = `${record.name} ${record.details}`.toLowerCase();
      const score = terms.length ? terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0) : 1;
      return { record, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.record.updatedAt.localeCompare(a.record.updatedAt))
    .slice(0, limit)
    .map(({ record }) => ({ id: record.id, title: record.name, excerpt: String(record.details || "").slice(0, 2_500), updatedAt: record.updatedAt }));
}

export function knowledgeContext(sources) {
  if (!sources.length) return "No matching internal policy or document source was found.";
  return sources.map((source, index) => `[S${index + 1}] ${source.title}\n${source.excerpt}`).join("\n\n");
}

function tokenize(value) {
  return [...new Set(String(value || "").toLowerCase().match(/[a-z0-9]{3,}/g) || [])]
    .filter((term) => !stopWords.has(term));
}
