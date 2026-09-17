const protectedFields = new Set([
  "age", "gender", "marital status", "ethnicity", "race", "religion", "disability",
  "medical", "pregnancy", "nationality", "sexual orientation"
]);

export function analyzeWorkforce(records, filters = {}) {
  const employees = records
    .filter((record) => record.type === "employee" && !record.deletedAt)
    .map((record) => ({ record, fields: record.attributes || parseDetails(record.details) }));
  const filtered = employees.filter(({ fields }) => Object.entries(filters).every(([key, value]) => {
    if (!value) return true;
    return normalize(fields[key]) === normalize(value);
  }));
  const attritionCohort = filtered.filter(({ fields }) => ["yes", "no"].includes(normalize(fields.attrition)));
  const attrition = attritionCohort.filter(({ fields }) => normalize(fields.attrition) === "yes").length;
  const attritionRate = rate(attrition, attritionCohort.length);
  const dimensions = ["department", "job role", "job level", "overtime", "years at company"];
  const breakdowns = Object.fromEntries(dimensions.map((dimension) => [dimension, breakdown(attritionCohort, dimension)]));
  const availableFields = [...new Set(filtered.flatMap(({ fields }) => Object.keys(fields)))]
    .filter((field) => !protectedFields.has(normalize(field)))
    .sort();
  const generatedAt = new Date().toISOString();
  return {
    summary: { employees: filtered.length, analyzedEmployees: attritionCohort.length, attrition, attritionRate },
    filters,
    breakdowns,
    availableFields,
    provenance: {
      source: sourceLabel(filtered),
      rowCount: filtered.length,
      generatedAt,
      method: "Deterministic aggregate counts and univariate rates; associations only, not causal inference.",
      privacy: "Protected characteristics are excluded from analysis and output. No individual risk scores are produced."
    }
  };
}

export function analyticsEvidence(analysis) {
  const lines = [
    `Stored employee rows: ${analysis.summary.employees}`,
    `Rows with a recorded attrition outcome: ${analysis.summary.analyzedEmployees}`,
    `Verified attrition count: ${analysis.summary.attrition}`,
    `Verified attrition rate: ${analysis.summary.attritionRate}%`
  ];
  for (const [dimension, groups] of Object.entries(analysis.breakdowns)) {
    if (!groups.length) continue;
    lines.push(`${title(dimension)}: ${groups.slice(0, 20).map((group) => `${group.label}=${group.attritionRate}% (${group.attrition}/${group.total})`).join("; ")}`);
  }
  return lines.join("\n");
}

export function validateAnalyticsOutput(text, analysis) {
  const verifiedRates = new Set([
    analysis.summary.attritionRate,
    ...Object.values(analysis.breakdowns).flat().map((group) => group.attritionRate)
  ].map((value) => Number(value).toFixed(1)));
  const unsupportedRates = [...String(text).matchAll(/\b(\d{1,3}(?:\.\d+)?)\s*%/g)]
    .map((match) => Number(match[1]))
    .filter((value) => value <= 100 && ![...verifiedRates].some((verified) => Math.abs(Number(verified) - value) <= 0.15));
  const warnings = [];
  if (unsupportedRates.length) warnings.push(`Unverified percentages detected: ${[...new Set(unsupportedRates)].join("%, ")}%`);
  if (/\b(causes?|caused|drives?|predicts?)\b/i.test(text)) warnings.push("Causal language detected; the available analysis establishes associations only.");
  if (/\b(high[- ]risk employee|flight risk|likely to leave)\b/i.test(text)) warnings.push("Individual attrition profiling language detected and must not be used for employment action.");
  return warnings;
}

export function parseDetails(details) {
  return Object.fromEntries(String(details || "").split(/\r?\n/).map((line) => {
    const separator = line.indexOf(":");
    if (separator === -1) return null;
    return [normalizeKey(line.slice(0, separator)), line.slice(separator + 1).trim()];
  }).filter(Boolean));
}

function breakdown(rows, dimension) {
  const groups = new Map();
  for (const { fields } of rows) {
    const label = String(fields[dimension] ?? "").trim();
    if (!label) continue;
    const current = groups.get(label) || { label, total: 0, attrition: 0 };
    current.total += 1;
    if (normalize(fields.attrition) === "yes") current.attrition += 1;
    groups.set(label, current);
  }
  return [...groups.values()].map((group) => ({ ...group, attritionRate: rate(group.attrition, group.total) }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

function sourceLabel(rows) {
  const sources = [...new Set(rows.map(({ record }) => record.source).filter(Boolean))];
  return sources.length ? sources.join(", ") : "Stored employee records";
}

function rate(count, total) {
  return total ? Number(((count / total) * 100).toFixed(2)) : 0;
}

function normalizeKey(value) {
  return normalize(String(value).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " "));
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function title(value) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}
